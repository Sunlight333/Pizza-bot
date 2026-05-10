# Customer Portal — Development Plan

> Concrete, opinionated implementation plan for the customer-facing web
> portal described in `CUSTOMER_ANNOUNCEMENT.md` and Phase 1 of
> `FUTURE_DEVELOPMENT_PLAN.md`. This document is **scoped to ship**, not
> survey. Every milestone below is a deployable unit with a definition of
> done. The "Em breve" items from the announcement (loyalty, birthday
> coupon, promotions, email receipt) are explicitly **out of scope here**
> and tracked separately.
>
> Effort tags: S = ≤1 day, M = 2–5 days, L = 1–2 weeks. Single-dev
> estimates, add 30% if shared with bot-ops support.

---

## 0. What we are committing to

The announcement makes six concrete promises to the customer. Everything
in this plan exists to land those six. Anything that does not serve them
is out of scope.

| # | Promise | Maps to |
|---|---------|---------|
| 1 | Order in ~1 min vs ~3 min on WhatsApp | M3, M4 (menu + checkout) |
| 2 | See the full menu on one screen | M3 (menu) |
| 3 | Real-time order tracking, 24/7 | M5 (tracking) |
| 4 | Reorder favorites in 1 click | M6 (history + reorder) |
| 5 | Saved addresses, 1-tap selection | M2 (profile) + M4 (checkout picker) |
| 6 | Order any time, even 3am | Reuses existing `Order.scheduled_for` |

Two non-negotiable invariants:

1. **Same `Order` pipeline.** Web orders go through `order_builder` and
   end up in Datacaixa exactly like WhatsApp orders. We do not branch
   the fiscal path.
2. **Phone is the identity.** A registered web customer with phone
   `+5511...` is the same row in `customers` as the WhatsApp customer
   with that phone. No duplicates, no merge-after-the-fact.

---

## 1. Architectural decisions (made up front)

These are the decisions worth fighting about *before* writing code.
Recorded here so we do not relitigate them in PRs.

### 1.1 Separate Vite app, not new routes in the admin bundle

Customer portal lives at `customer/` as a sibling to `frontend/` (admin),
not as new routes inside the existing React app.

**Why.** The admin bundle pulls in `@react-three/fiber`, `recharts`,
`@dnd-kit/*`, etc. — none of which the public site needs. Mixing them
balloons the public bundle and tanks first-paint on a phone, which is
where most customer traffic will land. The admin already owns `/menu` as
an authenticated route; doing public `/menu` in the same router invites
guard mistakes.

**Trade-off.** Two builds, two `package.json` files, some duplication
(API client, types, design tokens). Net positive — public bundle stays
lean and we cannot accidentally leak admin code to anonymous users.

**Shared code.** A `shared/` package for: API types (generated from
OpenAPI), shared Tailwind config, and the small set of UI primitives
that genuinely overlap. Avoid sharing pages or stores.

### 1.2 Auth = phone + WhatsApp OTP

Login is "type your phone, receive a 6-digit code on WhatsApp, enter
it." No email, no password, no SMS provider integration.

**Why.** The announcement promises *"your phone number is your
account."* Evolution is already wired and free; SMS providers cost money
per message and add a vendor. Password auth adds reset-flow complexity
the customer doesn't need (they're picking pizza, not online banking).

**Implementation.** Reuse `services/whatsapp.py` to send the OTP through
the existing Evolution instance. Code is 6 digits, 10-minute TTL stored
in Redis under `otp:{phone}`. Three attempts then back-off. Rate-limit
by phone *and* IP via `slowapi`.

**Session.** httpOnly JWT cookie, 30-day refresh, signed with the same
secret as admin but with a `customer` audience claim so admin and
customer tokens can never cross-authenticate.

### 1.3 Subdomain, not path

Customer site served at `pedido.{domain}`, admin stays at the existing
host. Nginx routes by `Host` header.

**Why.** Clean cookies (customer cookie scoped to `pedido.`), clean SEO
(public site can be indexed without admin fighting it), separate caching
rules at the edge, and the customer-facing URL is shareable and memorable
on a printed flyer.

### 1.4 Cart: localStorage for guests, server for logged-in

Anonymous browsing builds a cart in `localStorage`. On login, the cart
syncs to a `customer_carts` row keyed by `customer_id`. After that, the
server is source of truth and the localStorage copy is mirror-only.

**Why.** Customer can browse without account friction and not lose their
cart on login. After login, the cart follows them across devices —
useful for "I started on my laptop and finished on my phone."

**Conflict rule on login.** If both local and server carts are
non-empty: keep the server cart, surface a one-click "import what I had
on this device" if the user wants. Keep it boring.

### 1.5 No SSR. Static SPA + JSON API.

Vite SPA, deployed as static files behind Nginx, talks to the same
FastAPI backend. No Next.js, no SSR step.

**Why.** SEO matters for "pizzaria {neighborhood}" search hits, but only
the menu page really needs that. We pre-render the menu page at build
time (Vite's `vite-plugin-prerender` or just a build step that snapshots
`/menu` HTML) and call it good. Full SSR is overkill for a 6-page site.

### 1.6 Reuse `order_builder`. Period.

Web checkout assembles a cart-shaped payload and POSTs it to a new
endpoint that internally calls the existing `order_builder.build_order`.
No second order assembly path.

**Why.** Pricing logic (size × crust × extras × zone fee) is already
right and already tested through the bot. A second copy will drift.

---

## 2. Data model deltas

Migrations to add. Each is a single Alembic revision.

### 2.1 `customer_accounts` (new)

```
id              PK
customer_id     FK customers.id  UNIQUE NOT NULL
email           VARCHAR(255)     NULL  -- optional, for receipts later
email_verified  BOOLEAN          DEFAULT false
marketing_opt_in BOOLEAN         DEFAULT false  NOT NULL  -- LGPD-relevant
last_login_at   TIMESTAMPTZ      NULL
created_at, updated_at
```

`customers` already holds phone, name, addresses, history. The
`customer_accounts` row exists only when a phone has registered for the
web. No row = WhatsApp-only customer (the common case today).

### 2.2 `customer_carts` (new)

```
id              PK
customer_id     FK customers.id  UNIQUE NOT NULL
items           JSONB            NOT NULL DEFAULT '[]'  -- same shape as order_builder input
updated_at
```

One cart per customer. Cleared on successful order. No history.

### 2.3 `Customer.birthday` (new column)

```
ALTER TABLE customers ADD COLUMN birthday DATE NULL;
```

Optional, collected on the profile page. Used by the deferred birthday
coupon feature; harmless to add now.

### 2.4 `Order.channel` (new column)

```
ALTER TABLE orders ADD COLUMN channel VARCHAR(16) NOT NULL DEFAULT 'whatsapp';
-- values: 'whatsapp' | 'web'
```

Needed for the channel-mix report (separate effort) and to debug
"why did this order not get a confirmation message" cases. Default
`'whatsapp'` keeps existing rows correct.

### 2.5 No changes to `Order` items, status, fiscal flags

Web orders use the same enums and the same Datacaixa sync path.

---

## 3. Backend changes

New routes live under `app/api/routes/customer/` (a sub-package) so they
are discoverable and so we can apply customer-only middleware to the
whole group.

### 3.1 Auth (`customer/auth.py`)

```
POST /api/customer/auth/request-otp        body: {phone}      -> 204
POST /api/customer/auth/verify-otp         body: {phone, code} -> sets cookie, 200 {customer}
POST /api/customer/auth/logout                                  -> 204
GET  /api/customer/auth/me                                      -> 200 {customer} | 401
```

- Request-otp: rate-limit `5/hour` per phone, `20/hour` per IP. Always
  returns 204 even if phone is malformed (don't leak existence).
- Verify-otp: on success, upsert `customer_accounts` row, set httpOnly
  JWT cookie, return the customer profile.
- Cookie: `Secure; HttpOnly; SameSite=Lax; Domain=pedido.{domain}`.

Dependency: `services/otp.py` (new) wrapping Redis storage and
Evolution send.

### 3.2 Menu (`customer/menu.py`)

```
GET /api/customer/menu          -> {categories: [...], products: [...]}
```

Public, no auth. Pure read from existing `menu_service`. Cache the
response in Redis for 60s, invalidate on product update via existing
admin write hooks (one new line in the product update endpoint).

### 3.3 Profile + addresses (`customer/profile.py`)

```
GET   /api/customer/profile                  -> profile
PATCH /api/customer/profile                  body: {name, email, birthday, marketing_opt_in}
GET   /api/customer/profile/addresses        -> [addresses]
POST  /api/customer/profile/addresses        body: {label, cep, street, number, ...}
PATCH /api/customer/profile/addresses/{idx}  body: partial
DELETE /api/customer/profile/addresses/{idx}
POST  /api/customer/profile/addresses/{idx}/default  -> 204
```

Addresses are stored on `customers.addresses` JSONB (already exists).
Index-based addressing matches the existing structure; no new table
needed.

CEP autocomplete is client-side via BrasilAPI; backend just stores
what it receives.

### 3.4 Cart (`customer/cart.py`)

```
GET  /api/customer/cart                      -> {items, subtotal, available}
PUT  /api/customer/cart                      body: {items}        -> recomputed cart
POST /api/customer/cart/import               body: {items}        -> merges localStorage cart
DELETE /api/customer/cart                                          -> 204
```

`PUT` revalidates every line against current menu and `available`
toggles (when M9/sold-out lands; today: every line valid). Returns the
canonical cart so the client can detect prices that changed under it.

### 3.5 Checkout (`customer/checkout.py`)

```
POST /api/customer/checkout/quote   body: {items, address_idx, payment_method}
                                    -> {subtotal, delivery_fee, total, eta_min}
POST /api/customer/checkout/place   body: {items, address_idx, payment_method, observation}
                                    -> {order_id, order_number, tracking_token}
```

- `quote` is idempotent and side-effect free; called on every checkout
  page mount and after address change.
- `place` calls `order_builder.build_order(...)` and `order_service.persist`,
  same as the bot path. Returns a one-time `tracking_token` (signed JWT,
  24h TTL) that powers the public `/track/{token}` page.
- If outside operating hours, set `Order.scheduled_for` to next opening
  — same logic the bot already uses, extracted to `services/scheduling.py`
  if not already.

### 3.6 Orders (`customer/orders.py`)

```
GET /api/customer/orders                       -> [order summaries, newest first, paginated]
GET /api/customer/orders/{id}                  -> order detail w/ items + status timeline
POST /api/customer/orders/{id}/reorder         -> {cart}  (clones items into cart, returns updated cart)
```

Authorization: must own the order (`order.customer_id == jwt.customer_id`).

### 3.7 Public tracking (`customer/track.py`)

```
GET /api/customer/track/{token}               -> {order_number, status, history, eta_min, items: [name, qty]}
WS  /ws/customer/track/{token}                -> live status updates
```

No auth. PII is masked (no full address, no phone). Token is the
JWT issued at checkout. Existing WebSocket broadcaster already publishes
status changes; subscribe by `order_id` extracted from the token.

### 3.8 What changes in existing code

Minimal:

- `services/whatsapp.py`: add `send_otp(phone, code)` helper.
- `api/routes/menu.py` (admin): on product update, `redis.delete("menu:public")`.
- `services/order_builder.py`: accept an optional `channel='web'` arg
  and stamp `Order.channel`. Default keeps existing behavior.
- `main.py`: register the new `customer/` routers.
- New CORS origin for the customer subdomain in `settings.cors_origins_list`.

That is the entire backend surface. Everything else is new files.

---

## 4. Frontend (`customer/` app)

### 4.1 Stack

- Vite + React 18 (match admin)
- Tailwind (share `tailwind.config.js` via the `shared/` package)
- React Router 6
- TanStack Query for server state
- Zustand for cart-local state (mirrors the server cart)
- `react-hook-form` + `zod` for forms (announce-phone, OTP, address)
- No 3D, no charts, no heavy date library — `date-fns` only

Bundle target: ≤ 150KB gzipped on first paint, ≤ 500KB total. Lighthouse
mobile performance ≥ 85.

### 4.2 Routes

```
/                  -> Landing (CTA: "Ver cardápio" / "Entrar")
/menu              -> Menu browsing (public)
/menu/{slug}       -> Product detail (modal on desktop, page on mobile)
/cart              -> Cart review
/login             -> Phone entry
/login/verify      -> OTP entry
/checkout          -> Address picker, payment, observation, place button
/orders            -> History (auth)
/orders/{id}       -> Order detail w/ tracking (auth)
/profile           -> Profile + addresses (auth)
/track/{token}     -> Public tracking (no auth)
```

Auth gate: protected routes redirect to `/login?next=<path>`.

### 4.3 State organization

- `useCartStore` (zustand) — items, totals, hydrate from localStorage on
  mount, sync to server when authenticated.
- `useAuthStore` (zustand) — current customer (from `/me`), used by
  router guards.
- Everything else via `useQuery` / `useMutation`.

### 4.4 The five pages that matter

Order of build, simplest to hardest:

1. **Menu (`/menu`)** — grid of categories, product cards, click-to-detail.
   The detail view has the size × crust × extras matrix and a live
   price. This is the showcase page; spend extra time on layout polish
   and image loading.
2. **Cart (`/cart`)** — list of items with qty steppers, line totals,
   delivery-fee placeholder, "Continuar" button.
3. **Login + OTP (`/login`, `/login/verify`)** — phone input with mask,
   then 6-digit code with paste-support and auto-submit on 6 chars.
4. **Checkout (`/checkout`)** — address picker (saved + add new),
   payment method, observation, quote display, place-order button.
   Submission is the riskiest interaction in the app — debounce the
   button, show loading, handle "out of zone" and "store closed" cleanly.
5. **Orders + tracking (`/orders`, `/orders/{id}`, `/track/{token}`)** —
   list view, detail view with status pill stepper, WebSocket-live.

### 4.5 Things customers will hit that we must not screw up

- Phone input must accept `(11) 99999-9999`, `11999999999`, `+5511...`
  and normalize to E.164 server-side.
- OTP screen on iOS Safari — `inputmode=numeric` + `autocomplete=one-time-code`
  so the OS suggests the code from the WhatsApp notification.
- Address number = `"s/n"` for "sem número" cases. Don't force numeric.
- "Out of delivery zone" must say *which* zones we cover, not just "no".
- Store closed must state when we open and offer pre-order via
  `scheduled_for` if the bot already supports it (it does).
- Cart with prices that changed under the customer must re-display the
  new total *before* placing the order, not silently after.

---

## 5. Sequenced milestones

Each milestone is a single PR (or a tight stack), independently
deployable, behind a feature flag (`CUSTOMER_PORTAL_ENABLED`). Order is
strict — each builds on the previous.

### M1 — Scaffolding + auth + identity reconciliation · M (3 days)

- New `customer/` Vite app, `pedido.localhost` dev domain, Nginx config
  for the subdomain.
- Migrations: `customer_accounts`, `Customer.birthday`, `Order.channel`.
- `services/otp.py` + `whatsapp.send_otp`.
- Auth routes (request-otp, verify-otp, me, logout).
- Login + OTP pages.
- `useAuthStore` + protected route HOC.

**DoD.** Can register with my real phone, receive code on WhatsApp,
log in, hit `/api/customer/auth/me` and see my existing
`customers` row (proving identity reconciliation works).

### M2 — Profile + saved addresses · S (1 day)

- Profile + addresses routes (backend + frontend).
- BrasilAPI CEP lookup on the client.
- Default-address toggle.

**DoD.** Can edit my name, save 3 addresses, set one as default. Round-
trips persist.

### M3 — Public menu · M (3–4 days)

- `/api/customer/menu` with Redis cache.
- Admin product-update invalidation hook.
- Menu page + product detail with size/crust/extras matrix.
- Live price calc client-side (mirror of `order_builder` price logic for
  the matrix; final price always re-validated server-side at checkout).
- Pre-render `/menu` HTML at build for SEO.

**DoD.** Anyone can visit `pedido.{domain}/menu` and see the same menu
the bot sees, with photos and live pricing per configuration.

### M4 — Cart + checkout (the big one) · L (2 weeks)

- Cart routes (backend + frontend zustand store + localStorage
  hydration + login-time merge).
- Checkout quote + place routes.
- Checkout page with address picker, payment radio, observation,
  quote display.
- Out-of-zone, store-closed, scheduled-for paths surfaced in the UI.
- Order confirmation page (basic, expanded in M5).
- Idempotency key on `place` to defeat double-submit.

**DoD.** I can place a real order via the web that lands in
`orders` with `channel='web'`, gets written to Datacaixa, and shows up
in the admin Pedidos page indistinguishable from a WhatsApp order.

### M5 — Order tracking · M (3 days)

- `/orders/{id}` with status timeline.
- Public `/track/{token}` page (no auth, masked PII).
- WebSocket subscription per order id.
- Confirmation page (M4 stub) becomes a redirect to `/track/{token}`
  with a "save the link" prompt.

**DoD.** Status changes in the admin (received → preparing → out → delivered)
appear on the customer's tracking page within 1 second, on phone and
desktop.

### M6 — History + reorder · S (1–2 days)

- `/orders` list with pagination.
- "Pedir de novo" button on each past order → calls reorder endpoint →
  redirects to `/cart` with the items pre-loaded.
- "Pedir novamente" CTA on the order-detail page too.

**DoD.** I can find my last order and reorder it in two taps.

### M7 — Bot ↔ web cross-channel polish · S (1 day)

- Bot greets returning customers by name when their phone has a
  `customer_account` (already by name today, but verify after the
  account model lands).
- After a web order is placed, send a WhatsApp confirmation message via
  Evolution with the tracking link — so customers who order on web also
  see the order in their WhatsApp thread. One outbound, no chat tree.
- Admin `Customers` page surfaces an "account registered on" date when
  applicable.

**DoD.** Web order → WhatsApp message arrives with `https://pedido.{domain}/track/{token}`.
Same customer's WhatsApp thread shows the order. Admin sees the link
between phone and web account.

### M8 — Pre-launch hardening · M (3 days)

Not a feature, a checklist:

- Sentry on backend + customer frontend.
- Rate limits tuned: `5/hour` request-otp per phone, `60/min` global on
  `/api/customer/*`, tighter on `verify-otp` and `place`.
- LGPD: privacy notice on first menu visit (cookie consent for analytics
  if any), DSAR scaffolding (export-my-data and delete-my-account
  endpoints), opt-in audit on the marketing flag.
- E2E test (Playwright) covering: register → browse menu → add to cart
  → checkout → see order in admin → status update → reflect on tracking
  page. One happy-path test that catches 80% of regressions.
- Lighthouse mobile audit ≥ 85.
- Manual test on a real iPhone and a real Android.

**DoD.** Soft launch to a single test customer. Real order arrives,
Datacaixa emits, kitchen makes pizza, customer tracks it to delivery.

### M9 — Sold-out toggle (pulled in from FUTURE_DEVELOPMENT_PLAN.md 3.2) · S (1 day)

- `available: bool` on `available_extras` and `available_crusts` rows.
- Bot menu render skips unavailable; web menu greys out unavailable
  options live; cart re-validates on quote.

**Why here.** This is one day of work and prevents the most embarrassing
launch-day failure: someone orders bacon extra at 8pm and we are out of
bacon. Putting it in M9 instead of waiting for Phase 3 is cheap insurance.

**DoD.** Operator unchecks "bacon" in admin, refresh on customer site
shows it disabled within 60s (cache TTL).

---

## 6. Total estimate

Roughly **6 weeks** of single-dev work for M1–M9, assuming no pulls to
support.

```
M1  scaffolding + auth          3 days
M2  profile + addresses         1 day
M3  public menu                 4 days
M4  cart + checkout            10 days
M5  order tracking              3 days
M6  history + reorder           2 days
M7  cross-channel polish        1 day
M8  pre-launch hardening        3 days
M9  sold-out toggle             1 day
                                ────────
                               ~28 dev days  (~6 calendar weeks at 80% utilization)
```

Soft-launch (single test customer) at end of M5, public launch after M8.

---

## 7. Risks & mitigations

### 7.1 Web orders break Datacaixa for everyone

If the new code path corrupts the `.txt` writer, *all* orders stop
emitting fiscally. Mitigations:

- Web orders go through the same `order_builder` and `Datacaixa.write`
  path. No parallel writer.
- M8 includes a soak test of N=20 web orders against a staging
  Datacaixa before public launch.
- Add `Order.channel` to error logs so any Datacaixa failure tells us
  whether web rolled it.

### 7.2 OTP via WhatsApp fails silently

If Evolution disconnects or rate-limits, customers can't log in.

- Show "code sent" optimistically but if no verify within 90s, surface
  "didn't get it? resend" with a 30s cooldown.
- Health check on Evolution before accepting `request-otp`; if down,
  return 503 with a clear message (not 204).
- Log every send result; alert on > 5 failures in 5 min.

### 7.3 Identity reconciliation collisions

Two real-world rough cases:

- Same person, two phones (work + personal): they will see two
  histories. Acceptable for v1; admin merge tool comes later (Phase 2).
- Phone reassignment (someone else now has +5511XXX): when they register,
  they see the previous owner's history. Mitigate by (a) wiping
  `Customer.last_order_at` if it's > 18 months old on first registration,
  and (b) the WhatsApp send of the OTP to that number proves *current*
  ownership, which is acceptable v1 evidence.

### 7.4 Cart prices drift while customer browses

Operator changes pizza price mid-checkout. Customer sees the old total,
clicks place, gets charged the new total. Mitigation:

- Server `quote` returns the canonical price and a `quoted_at`
  timestamp. Client passes `quoted_at` into `place`. If server's current
  total differs from the `quote` server saw at `quoted_at`, return 409
  with new totals; client re-displays "prices changed, confirm again."

### 7.5 Out-of-zone customer

We must not let them order food we won't deliver. The address picker on
checkout calls `quote`, which calls the existing zone engine. If
out-of-zone, `quote` returns `delivery_fee=null, reason="out_of_zone"`
and the place button is disabled with a helpful message ("entregamos em:
X, Y, Z").

### 7.6 Bot and web both messaging the same customer about the same order

After a web order, M7 sends a WhatsApp confirmation. We must not also
trigger the bot's "order received" auto-reply. Skip if `Order.channel
== 'web'` in the bot's outbound notification logic.

---

## 8. Out of scope (explicitly deferred)

These appear in the customer announcement under *"Em breve"*. They are
real commitments to the customer but not part of this plan:

- **Loyalty points** — depends on `Customer.loyalty_points` column +
  earn/redeem rules + bot tools. Plan separately. Estimate M.
- **Birthday coupon** — depends on the coupon engine *and* loyalty for
  the redemption mechanic. Add `Customer.birthday` column now (M1) so
  data starts collecting; build the cron + coupon issue later. Estimate
  S given the coupon engine exists.
- **Coupons / promo codes** — needs a `Promotion` model and integration
  in `order_builder` and the web checkout. Plan as its own L effort.
- **Email PDF receipt** — needs an email provider (Resend or SendGrid),
  PDF rendering, opt-in flow. S effort but adds a vendor and operational
  burden (deliverability, bounces). Defer until at least M8 ships.
- **Multi-card / Stripe / Mercado Pago** — out of scope; PIX + pay-on-
  delivery cover v1.
- **Native mobile app** — explicitly deferred per
  `FUTURE_DEVELOPMENT_PLAN.md` 4.6. The portal will be installable as a
  PWA (cheap addition in M8) which covers home-screen and offline-shell
  needs.

The customer-facing `CUSTOMER_ANNOUNCEMENT.md` should keep these items
under *"Em breve"* and **not promise dates**. We ship them as their own
plans once the portal is live.

---

## 9. Definition of done for the whole portal

The portal is "done" when all of the following are true. This is the
gate for removing the `CUSTOMER_PORTAL_ENABLED` feature flag.

- A customer with no prior account can register, browse, order, pay,
  and track delivery without operator intervention.
- A WhatsApp-only customer who registers later sees their full prior
  WhatsApp order history on the web.
- A web order is indistinguishable from a WhatsApp order in the admin
  panel (same Pedidos row, same Datacaixa file, same fiscal status).
- 95th percentile time-to-place from menu open to order confirmation is
  ≤ 90 seconds in real testing on a real phone.
- No in-flight order has been lost in a 200-order soak.
- LGPD: opt-in is recorded with timestamp, DSAR endpoints work, privacy
  notice rendered on first visit.
- Lighthouse mobile performance ≥ 85; bundle ≤ 150KB gzipped initial.
- Sentry has zero unresolved high-severity errors over 7 days.

---

## 10. After launch

What we measure in week 1:

- Web vs WhatsApp order share by day.
- Time-to-place distribution (web).
- Drop-off funnel: visited `/menu` → added to cart → reached
  `/checkout` → placed order.
- OTP request → verify success rate.
- Reorder click-rate from the orders page.

These numbers feed the next planning round and decide whether the
deferred "Em breve" items get prioritized in the announced order or
re-sequenced based on what customers actually do.

---

*This plan is bounded. If a request comes in that does not appear here,
either it belongs in a later plan (loyalty, coupons, email receipts,
campaigns) or it should be challenged. The portal goes live when section
9 is true, not when it feels complete.*

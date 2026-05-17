# Pizzabot — Future Development Plan

> Forward-looking roadmap. The strategic shift from the previous revision is
> the introduction of a **customer-facing web portal** alongside the existing
> WhatsApp bot, plus an expansion of the admin panel from "bot management"
> into a unified **bot + customer management portal**.
>
> **This is a planning document — nothing here is committed work.** Items are
> grouped by horizon and tagged with rough effort (S = ≤1 day, M = 2–5 days,
> L = 1–2 weeks, XL = 2+ weeks). Estimates assume a single developer.

---

## Strategic shift

Until now, WhatsApp has been the only customer channel and the admin panel
has been built around supporting that bot. Two changes drive this revision:

1. **Customers want a web option.** Some prefer a browsable menu, a visible
   cart, and a tracking page over a chat conversation. We add a dedicated
   customer site without removing or downgrading the WhatsApp channel.
2. **The admin panel becomes a portal.** Today it manages the bot and orders.
   It is being extended to manage **customers** as first-class entities —
   accounts, segments, addresses, history, communications — so the same staff
   handle bot ops and customer relationships from one place.

The WhatsApp bot remains the primary channel for casual / repeat orders. The
web portal serves customers who prefer self-service, and registered customers
get faster repeat orders and richer history regardless of channel.

---

## Current state — quick reference

What ships today (admin panel pages):

- **Dashboard** — order stats and live feed via WebSocket
- **Pedidos** — order CRUD, status timeline, fiscal queue
- **Cardápio** — product CRUD with the size × crust/extra pricing matrix
- **Clientes** — customer profile and order history (read-mostly)
- **Entrega** — zone CRUD with km-band pricing
- **Conversas** — WhatsApp chat viewer with operator takeover
- **Configurações** — bot persona, WhatsApp Cloud API config, Datacaixa sync

Backend services already in place: AI engine (GPT-4o function calling), audio
transcription (Whisper), conversation state (Redis), Datacaixa `.txt` writer,
WebSocket broadcaster, scheduled notifications, fiscal-emit tracking.

What is **not yet built** and is the focus of this plan:

- A customer-facing website (register, login, browse menu, order, track).
- A customer management module in the admin panel (accounts, segments,
  outbound communication, identity reconciliation between web + WhatsApp).

---

## Phase 1 — Customer portal foundation (1–3 months)

The theme is **launch the customer website** and make sure registered
customers have a coherent experience whether they order via web or WhatsApp.

### 1.1 Customer registration & login · M
**Why.** Identity is the prerequisite for everything else (cart, history,
saved addresses, loyalty).

**Scope.**
- Public routes `/register`, `/login`, `/forgot-password`
- Email + password OR phone + OTP (delivered via Meta WhatsApp Cloud API)
- Account model `CustomerAccount` linked to existing `Customer` via phone
- Session via httpOnly JWT cookie
- Email verification on signup; rate-limited password reset

**Dependencies.** Existing `Customer` table; Meta WhatsApp Cloud API for OTP.

### 1.2 Public menu browsing · M
**Why.** Customers should see the full menu — pizzas, sizes, crusts, extras,
prices — at a glance, without opening WhatsApp.

**Scope.**
- Public route `/menu` (no auth required to browse)
- Category navigation, photo grid, search/filter
- Detail view per product showing size matrix and extras
- Price recomputes live as the customer picks size / crust / extras
- Menu data sourced from existing `menu_service.get_menu_for_bot`-style API

**Dependencies.** None new — reuses product schema.

### 1.3 Shopping cart + checkout · L
**Why.** The actual ordering flow on the web.

**Scope.**
- Cart persisted client-side for guests, server-side for logged-in customers
- Address picker (saved addresses + new); delivery fee computed via existing
  zone engine
- Payment: PIX (existing) and "pay on delivery"; Stripe/Mercado Pago later
- Order confirmation page with order number and live status
- Same `Order` table — web orders flow through the same fiscal/Datacaixa
  pipeline as WhatsApp orders

**Dependencies.** Existing `order_builder`, delivery zones, fiscal queue.

### 1.4 Customer order tracking page · S
**Why.** Replaces the "e meu pedido?" round-trip on WhatsApp with a real-time
page.

**Scope.**
- Logged-in route `/orders` lists all past orders
- `/orders/{number}` shows the status timeline (received → confirmed →
  preparing → out_for_delivery → delivered) live via WebSocket
- Public `/track/{number}` link (no login) for sharing — masked PII
- Reorder button: clones an old order into a new cart

**Dependencies.** Existing WebSocket broadcaster.

### 1.5 Customer profile & saved addresses · S
**Why.** Reduces friction on every repeat order.

**Scope.**
- `/profile` page: name, email, phone, birthday (optional), marketing opt-in
- `/profile/addresses` CRUD with CEP autocomplete (BrasilAPI)
- Default address pre-selected at checkout

**Dependencies.** BrasilAPI (free, no key).

### 1.6 Identity reconciliation (web ↔ WhatsApp) · M
**Why.** A customer who ordered three times via WhatsApp and then registers
on the website should see those three orders in their web history. Otherwise
the channels feel like two different stores.

**Scope.**
- On registration, match by phone — link `CustomerAccount` to existing
  `Customer`
- Bot recognizes a phone that has a registered account and can greet by name
- Single-source-of-truth for loyalty points, addresses, order history
- Manual merge tool in admin for edge cases (e.g., customer used a different
  phone)

**Dependencies.** `Customer` already keyed by phone.

---

## Phase 2 — Admin portal expansion (2–4 months, overlaps Phase 1)

The theme is upgrading the admin panel from "bot ops" into a **bot + customer
management portal**. These items follow the customer site launch but several
can run in parallel with Phase 1.

### 2.1 Customer management module · L
**Why.** Today `/clientes` is read-mostly. Operators need to actually manage
customers — edit details, fix bad data, merge duplicates, export lists,
contact individuals.

**Scope.**
- Edit customer profile (name, phone, addresses, notes)
- Merge duplicate records (common after the same person uses two phones)
- Tags / labels (VIP, complainer, business, etc.)
- "Send message" action → opens a WhatsApp draft via the WhatsApp client
- CSV export filtered by segment
- Per-customer activity log (orders, conversations, complaints, refunds)

**Dependencies.** Audit log (2.6).

### 2.2 Customer segments · M
**Why.** Operators want to act on groups, not individuals — *"all customers
who haven't ordered in 60 days"*, *"top 10% by lifetime spend"*.

**Scope.**
- Segment builder (filters: last order date, total spend, order count, tag,
  zone)
- Saved segments visible across the admin (Reports, Campaigns, Customers)
- Segment counts refresh nightly (cached); ad-hoc recompute button

**Dependencies.** Reports infrastructure.

### 2.3 Outbound campaigns · L
**Why.** With registered accounts plus marketing opt-in, the operator can
finally activate the customer base.

**Scope.**
- Campaign builder: pick segment + channel (WhatsApp now, email later) +
  message template + send time
- LGPD: requires `marketing_opt_in=true` (collected on web signup, askable
  in-bot)
- Rate-limited send via the Meta WhatsApp Cloud API (template messages) to stay within Meta's messaging tiers
- Per-campaign metrics: sent / delivered / replied / converted

**Dependencies.** Segments (2.2).

### 2.4 Reports & analytics · L
**Why.** Operator can't currently answer *"which pizza sold best last week?"*
or *"are web orders growing?"* without SQL. Adding a web channel makes this
even more important — the operator needs to see channel mix.

**Scope.**
- `/reports` page with date range
- Top-selling products, revenue by hour/day heatmap, AOV trend
- Channel mix: web vs WhatsApp orders, conversion funnel
- New vs returning customer ratio
- Delivery zone performance
- CSV export per chart

**Dependencies.** May need a materialized view as `orders` grows.

### 2.5 Coupon / promotion engine · L
**Why.** Both channels need promotions — web checkout coupon field and bot
`apply_coupon` tool both feed the same engine.

**Scope.**
- `Promotion` model: code, type (percent / fixed / BOGO / free-item), value,
  validity window, min-cart, max-uses-per-customer
- Admin `/promotions` CRUD
- Web checkout coupon field
- Bot tool `apply_coupon(code)`
- Reports: redemptions and revenue impact

**Dependencies.** Touches `order_builder` (cart total).

### 2.6 Audit log · M
**Why.** Multi-staff edits to customers and prices need accountability.

**Scope.**
- `AuditLog` table: actor, entity_type, entity_id, action, before, after, ts
- Decorator on all admin write routes
- `/audit` page with filters
- 90-day retention

**Dependencies.** Existing JWT auth.

### 2.7 Multi-user roles & permissions · M
**Why.** Customer management means staff editing PII. Not every role should
see phone numbers or merge accounts.

**Scope.**
- Roles: `owner`, `manager`, `attendant`, `driver`
- Permission matrix per resource
- Frontend hides forbidden actions; backend enforces

**Dependencies.** Audit log (2.6).

### 2.8 Mobile-responsive admin · M
**Why.** Counter staff often only have a phone. Today the matrix editor and
Conversas page are unusable on mobile.

**Scope.**
- Hamburger sidebar on `< md`, collapsible filters, stacked-card matrix
  editor on narrow screens, ≥44px touch targets
- Test on iOS Safari + Android Chrome

**Dependencies.** Pure frontend.

---

## Phase 3 — Bot & operations improvements (3–6 months)

These were Phase 1 in the previous revision and remain valuable, just
re-prioritized behind the customer portal launch.

### 3.1 Bot improvements · M
- TTS reply when customer sends audio
- Sentiment-triggered human handoff (`requires_human=true` + admin alert)
- Conversation analytics: drop-off funnel by state
- Per-`BotConfig` prompt overrides (no code redeploy to retune persona)
- FAQ tool: bot answers common non-order questions from a knowledge base

### 3.2 Sold-out / temporary disable per option · S
- `available: bool` on each `available_extras` / `available_crusts` row
- Bot menu render skips unavailable; auto-resets at operating-window start
- Web menu greys out unavailable options live

### 3.3 Daily product limits · M
- Optional `daily_limit` on `Product`; Redis counter per `(product, date)`
- Bot and web checkout both honor the limit
- Admin shows "X of Y sold" per product; auto-reset daily

### 3.4 Loyalty / points program · M
- `Customer.loyalty_points` (single source for both channels)
- Earn rule (1 point per R$10 spent, configurable)
- Redeem rules (e.g., 100 = R$20 off, 200 = pizza grande grátis)
- Surfaced in web profile + bot tool `check_loyalty` / `redeem_points`

### 3.5 Birthday automation · S
- Daily cron generates a single-use coupon for customers with a birthday
  this week and notifies via WhatsApp
- Coupons expire 7 days after issue

### 3.6 Kitchen Display System (KDS) · M
- `/kds` route, tablet-optimized, single-PIN entry
- Orders grouped by status, per-order timer, "Ready" advances status
- Sound alert on new order

### 3.7 Driver management + delivery tracking · L
- `User` role `driver`; orders assigned with `driver_id`
- Driver PWA with active orders + tap-to-deliver
- Optional live GPS shown on the public tracking page (1.4)

### 3.8 iFood / Rappi sync · L
- Inbound webhook → `Order`; status sync back; channel marker

### 3.9 Combo / bundled pricing · M
- `Combo` model (list of items + bundle price); surfaced on web menu and
  bot menu render

### 3.10 Email receipts · S
- After fiscal-emit, send a PDF receipt via SendGrid/Resend (opt-in)

---

## Phase 4 — Long-term / strategic (6+ months)

### 4.1 Multi-tenant / franchise mode · XL
Sell the platform to other pizzarias. Each store has its own menu, zones,
staff, Datacaixa instance, but shares the codebase. Per-tenant subdomain,
isolated DB schema or RLS, per-tenant Meta WhatsApp Cloud number, billing.

### 4.2 Voice ordering (phone calls) · L
Twilio + Whisper + GPT-4o-realtime + TTS. Reuses `order_builder` and the
Datacaixa pipeline.

### 4.3 Demand forecasting / dynamic staffing · L
sklearn or Prophet on historical orders × weather × holidays. Forecast widget
on Dashboard; staffing recommendation per shift.

### 4.4 White-label admin · L
Tenant-configurable logo, colors, favicon, domain, sender names. CSS
variables driven by tenant theme. Depends on 4.1.

### 4.5 In-bot ratings / NPS · M
After delivery, bot asks 1–10. `OrderRating` table; aggregated NPS on
Dashboard; low-score triage view.

### 4.6 Native customer mobile app · L
Only after the web portal is mature and there is demand for push
notifications and home-screen presence beyond what a PWA gives.

---

## Technical debt & infrastructure

Not user-visible, but compounds silently.

### Testing
- E2E: real Meta WhatsApp Cloud + Datacaixa pipeline. M
- Integration tests for `ai_engine`: replay transcripts, assert tool calls. M
- Frontend component tests (Vitest + Testing Library). M
- E2E for the new web checkout flow once it lands. M

### Observability
- Sentry / Rollbar for backend + frontend error tracking. S
- OpenTelemetry traces on the AI engine (WhatsApp → GPT → Datacaixa). M
- Token cost dashboard (`BotConfig.daily_token_budget` has no UI). S

### CI / CD
- GitHub Actions (pytest + frontend lint on PRs, deploy to staging on merge). M
- Staging environment that mirrors prod data minus secrets. M
- Migration rollback test in CI. S

### Backups & DR
- Automated Postgres backup verification (nightly restore to scratch). M
- Datacaixa file replay (keep `.txt` for 30d, replay on demand). S
- Off-site backup (encrypted to S3/Backblaze). S

### Security
- 2FA for admin accounts (TOTP). M
- JWT secret rotation without invalidating active sessions. M
- Rate limiting refinement (tight on login, loose on public tracking). S
- LGPD: DSAR (export + delete on request), retention policy, opt-in audit. M

### Performance
- Cache layer for menu render (Redis, invalidate on product update). S
- Index audit (`Order.created_at`, `Customer.phone`, conversation messages). S
- N+1 query review on order endpoints (`selectinload` / `joinedload`). S

### DX
- API docs: OpenAPI tags + descriptions. S
- Frontend Storybook for design-system components. M
- Pre-commit hooks (black/ruff/eslint). S
- Type-safe TS API client generated from OpenAPI. M

---

## Out of scope / explicitly deferred

- Custom POS to replace Datacaixa (already handles fiscal compliance).
- Cryptocurrency payments (PIX covers it).
- Generic CMS for marketing pages (use a static site generator separately).
- Replacing GPT-4o with a fine-tuned model (premature; current approach
  works without model-ops burden).

---

## Recommended sequence

If forced to pick one focus per month, in order:

- **Month 1 — Customer portal MVP.** Ship 1.1 (auth), 1.2 (menu browsing),
  1.5 (profile + addresses). Outcome: customers can register and browse the
  menu on the web.
- **Month 2 — Web ordering live.** Ship 1.3 (cart + checkout), 1.4 (order
  tracking), 1.6 (web ↔ WhatsApp identity reconciliation). Outcome:
  customers can place and track orders on the web; their history is unified
  across channels.
- **Month 3 — Customer management.** Ship 2.1 (customer module), 2.6 (audit
  log), 2.7 (roles). Outcome: operators can actually manage customers and
  every change is accountable.
- **Month 4 — Visibility & retention.** Ship 2.2 (segments), 2.4 (reports),
  2.5 (coupons). Outcome: operator sees the business in numbers and can run
  promotions across both channels.
- **Month 5 — Activation.** Ship 2.3 (campaigns), 3.4 (loyalty), 3.5
  (birthday automation). Outcome: outbound activation of the customer base.
- **Month 6 — Bot + ops polish.** Ship 3.1 (bot improvements), 3.2 (sold-out
  toggle), 3.3 (daily limits), 2.8 (mobile-responsive admin). Outcome: bot
  quality measurable and tunable; staff usable from a phone.

Beyond month 6, prioritize based on what worked. Multi-tenant (4.1) is the
biggest commercial bet; only chase it after the single-tenant business is
demonstrably valuable to similar pizzarias.

---

## Maintenance notes

- **Keep this doc current.** When something ships, mark it with the commit
  hash and date in a "Done" section at the bottom — don't delete entries.
- **Re-evaluate quarterly.** What was Phase 4 in Q1 may be Phase 1 in Q3.
- **Effort estimates assume a single dev.** Add 30% slack if shared with
  another initiative, 50% if also doing support.

---

*This revision pivots the roadmap to a customer-facing web portal plus a
bot + customer management admin portal, while preserving the WhatsApp bot
as the primary casual-order channel.*

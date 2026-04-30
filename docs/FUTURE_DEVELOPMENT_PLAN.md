# Pizzabot — Future Development Plan

> Forward-looking roadmap for features, pages and infrastructure improvements
> beyond the current shipped scope. Compiled after auditing the codebase as of
> commit `636c6f9` (per-extra/per-crust/per-size pricing, bulk operator tools,
> data-quality warnings, global search, notifications panel).
>
> **This is a planning document — nothing here is committed work.** Items are
> grouped by horizon and tagged with rough effort (S = ≤1 day, M = 2–5 days,
> L = 1–2 weeks). Effort estimates assume a single developer familiar with the
> stack and exclude design iteration time.

---

## Current state — quick reference

What ships today (admin panel pages):

- **Dashboard** — order stats and live feed via WebSocket
- **Pedidos** — order CRUD, status timeline, fiscal queue
- **Cardápio** — product CRUD with the size × crust/extra pricing matrix
- **Clientes** — customer profile and order history
- **Entrega** — zone CRUD with km-band pricing
- **Conversas** — WhatsApp chat viewer with operator takeover
- **Configurações** — bot persona, Evolution config, Datacaixa sync

Backend services already in place: AI engine (GPT-4o function calling), audio
transcription (Whisper), conversation state (Redis), Datacaixa `.txt` writer,
WebSocket broadcaster, scheduled notifications, fiscal-emit tracking.

---

## Phase 1 — Near-term (1–3 months)

The theme for Phase 1 is **operator efficiency and AI accuracy** — work that
removes friction on tasks the operator does daily and makes the bot quote
correct prices in more scenarios. Each item below has direct user-visible
impact and minimal new dependencies.

### 1.1 Reports & Analytics page · L
**Why.** Dashboard shows aggregate counts but the operator can't answer
*"which pizza sold best last week?"* or *"are Friday tickets growing?"* without
SQL. These questions drive menu pricing and promotion decisions.

**Scope.**
- New `/reports` page with date range picker
- Top-selling products (qty + revenue, by category)
- Revenue by hour-of-day and day-of-week heatmap
- Average order value over time (line chart)
- Bot conversion funnel: conversations started → orders placed → fiscal-emitted
- New vs returning customer ratio
- Delivery zone performance (orders per zone, avg delivery time per band)
- Export to CSV per chart

**Dependencies.** Existing `Order`, `OrderItem`, `Conversation` tables.
Probably needs one materialized view for the hour×day heatmap to keep the
query fast as `orders` grows.

### 1.2 Coupon / promotion engine · L
**Why.** Operator can't run *"Sexta 20% OFF"* or *"Compre 2 pizzas grandes,
ganhe um refri"* today. Manual discounts via `observation` field don't track,
don't validate, and don't reach the bot's price logic.

**Scope.**
- New model `Promotion` with: code, type (percent / fixed / BOGO / free-item),
  value, validity window, min-cart-value, max-uses-per-customer, active flag
- Admin page `/promotions` to CRUD
- Bot tool `apply_coupon(code)` → validates and adjusts cart total
- Customer-facing redemption: customer types code in chat, bot validates
- Reports: redemptions per promotion, revenue impact

**Dependencies.** Touches `order_builder.py` (cart total) and `ai_engine.py`
(new tool registration). Migration adds `Promotion` table + `Order.promotion_id`.

### 1.3 Kitchen Display System (KDS) · M
**Why.** Today the kitchen receives orders via Datacaixa's printout. There's
no way to mark items "ready" without going to the admin panel. A wall-mounted
tablet with active orders + "ready" button would replace paper and trigger
the *"saiu para entrega"* status automatically.

**Scope.**
- New `/kds` route, tablet-optimized layout (no sidebar, big text, swipe-friendly)
- Auto-fullscreen mode + always-on display
- Order grouped by status (received, preparing, ready)
- Per-order timer (since received)
- "Ready" button advances status and broadcasts via WebSocket
- Sound alert on new order (configurable)
- No login screen — single PIN to enter, persists for the session

**Dependencies.** Reuses existing WebSocket events. New `kds_pin` field on
`BotConfig`.

### 1.4 Public order tracking · S
**Why.** Customer asks *"e meu pedido?"* on WhatsApp. The bot can answer but
that's a manual round-trip. A simple public page `/track/<order_number>` that
the bot can paste a link to lets the customer self-serve.

**Scope.**
- Public route (no auth) `GET /api/orders/track/{number}` — returns minimal
  fields (status, ETA, total, masked customer name)
- Frontend page with status timeline (received → confirmed → preparing →
  out_for_delivery → delivered) styled like the existing OrderTimeline
- Bot system prompt updated to include tracking link in confirmation message
- Rate-limited to prevent enumeration

**Dependencies.** Already has `Order.order_number`. Add a public sub-router.

### 1.5 Sold-out / temporary disable per option · S
**Why.** *"Acabou o bacon hoje"* — operator should be able to disable
"Extra Bacon" without deactivating every pizza. Today the only switch is
`is_active` on the whole `Product`.

**Scope.**
- Per-row `available: bool` on each `available_extras` and `available_crusts`
  entry (default `true`)
- Toggle in the matrix editor (gray row when `available=false`)
- Bot menu render skips unavailable items
- `validate_combination` rejects orders with unavailable extras/crusts
- "Sold out today" auto-resets at the start of the operating window (cron
  via existing `scheduler.py`)

**Dependencies.** Schema-level migration. Touches `menu_service.py` and the
bot prompt rendering.

### 1.6 Daily product limits · M
**Why.** *"Só temos 30 brotinhos prontos"* — once stock runs out, the bot
should refuse new orders for that item politely. Today there's no concept of
inventory.

**Scope.**
- Optional `daily_limit: Optional[int]` on `Product` (null = unlimited)
- Counter in Redis per `(product_id, date)`
- Admin page shows "X de Y vendidas" badge per product
- Bot tool `add_*_to_cart` decrements counter, raises ValueError when limit
  reached → AI rejects with friendly message
- Counter resets daily at the operating-hour start

**Dependencies.** Redis (already running). Modifies `order_builder.add_pizza`
and `add_simple_product`.

### 1.7 Audit log · M
**Why.** When prices change unexpectedly the operator wonders *"who changed
this?"*. With multiple staff the answer is currently invisible.

**Scope.**
- New `AuditLog` table: actor_user_id, entity_type, entity_id, action,
  before, after, ts
- Decorator/middleware on `PUT/POST/DELETE` admin routes
- New `/audit` page with filter by user, entity, date
- 90-day retention (cron sweeps older rows)

**Dependencies.** Existing `User` table, JWT auth gives the actor.

### 1.8 Mobile-responsive admin · M
**Why.** Operator at the counter often has only a phone. Today the
matrix editor and the conversations page are unusable on mobile.

**Scope.**
- Hamburger sidebar on `< md`
- Collapsible filters in Pedidos / Conversas / Cardápio
- Matrix editor switches to stacked-card layout when narrow
- Touch-friendly hit areas (≥44px)
- Test on iOS Safari + Android Chrome

**Dependencies.** Pure CSS / Tailwind work. No backend.

### 1.9 Bot improvements · M
**Why.** Quality and reliability of the AI is the single biggest determinant
of the project's success since the AI is the primary order taker.

**Scope.**
- TTS reply (already flagged as optional in original plan): bot responds with
  audio when the customer sends audio. Uses OpenAI TTS API.
- Sentiment-triggered handoff: when GPT classifies the customer message as
  upset/angry, set `requires_human=true` and notify admin via the bell.
- Conversation analytics: where do conversations drop off? New `/conversations/
  analytics` panel shows funnel by state.
- Prompt overrides per `BotConfig` — let operator tune persona without code
  redeploy.
- FAQ tool: bot can answer common non-order questions (operating hours, address,
  payment methods) from a knowledge base in `BotConfig`.

**Dependencies.** Existing `ai_engine.py`. Needs OpenAI TTS quota.

### 1.10 Address autocomplete + CEP lookup · S
**Why.** Customers send incomplete addresses. CEP lookup auto-fills street/
neighborhood and lets the bot pick the correct delivery band without asking
1000 questions.

**Scope.**
- Backend `GET /api/delivery/cep/{cep}` proxies BrasilAPI
- Bot tool `lookup_cep` — calls when customer mentions a CEP
- Admin form for delivery zones gets CEP autocomplete

**Dependencies.** External API (BrasilAPI is free, no key).

---

## Phase 2 — Mid-term (3–6 months)

Phase 2 adds **growth and retention features** that depend on the analytics
and promotion infrastructure from Phase 1.

### 2.1 Marketing / outbound campaigns · L
**Why.** 6,000 phone numbers are sitting in the customer table with zero
outbound activation. With LGPD opt-in this is the cheapest growth channel
the operator has.

**Scope.**
- Campaign builder UI: select segment + message template + send time
- Segments: all customers, no order in 30/60/90 days, top 10% spend, birthday
  this week
- Send via Evolution API in scheduled batches (rate-limited to not trigger
  WhatsApp ban)
- LGPD: `Customer.privacy_notice_sent` already exists; campaigns require an
  explicit opt-in flag (`marketing_opt_in: bool`)
- Per-campaign metrics: sent, delivered, replied, converted to order

**Dependencies.** Existing Evolution client. New tables: `Campaign`,
`CampaignRecipient`.

### 2.2 Birthday automation · S
**Why.** Industry standard, low effort, high goodwill. Customer's birthday
triggers a one-time R$ X off coupon valid for that week.

**Scope.**
- Add `Customer.birthday: Optional[date]`
- Bot asks for birthday during 2nd or 3rd order (optional, opt-in)
- Daily cron generates a single-use coupon (Promotion engine from 1.2) and
  sends a WhatsApp message
- Unredeemed coupons expire after 7 days

**Dependencies.** Promotion engine (1.2), campaign sender (2.1), scheduler.

### 2.3 Loyalty / points program · M
**Why.** *"Compre 10 pizzas, ganhe 1 grátis"* — proven retention tool.

**Scope.**
- `Customer.loyalty_points: int`
- Earn rule: 1 point per R$10 spent (configurable in `BotConfig`)
- Redeem rule: 100 points = R$ 20 off / 200 points = pizza grande grátis
- Bot tool `check_loyalty` and `redeem_points`
- Admin page to manually adjust points

**Dependencies.** Promotion engine (1.2).

### 2.4 Driver management + delivery tracking · L
**Why.** Today drivers are invisible to the system. Operator can't see
*"who's carrying order #42 right now?"* and the customer has no live tracking.

**Scope.**
- Drivers as `User` with role `driver`
- Order assignment: status `out_for_delivery` requires `driver_id`
- Driver-facing mobile page (PWA) shows their active orders + tap-to-mark-
  delivered
- Optional: live GPS via browser geolocation, shown on a map widget on the
  customer's tracking page (1.4)
- Driver performance metrics: avg delivery time, deliveries/shift

**Dependencies.** Public tracking page (1.4), maps library (Leaflet).

### 2.5 iFood / Rappi sync · L
**Why.** Operator probably already has iFood. Today those orders are typed
manually into Datacaixa. Bringing them into the same admin reduces errors
and gives one queue.

**Scope.**
- Inbound webhook from iFood/Rappi → maps payload into `Order`
- Status sync back (preparing → out_for_delivery → delivered)
- Marker showing the source channel (already partial — `Conversation.channel`)

**Dependencies.** iFood API key (paid, partner program).

### 2.6 Multi-user roles & permissions · M
**Why.** Today every admin user is full-access. A counter clerk shouldn't
delete products. The owner shouldn't accidentally close yesterday's report.

**Scope.**
- Role enum: `owner`, `manager`, `attendant`, `driver`
- Permission matrix per role (CRUD on each resource)
- Frontend hides actions the role can't do
- Backend re-enforces (defense in depth)

**Dependencies.** Existing auth. Audit log (1.7) becomes more useful.

### 2.7 Combo / bundled pricing · M
**Why.** *"Pizza grande + refri 2L = R$ 65"* — common upsell pattern that
today can only be expressed as a discount, not a real product.

**Scope.**
- New model `Combo`: list of `(product_id, qty, size?)` items + total price
- Bot menu render lists combos in a *"Combos"* section
- `validate_combination` knows about combos
- Admin page `/combos` to CRUD

**Dependencies.** Existing `Product`. Touches `order_builder.py` and prompt.

### 2.8 Email receipts · S
**Why.** Customer asks for *"a notinha por email"* — common with corporate
customers. Today there's no automated email at all.

**Scope.**
- Optional `Customer.email`
- After fiscal-emission, send a PDF receipt via SendGrid/Resend
- Receipt template includes customer info, items, totals, fiscal data

**Dependencies.** Email provider account.

---

## Phase 3 — Long-term (6+ months)

Phase 3 is **strategic** — features that take significant work and assume the
business is past product-market fit and looking to scale or differentiate.

### 3.1 Multi-tenant / franchise mode · XL
**Why.** Sell the platform to other pizzarias. Each store has its own menu,
zones, staff, and Datacaixa instance, but shares the codebase and admin
infrastructure.

**Scope.**
- `Tenant` (or `Store`) model — every other model gets `tenant_id`
- Subdomain or path-based routing (`store-a.pizzabot.app` / `/s/store-a`)
- Onboarding flow: new pizzeria signs up, picks plan, gets isolated DB schema
  or row-level security
- Per-tenant Evolution API instance management (already partial via
  `/api/evolution/instance`)
- Tenant-level billing (Stripe / Mercado Pago)
- Per-tenant feature flags

**Dependencies.** Significant DB refactor. Possibly switch to Postgres
schema-per-tenant or rely on RLS.

### 3.2 Voice ordering (phone calls) · L
**Why.** Older customers call instead of typing. A Twilio + Whisper +
GPT-4o-realtime pipeline could handle phone calls with the same order logic.

**Scope.**
- Twilio inbound number per pizzaria
- Streaming Whisper for live transcription
- GPT-4o-realtime for low-latency replies
- TTS for outbound speech
- Reuses existing order_builder + Datacaixa pipeline

**Dependencies.** Twilio account, OpenAI realtime API access (paid tier).

### 3.3 Demand forecasting / dynamic staffing · L
**Why.** Operator wants to know *"how many pizzaiolos do I need on Friday?"*.
With 6 months of order data, basic seasonality models give surprisingly good
answers.

**Scope.**
- ML pipeline (sklearn or Prophet) trained on historical orders × weather ×
  holidays
- Daily forecast widget on Dashboard
- Staffing recommendation: pizzaiolos / motoboys per shift
- Alert on anomalies (today's pace 2σ above forecast)

**Dependencies.** Reports + analytics (1.1) for clean data export. Weather
API (Open-Meteo is free).

### 3.4 White-label admin · L
**Why.** Once 3.1 is in place, partners want to brand the admin panel as
their own. *"Pizzabot powered by"* branding becomes optional.

**Scope.**
- Tenant-configurable: logo, color palette, favicon, domain name, terms URL
- CSS variables driven by tenant theme
- Custom email/WhatsApp sender names per tenant

**Dependencies.** Multi-tenant (3.1).

### 3.5 In-bot ratings / NPS · M
**Why.** Closing the loop on customer experience. After the order is
delivered, bot asks *"de 1 a 10, como foi?"*. Insights drive product changes.

**Scope.**
- New `OrderRating` table: order_id, score, comment, ts
- Bot tool `record_rating` triggered after `delivered` status
- Aggregated NPS on Dashboard
- Filter "low-score orders" to triage complaints

**Dependencies.** Bot prompt update + scheduler trigger after delivery.

---

## Technical debt & infrastructure

These are not user-visible but compound silently if neglected.

### Testing
- **E2E test with real Evolution + Datacaixa** (deferred Step 12 from original
  plan) — single most valuable test, validates the whole pipeline end-to-end. M
- **Integration tests for `ai_engine`** — replay a conversation transcript and
  assert the tool calls + cart state. Currently only unit-tested. M
- **Frontend component tests** — Vitest + Testing Library for the matrix
  editor, ProductModal, GlobalSearch, NotificationsBell. M

### Observability
- **Sentry / Rollbar** for backend + frontend error tracking. Today errors
  only show up in `docker logs`. S
- **OpenTelemetry traces** on the AI engine — see end-to-end latency from
  WhatsApp → GPT → Datacaixa per request. M
- **Token cost dashboard** — `BotConfig.daily_token_budget` exists but there's
  no UI to see *"we spent R$ 38 on GPT today"*. S

### CI / CD
- **GitHub Actions pipeline** — run pytest + frontend lint on PRs, deploy to
  staging on merge. M
- **Staging environment** on a separate VPS or Docker compose profile, mirrors
  prod data minus secrets. M
- **Migration rollback test** — for every alembic migration, verify
  `downgrade()` works in CI before merge. S

### Backups & DR
- **Automated Postgres backup verification** — restore the latest dump nightly
  to a scratch container, run schema validation. M
- **Datacaixa file replay** — keep `.txt` files for 30d, support replaying
  any failed/missed file. S
- **Off-site backup** — current backups are local; ship encrypted dumps to
  S3/Backblaze. S

### Security
- **2FA for admin accounts** (TOTP). M
- **API key rotation** — JWT secret rotation without invalidating active
  sessions. M
- **Rate limiting refinement** — current `slowapi` is per-IP global; tier
  limits per endpoint (login: tight, public tracking: loose). S
- **LGPD compliance**:
  - DSAR flow (data subject access request — export + delete on request). M
  - Retention policy: archive customers with no order in 24 months. S
  - Privacy notice acknowledgment audit (already partial via
    `Customer.privacy_notice_sent`). S

### Performance
- **Cache layer for menu render** — `get_menu_for_bot()` runs on every chat
  message; cacheable in Redis with invalidation on product update. S
- **Index audit** — confirm Postgres indexes match actual query patterns
  (especially `Order.created_at`, `Customer.phone`, conversation messages). S
- **N+1 queries** — `selectinload` / `joinedload` review on order endpoints. S

### DX (developer experience)
- **API docs** — FastAPI auto-generates OpenAPI; add tags + descriptions so
  `/docs` is actually useful. S
- **Frontend Storybook** for the design system components. M
- **Pre-commit hooks** — black/ruff/eslint. S
- **Type-safe API client** — generate TS client from OpenAPI so frontend
  doesn't drift from backend. M

---

## Out of scope / explicitly deferred

Items intentionally not in this plan:

- **Native iOS/Android app for customers.** WhatsApp *is* the customer
  channel; building an app duplicates effort and competes with the bot.
- **Custom POS to replace Datacaixa.** The pizzaria already has Datacaixa for
  fiscal compliance; rebuilding it isn't in scope.
- **Cryptocurrency payments.** No real demand; PIX covers the use case.
- **Generic CMS for marketing pages.** If the pizzaria needs a website, use
  a static site generator separately.
- **Replacing GPT-4o with a fine-tuned model.** Premature; the prompt-engineered
  approach works and avoids the maintenance burden of model ops.

---

## Recommended sequence (if forced to pick)

If the operator can only do one thing per month, in order:

- **Month 1 — Operator efficiency.** Ship items 1.5 (sold-out toggle), 1.7
  (audit log) and 1.8 (mobile-responsive admin). Outcome: no more out-of-stock
  embarrassment, accountability for who changed what, and the panel is
  usable from a phone at the counter.
- **Month 2 — Visibility.** Ship 1.1 (reports & analytics) and 1.9 (bot
  improvements: TTS, sentiment-triggered handoff, conversation analytics,
  prompt overrides, FAQ tool). Outcome: operator can see the business in
  numbers, and bot quality becomes measurable instead of vibes-based.
- **Month 3 — Customer-facing.** Ship 1.4 (public order tracking), 1.10
  (CEP autocomplete) and 1.6 (daily product limits). Outcome: customers
  self-serve their order status, addresses get auto-completed, and the bot
  stops accepting orders for items that ran out.
- **Month 4 — Growth.** Ship 1.2 (coupon engine), 2.2 (birthday automation)
  and 2.3 (loyalty program). Outcome: first retention engine running with
  trackable redemption.
- **Month 5 — Workflow.** Ship 1.3 (KDS) and 2.4 (driver management). Outcome:
  kitchen and drivers are in the system instead of on paper.
- **Month 6 — Reach.** Ship 2.1 (marketing campaigns) and 2.5 (iFood/Rappi
  sync). Outcome: outbound activation of the 6,000 contacts and one queue
  for all order channels.

Beyond month 6, prioritize based on what worked. Multi-tenant (3.1) is the
biggest commercial bet; only chase it if the single-tenant business is
demonstrably valuable to similar pizzarias.

---

## Maintenance notes

- **Keep this doc current.** When something here ships, mark it with the commit
  hash and date in a "Done" section at the bottom (don't delete entries —
  history is useful).
- **Re-evaluate quarterly.** The customer's needs change; what was Phase 3 in
  Q1 may be Phase 1 in Q3.
- **Effort estimates assume a single dev.** Add 30% slack if shared with
  another initiative, 50% if the dev is also doing support.

---

*Drafted after auditing the codebase end-to-end against the operator's stated
needs (free vs paid extras, per-size border pricing, brotinho 1-flavor rule,
AI as primary order taker). This document is the planning authority — update
it as new conversations with the customer reveal new constraints.*

# Customer Portal — Build Summary

> What was actually built in the all-step pass on 2026-05-10. Companion
> to `CUSTOMER_PORTAL_DEV_PLAN.md` (the plan) and
> `CUSTOMER_PORTAL_DESIGN.md` (the design spec).

## Status by milestone

| Milestone | Status | Notes |
|---|---|---|
| **M1 — Auth + scaffolding + identity reconciliation** | ✅ done | OTP via WhatsApp; `customer_accounts` linked by phone |
| **M2 — Profile + saved addresses** | ✅ done | CEP autocomplete via BrasilAPI; default-address toggle |
| **M3 — Public menu** | ✅ done | Redis-cached, admin-write invalidates cache |
| **M4 — Cart + checkout** | ✅ done | Server-backed cart, idempotent /place, real Datacaixa pipeline |
| **M5 — Tracking + WebSocket** | ✅ done | Per-order WebSocket fanout, public + authed tracking |
| **M6 — History + reorder** | ✅ done | One-tap reorder clones items into cart |
| **M7 — Cross-channel polish** | ⏳ partial | `Order.channel='web'` stamped; outbound WhatsApp confirmation TODO |
| **M8 — Pre-launch hardening** | ⏳ pending | Sentry, Lighthouse audit, Playwright E2E, LGPD bits |
| **M9 — Sold-out toggle** | ⏳ pending | `available` column on options; no UI yet |

## Files created

### Backend (15 new files, 4 edits)

```
backend/app/models/
  customer_account.py        NEW   one-to-one with customers via phone
  customer_cart.py           NEW   server-side persistent cart
  __init__.py                EDIT  register new models
  customer.py                EDIT  + birthday Date column
  order.py                   EDIT  + channel String column

backend/app/services/
  otp.py                     NEW   Redis-backed OTP issue/verify, sends via Evolution
  web_cart.py                NEW   structured-input → priced lines (mirrors menu_service)
  customer_tracking.py       NEW   per-order WebSocket fanout

backend/app/utils/
  customer_security.py       NEW   JWT with aud='customer'
  tracking_token.py          NEW   JWT with aud='order_tracking', 7-day TTL

backend/app/api/routes/customer/
  __init__.py                NEW   sub-router aggregator
  deps.py                    NEW   get_current_customer, get_optional_customer, get_current_account
  auth.py                    NEW   request-otp, verify-otp, me, logout
  profile.py                 NEW   GET/PATCH profile + addresses CRUD
  menu.py                    NEW   public menu w/ Redis cache + product detail
  cart.py                    NEW   GET/PUT/import/DELETE cart
  checkout.py                NEW   quote + place (idempotent)
  orders.py                  NEW   list, detail, reorder
  track.py                   NEW   public token-based + WebSocket

backend/app/main.py          EDIT  mount customer router
backend/app/api/routes/menu.py    EDIT  invalidate customer cache on product write
backend/app/api/routes/orders.py  EDIT  fanout to tracking_manager on status change

backend/alembic/versions/
  0018_customer_portal.py    NEW   accounts, carts, birthday, channel
```

### Frontend (`customer/` — 34 source files)

```
customer/
  package.json, vite.config.js, tailwind.config.js, postcss.config.js,
  index.html, .gitignore, README.md

  public/images/             16 curated WebP files (hero/backgrounds/fallbacks/atmosphere)

  src/
    main.jsx                 entry — QueryClient + Router + Toaster
    App.jsx                  routes — public + protected
    styles/index.css         Tailwind + design-token components
    services/api.js          axios + grouped endpoints + BrasilAPI CEP
    stores/
      auth.js                zustand — me/setCustomer/logout/hydrate
      cart.js                zustand + persist — guest + server cart, sync on login
    utils/
      format.js              brl(), formatDateTime(), timeAgo()
      phone.js               formatPhoneInput(), normalizePhone()
      pricing.js             client-side line-total preview
    components/
      Button.jsx, Pill.jsx, Input.jsx, OTPInput.jsx, EmptyState.jsx,
      Skeleton.jsx, ProtectedRoute.jsx, ProductCard.jsx, StatusTimeline.jsx
      layout/
        AppLayout.jsx        page shell + sticky-cart-bar awareness
        TopBar.jsx           logo + cart badge + back button
        BottomNav.jsx        mobile-only 3-tab nav
        StickyCartBar.jsx    fixed bottom red bar above bottom-nav
    pages/
      Landing.jsx            hero + how-it-works + atmosphere
      Menu.jsx               sticky category pills + sectioned product grid
      ProductDetail.jsx      hero image + size/crust/extras matrix + sticky CTA
      Cart.jsx               line items + qty steppers + subtotal
      Checkout.jsx           address picker + payment + live quote + idempotent place
      Login.jsx              phone entry
      OTPVerify.jsx          6-box OTP w/ paste + auto-submit + resend cooldown
      Orders.jsx             history list
      OrderDetail.jsx        timeline + items + reorder + share + WebSocket live
      Track.jsx              public token-gated tracking page
      Profile.jsx            name/email/birthday/opt-in + addresses link
      Addresses.jsx          CRUD + CEP autocomplete + default toggle
```

## Verifications

- ✅ All backend Python files compile (`python3 -m py_compile`)
- ✅ Frontend builds (`npm run build`): **330 KB unminified, 105 KB gzipped JS** + 6 KB gzipped CSS
- ✅ Bundle size within the 150 KB design-spec budget
- ✅ Migration 0018 has both upgrade and downgrade paths

## What's NOT verified (operator must do before launch)

1. **Run `alembic upgrade head` against staging/prod.** Migration 0018
   adds two tables and two columns; backfills `Order.channel='whatsapp'`.
   Downtime: none.
2. **Real OTP send.** OTP service uses the existing `whatsapp.send_text`
   path. Should "just work" but never tested end-to-end against a real
   customer phone.
3. **Real order placement.** Verify a web order lands in admin's Pedidos
   page identical to a WhatsApp order, hits Datacaixa, and emits fiscally.
4. **WebSocket through Nginx.** The `/ws` route works in dev via Vite
   proxy. Production needs `proxy_set_header Upgrade $http_upgrade;` and
   `proxy_set_header Connection "upgrade";` on the customer subdomain.
5. **CORS for `pedido.{domain}`.** Add the customer subdomain to
   backend's `cors_origins` env var.
6. **Lighthouse mobile audit.** Target ≥ 85; current build hasn't been
   audited.
7. **iOS Safari + Android Chrome smoke test on a real device.** Spec
   calls for it; only desktop-Chrome equivalent tested via build.

## Key design decisions encoded in code

1. **Phone is the identity.** `verify-otp` upserts a `Customer` keyed by
   normalized phone (`55 + DDD + number`), then upserts a
   `CustomerAccount` linked to it. WhatsApp history appears immediately
   on first web login. (`auth.py:99-115`)
2. **Web orders use the same pipeline as WhatsApp.** `checkout.place`
   calls `order_service.create_order` — same fiscal codes, same
   Datacaixa sync flag, same per-day order numbering. Only difference:
   `Order.channel='web'`. (`checkout.py:165-200`)
3. **Server is authoritative on price.** Client previews price via
   `utils/pricing.js`, but `/checkout/quote` always recomputes through
   `services/web_cart.py` which uses the exact same primitives as
   `services/order_builder.py` (the bot's path). (`web_cart.py`)
4. **Idempotency on /place.** Client generates a key per checkout
   session; server caches the response under
   `checkout:idem:{customer_id}:{key}` for 30 min. Page refresh, button
   mash, or network retry → same response, same single order.
   (`checkout.py:131-158`)
5. **Tracking token, not session, on /track.** Public link works
   without login; token is a 7-day signed JWT. PII (full address) is
   masked in the response. (`track.py:38-78`, `tracking_token.py`)
6. **Per-order WebSocket fanout.** Customers subscribe to one order_id
   only; admin status updates broadcast to BOTH the existing admin
   manager AND the new `tracking_manager`. No cross-tenant leakage.
   (`customer_tracking.py`)
7. **Menu cache invalidation on admin write.** Admin
   `POST/PUT/DELETE /products` invalidates `customer:menu:public` so
   menu changes propagate within seconds. Cache TTL is 60 s as a
   backstop. (`menu.py:148-164`)
8. **Auth tokens cannot cross.** Customer JWTs carry `aud='customer'`,
   admin JWTs do not. `decode_customer_token` requires the audience.
   (`utils/customer_security.py`)

## Deferred (out of this build, by design)

- **Loyalty points** — `Customer.loyalty_points` not added; design says
  M-effort separate plan
- **Birthday coupon** — column added (`Customer.birthday`) so data
  starts collecting; cron + coupon issue is separate
- **Coupon engine** — entire promotion model, no scope here
- **Email receipts** — needs email provider; deferred
- **Multi-payment / Stripe** — PIX + on-delivery covers v1
- **PWA / install prompt** — M8 hardening

## Run instructions

```bash
# Backend
cd backend
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Customer portal
cd customer
npm install
npm run dev    # http://localhost:5174
```

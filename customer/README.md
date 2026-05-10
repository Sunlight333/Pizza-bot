# Pizzabot — Customer Portal

Public-facing ordering site. Sibling to `frontend/` (admin) and shares
the FastAPI backend.

- Landing → menu → product → cart → checkout → live tracking
- Phone + WhatsApp OTP login (no password)
- Same `Order` pipeline as the WhatsApp bot (Datacaixa, fiscal queue)
- Mobile-first, 105 KB gzipped JS, Lighthouse-friendly

## Run locally

```bash
cd customer
npm install
npm run dev          # http://localhost:5174
```

The dev server proxies `/api`, `/media`, and `/ws` to the backend at
`http://localhost:8000` (configured in `vite.config.js`).

Backend must be running:

```bash
cd ../backend
alembic upgrade head     # applies migration 0018_customer_portal
uvicorn app.main:app --reload --port 8000
```

## Build

```bash
npm run build            # writes ./dist
npm run preview          # serves dist on :5174
```

Current build size: **105 KB gzipped JS, 6 KB gzipped CSS** — within
the design-spec budget.

## Routes

| Path | Auth | Description |
|---|---|---|
| `/` | public | Landing |
| `/menu` | public | Browse menu |
| `/menu/:productId` | public | Product detail (size/crust/extras) |
| `/cart` | public | Cart (server-backed when logged in) |
| `/login` · `/login/verify` | public | Phone + WhatsApp OTP |
| `/checkout` | auth | Address / payment / place order |
| `/orders` · `/orders/:id` | auth | History + live tracking |
| `/profile` · `/profile/addresses` | auth | Account + saved addresses |
| `/track/:token` | public | Anonymous tracking via signed token |

## Architecture in one paragraph

React 18 + Vite + Tailwind + TanStack Query + Zustand. Auth via
`pz_session` httpOnly cookie set by `/api/customer/auth/verify-otp`.
Cart is `localStorage` for guests and server-backed for logged-in
users; on login the guest cart imports into the server cart. Pricing
is computed client-side for live previews but the server is always
authoritative — `/checkout/quote` and `/checkout/place` re-price
through the same `menu_service` + `web_cart` helpers the WhatsApp bot
uses, then call `order_service.create_order` so the resulting `Order`
row is indistinguishable from a WhatsApp order (set
`Order.channel='web'` for analytics).

## Brand

Extends the existing landing palette in `frontend/tailwind.config.js`
(cream / off-white / charcoal / oven-red) plus three product accents
(ember, basil, crust). Display: Playfair Display. Body: Inter. See
`docs/CUSTOMER_PORTAL_DESIGN.md` for tokens.

## Images

Hero / background / fallback imagery is committed to `public/images/`.
Sourced from Unsplash (free for commercial use, no attribution
required). Operators can swap any of them; file paths stay stable so
code never breaks. Product photos come from admin uploads via the
existing `image_urls` flow on `Product`.

## Deployment

Production should be served from `pedido.{domain}` via Nginx, with the
proxy rules from `vite.config.js` translated into Nginx `location`
blocks. Same backend, same database, separate static-file mount.

## What's not here yet (deferred per `docs/CUSTOMER_PORTAL_DEV_PLAN.md`)

- Loyalty points / birthday coupons / promo codes / email PDF receipts
  — separate plans, surfaced to customers under "Em breve"
- Sold-out toggle (M9) — backend column exists; UI wiring TODO
- Service Worker / PWA install prompt
- Sentry / OpenTelemetry — covered in M8 hardening

# 🍕 Pizzabot

WhatsApp ordering bot for a Brazilian pizzaria. React admin panel + FastAPI backend + PostgreSQL + Redis + GPT-4o + Whisper, with a Windows bridge app that writes `.txt` orders into Datacaixa PDV.

## Quick start — dev

```bash
cp .env.example .env
# Edit .env — at minimum set OPENAI_API_KEY
docker compose up --build
```

- Backend: http://localhost:8000 (health: `/api/health`, detailed: `/api/health/detailed`)
- Frontend: http://localhost:5173
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

### Seed default data

```bash
docker compose exec backend python -m app.seed
```

Creates:
- `admin` / `admin123` user (change after first login)
- 15 pizza flavors (salgadas + doces), drinks, sides
- 6 sample delivery zones

### WhatsApp setup (Meta WhatsApp Cloud API)

The bot uses Meta WhatsApp Cloud API exclusively. The full ordered
walkthrough lives in [`whatsapp_setup.md`](whatsapp_setup.md) — Phases
0–8, each with a `curl` verify step. Phase summary:

- **Phase 0** — Business Manager, App, WABA, phone, display name,
  business verification.
- **Phase 1** — Permanent system-user token (`META_ACCESS_TOKEN`).
- **Phase 2** — Webhook URL + verify token handshake
  (`META_VERIFY_TOKEN`).
- **Phase 3** — Subscribe the App's `messages` webhook field (the
  easy-to-miss step).
- **Phase 4** — Phone-number registration + 2-step PIN.
- **Phase 5** — Payment method on the WABA.
- **Phase 6** — Submit the four templates from
  [`whatsapp_templates.md`](whatsapp_templates.md).
- **Phase 7** — App Review for Advanced Access → flip App Mode to Live.
- **Phase 8** — Tier ramp-up (automatic).

Env vars consumed by the backend (see `backend/app/config.py`):
`META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_PHONE_NUMBER_ID`,
`META_WABA_ID`, `META_DISPLAY_PHONE_NUMBER`, `META_VERIFY_TOKEN`,
`META_GRAPH_VERSION`, plus the four `META_TEMPLATE_*` template-name
slots.

## Layout

```
backend/   FastAPI + async SQLAlchemy + Alembic
  app/
    api/routes/   auth, health, menu, delivery, customers, orders, webhook, bridge
    models/       8 SQLAlchemy models + enums
    schemas/      Pydantic request/response
    services/     menu, delivery, customers, orders, ai_engine, order_builder,
                  datacaixa, whatsapp, audio (Whisper), websocket, notifications
    middleware/   slowapi rate limiter
    utils/        security (JWT + bcrypt)
  alembic/        migrations (0001 schema, 0002 pg_trgm)
  tests/          pytest — half-pizza pricing, Datacaixa format, state machine
frontend/  React + Vite + Tailwind + R3F + Framer Motion + Recharts
  src/
    pages/        Dashboard, Orders, Menu, Customers, Delivery, Conversations,
                  Settings, Login (R3F pizza)
    components/   layout (Sidebar, TopBar, AnimatedPage, AppLayout), 3d, menu
    services/     api (axios+JWT), menu, delivery, customers, orders
    stores/       auth (zustand + persist)
    hooks/        useLiveOrders (WebSocket with reconnect)
bridge/    Windows service — polls VPS and writes .txt into Datacaixa folder
nginx/     Reverse proxy config (prod)
```

## What's done

| Step | Feature | State |
|------|---------|-------|
| 1 | Scaffolding, DB, JWT auth, Docker | ✅ |
| 2 | Menu CRUD + bot-ready menu rendering + half-pizza pricing | ✅ |
| 3 | Delivery zones with `pg_trgm` fuzzy match (accent/typo tolerant) | ✅ |
| 4 | Customer lookup + profile + order history | ✅ |
| 5 | Order CRUD + stats + WebSocket live feed + Dashboard | ✅ |
| 6 | Meta WhatsApp Cloud API client + webhook + Redis conv state + Whisper audio | ✅ |
| 7 | GPT-4o function calling (10 tools) + state machine + handoff | ✅ |
| 8 | Datacaixa `.txt` generator + bridge HTTP API + Windows bridge service | ✅ |
| 9 | Structured JSON logging + detailed health + notification service | ✅ |
| 10 | Frontend polish (OrderGlobe, ParticleBackground, heatmap) | ⏳ deferred |
| 11 | Rate limiting (slowapi), nginx config, prod compose, pytest core tests | ✅ |
| 12 | E2E integration test | ⏳ needs real WhatsApp Cloud + Datacaixa |

## Testing

```bash
docker compose exec backend pytest -v
```

Core tests cover the critical paths my code review flagged:
- Half-pizza pricing (BR max rule)
- Datacaixa `.txt` format (pipes, comma decimals, SEFAZ codes)
- Order status state machine (valid transitions, no reversals)

## Production deployment

```bash
# On VPS, with domain pointing at it and Let's Encrypt already obtained:
cp .env.example .env  # fill in all secrets
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend python -m app.seed

# Build the frontend (served by nginx from ./frontend/dist)
cd frontend && npm ci && npm run build
```

Edit `nginx/default.conf` — replace `YOUR_DOMAIN`.

## Bridge install (pizzeria PC, Windows)

```
cd bridge
copy config.ini.example config.ini  :: edit URL + token + folder paths
python -m pip install -r requirements.txt
build.bat  :: produces dist\bridge.exe
```

Install `bridge.exe` as a Windows service (use `nssm` or a scheduled task at login).
The bridge polls `/api/bridge/pending` every 5s and writes UTF-8 pipe-delimited `.txt`
files into Datacaixa's `Integração\Pedidos` folder. Confirm sync via `/api/bridge/confirm/{id}`.

## Known gaps (flagged during build)

1. **R3F polish (Step 10) deferred** — `OrderGlobe`, `ParticleBackground`, 3D `PizzaBuilder`, animated heatmap. The site has a polished base (Tailwind palette, Framer transitions, `LoginPizza`); heavier 3D is decoration until the bot works end-to-end.
2. **Bridge offline UX** — alerts fire (`services/notifications.py`) but the bot keeps accepting orders when Datacaixa is unreachable. Decide with Marcio whether to block new orders or queue silently.
3. **Cupom fiscal emission** — the Datacaixa import stages a sale; confirm with Gabriel whether NFCe/SAT emits automatically or a human still clicks something.
4. **Half-pizza rule confirmed as MAX** — matches BR standard; re-confirm with Marcio if he uses average.
5. **CPF-na-nota flow** — `Product.csosn/ncm/etc` columns are in place but the bot currently doesn't ask; easy to add to the system prompt.
6. **No E2E test with real hardware** — planned for Step 12, blocked on Meta WhatsApp Cloud + Datacaixa PC setup.
7. **OpenAI cost** — estimated ~R$1,200/mo at 2,400 orders/mo with GPT-4o on every turn. This is the *client's* recurring cost, not in R$6K scope. Consider GPT-4o-mini for greetings.
8. **LGPD** — 6,000 phone numbers stored; no retention policy or DSAR flow yet. Low immediate risk, real legal risk.

## Default credentials

- Admin panel: `admin` / `admin123` (change after first login)
- Bridge token: derived from first 16 chars of `JWT_SECRET` + `"bridge"` — wire a proper secret before prod.

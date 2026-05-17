# 🍕 Pizzaria WhatsApp Bot — Complete Development Plan

**Project:** Automated WhatsApp ordering system for pizzaria delivery
**Client:** M.J.L. (Marcio) — CNPJ 24853133000179
**Developer:** Donny
**Stack:** React.js (Frontend) + FastAPI (Backend) + PostgreSQL + Redis
**IDE:** VS Code with Claude Code
**Budget:** R$ 6.000 (3 milestones: 50% / 30% / 20%)
**Timeline:** 4–6 weeks

---

## Project Context (compiled from client conversations)

### Client Profile
- Pizzaria delivery, 15 years in business, 6,000 WhatsApp contacts
- Volume: ~20 orders/day (Tue–Thu), 120 Fri, 120 Sat, 80 Sun (~2,400/month)
- POS system: Datacaixa PDV (Windows, Firebird DB)
- Previous bot experience: Anota Aí (menu-based) — customers disliked it
- Payment methods: PIX, credit card on delivery, debit card on delivery, balcão pickup
- Needs full infrastructure setup (has nothing currently)

### Core Problem
Loss of sales during peak hours (Friday–Sunday) due to slow manual WhatsApp responses. Multiple orders arrive simultaneously, attendant can't keep up, customers wait 5+ minutes and give up.

### Client Requirements (extracted from all messages)
1. AI-powered bot that understands natural language text AND audio messages
2. NOT a numbered menu bot — must feel like a real attendant
3. Full order flow: greeting → menu → order assembly → address → payment → confirmation
4. Pizza meio a meio (half-and-half) with crust options, extras, modifications
5. Delivery fee calculation by neighborhood
6. PIX, credit card, debit card, balcão pickup
7. Orders must land in Datacaixa PDV automatically (no manual typing)
8. Cupom fiscal (tax receipt) auto-generated
9. Customer confirmation with order number
10. Human handoff when bot gets stuck or customer requests attendant
11. Audio understanding (Whisper) — client specifically requested this
12. Optional: bot replies with audio (TTS) — client asked about this
13. Optional: status updates ("saiu para entrega") via simple control panel

### Datacaixa Integration Spec (confirmed with Gabriel, Datacaixa support)
- **Method:** .txt file import (no REST API available)
- **Encoding:** UTF-8
- **Separator:** pipe `|`
- **File naming:** sequential `ped_00000001.txt`, `ped_00000002.txt`, etc.
- **Polling:** configurable timer (recommended: 7000ms positive value for auto-sale generation)
- **Import folder:** `Integração > Pedidos` inside Datacaixa installation directory
- **File layout:**
  ```
  PEDIDO|customer_name|cpf_optional|seller_name|observation_field|
  ITEM|product_code|description|unit_price|quantity|unit|NCM|total|CEST|CFOP|IBPT|CSOSN|origem|code|
  ITEM|...|...|...|...|...|...|...|...|...|...|...|...|...|
  PGTO|payment_code|total_amount|
  ```
- **Payment codes (SEFAZ):** 01=Dinheiro, 03=Crédito, 04=Débito, 17=PIX, 90=Sem pagamento, 99=Outros
- **Address/phone/neighborhood:** goes in the observation field of PEDIDO line
- **Delivery fee:** registered as a separate ITEM product
- **Pizza meio a meio:** single consolidated description string
- **CPF:** optional, can be blank
- **Tax fields (NCM, CFOP, CSOSN, IBPT, etc.):** MANDATORY in every file
- **Limitation:** import goes to fiscal/sales only, NOT to Delivery module
- **Limitation:** one-way integration — no callbacks from Datacaixa

### Architecture Overview
```
┌─────────────────────┐     ┌──────────────────┐     ┌──────────────────────────────────┐
│   Customer Phone    │◄───►│  Meta WhatsApp   │◄───►│           VPS (Cloud)            │
│   (WhatsApp)        │     │  Cloud API       │     │  ┌────────────────────────────┐  │
└─────────────────────┘     │  (Meta-hosted)   │     │  │   FastAPI Backend          │  │
                            └──────────────────┘     │  │   + AI Layer + WebSocket   │  │
                                                     │  └──────────────┬─────────────┘  │
                                                     │  ┌──────────────┴─────────────┐  │
                                                     │  │  PostgreSQL  +  Redis      │  │
                                                     │  └────────────────────────────┘  │
                                                     │  ┌──────────────┐ ┌────────────┐ │
                                                     │  │ React.js     │ │ Uptime     │ │
                                                     │  │ Admin Panel  │ │ Kuma       │ │
                                                     │  └──────────────┘ └────────────┘ │
                                                     └──────────────┬───────────────────┘
                                                                    │ HTTPS API
                                                     ┌──────────────▼───────────────────┐
                                                     │     Pizzeria PC (Windows)        │
                                                     │  ┌──────────────┐ ┌────────────┐ │
                                                     │  │ Bridge App   │ │ Datacaixa  │ │
                                                     │  │ (Python)     │─│ PDV        │ │
                                                     │  │ writes .txt  │ │ imports txt│ │
                                                     │  └──────┬───────┘ └────────────┘ │
                                                     │         │ reads tax data         │
                                                     │  ┌──────▼───────┐                │
                                                     │  │ Firebird DB  │                │
                                                     │  │ (read-only)  │                │
                                                     │  └──────────────┘                │
                                                     └──────────────────────────────────┘
```

---

## Final Tech Stack

### Frontend (Admin Panel)
- **React.js 18** with Vite
- **React Three Fiber** (R3F) + **Drei** — 3D elements, ambient effects
- **Framer Motion** — page transitions, micro-interactions, entrance animations
- **Tailwind CSS** — utility styling
- **Recharts** — order analytics charts
- **React Router v6** — SPA routing
- **Axios** + **TanStack Query** — API calls + caching
- **Lucide React** — icons
- **React Hot Toast** — notifications

### Backend (API + Bot Engine)
- **Python 3.12** + **FastAPI**
- **SQLAlchemy** + **Alembic** — ORM + migrations
- **PostgreSQL 16** — primary database
- **Redis 7** — session cache, message queue, rate limiting
- **Celery** — async task queue (audio processing, .txt generation)
- **OpenAI Python SDK** — Whisper, GPT-4o, TTS
- **httpx** — Meta WhatsApp Cloud API communication
- **Pydantic v2** — request/response validation
- **python-jose** + **passlib** — JWT auth
- **WebSocket** — real-time order updates to admin panel

### WhatsApp
- **Meta WhatsApp Cloud API** (Meta-hosted, official Business Platform)

### POS Bridge (Windows service on pizzeria PC)
- **Python 3.12** — lightweight Windows service
- **fdb** or **firebird-driver** — Firebird DB read access
- **httpx** — polls VPS API for new orders
- **pyinstaller** — package as .exe for easy install

### Infrastructure
- **Docker + Docker Compose** — all VPS services containerized
- **Nginx + Certbot** — reverse proxy + auto-SSL
- **Ubuntu 22.04 LTS** — VPS OS
- **Uptime Kuma** — service monitoring + alerts

---

## Repository Structure

```
pizzabot/
├── frontend/                    # React.js admin panel
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/              # Three.js / R3F 3D components
│   │   │   │   ├── PizzaScene.jsx
│   │   │   │   ├── OrderGlobe.jsx
│   │   │   │   └── ParticleBackground.jsx
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── TopBar.jsx
│   │   │   │   └── AnimatedPage.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── LiveOrderFeed.jsx
│   │   │   │   ├── StatsCards.jsx
│   │   │   │   ├── RevenueChart.jsx
│   │   │   │   └── PeakHoursHeatmap.jsx
│   │   │   ├── orders/
│   │   │   │   ├── OrderList.jsx
│   │   │   │   ├── OrderDetail.jsx
│   │   │   │   ├── OrderTimeline.jsx
│   │   │   │   └── StatusUpdatePanel.jsx
│   │   │   ├── menu/
│   │   │   │   ├── MenuManager.jsx
│   │   │   │   ├── PizzaBuilder.jsx
│   │   │   │   ├── CategoryEditor.jsx
│   │   │   │   └── PriceEditor.jsx
│   │   │   ├── customers/
│   │   │   │   ├── CustomerList.jsx
│   │   │   │   ├── CustomerProfile.jsx
│   │   │   │   └── OrderHistory.jsx
│   │   │   ├── delivery/
│   │   │   │   ├── DeliveryZoneMap.jsx
│   │   │   │   ├── FeeManager.jsx
│   │   │   │   └── StatusBoard.jsx
│   │   │   ├── conversations/
│   │   │   │   ├── ChatViewer.jsx
│   │   │   │   ├── HumanTakeover.jsx
│   │   │   │   └── ConversationList.jsx
│   │   │   └── settings/
│   │   │       ├── BotPersonality.jsx
│   │   │       ├── WorkingHours.jsx
│   │   │       ├── MetaWhatsAppConfig.jsx
│   │   │       └── DatacaixaSync.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Orders.jsx
│   │   │   ├── Menu.jsx
│   │   │   ├── Customers.jsx
│   │   │   ├── Delivery.jsx
│   │   │   ├── Conversations.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Login.jsx
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── utils/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   └── models/              # 3D model files (.glb)
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                     # FastAPI server
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py
│   │   │   │   ├── orders.py
│   │   │   │   ├── menu.py
│   │   │   │   ├── customers.py
│   │   │   │   ├── delivery.py
│   │   │   │   ├── conversations.py
│   │   │   │   ├── webhook.py
│   │   │   │   ├── bridge.py
│   │   │   │   └── dashboard.py
│   │   │   └── deps.py
│   │   ├── models/
│   │   │   ├── customer.py
│   │   │   ├── order.py
│   │   │   ├── order_item.py
│   │   │   ├── product.py
│   │   │   ├── category.py
│   │   │   ├── delivery_zone.py
│   │   │   ├── conversation.py
│   │   │   └── user.py
│   │   ├── schemas/
│   │   │   ├── customer.py
│   │   │   ├── order.py
│   │   │   ├── product.py
│   │   │   └── webhook.py
│   │   ├── services/
│   │   │   ├── whatsapp.py
│   │   │   ├── ai_engine.py
│   │   │   ├── audio.py
│   │   │   ├── tts.py
│   │   │   ├── order_builder.py
│   │   │   ├── menu_service.py
│   │   │   ├── delivery.py
│   │   │   ├── datacaixa.py
│   │   │   ├── payment.py
│   │   │   └── handoff.py
│   │   ├── tasks/
│   │   │   ├── process_audio.py
│   │   │   ├── generate_txt.py
│   │   │   └── send_notification.py
│   │   └── utils/
│   │       ├── conversation_state.py
│   │       └── txt_formatter.py
│   ├── alembic/
│   │   └── versions/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── bridge/                      # Windows service for pizzeria PC
│   ├── bridge_service.py
│   ├── firebird_reader.py
│   ├── txt_writer.py
│   ├── config.ini
│   ├── requirements.txt
│   └── build.bat
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx/
│   └── default.conf
└── README.md
```

---

## Step-by-Step Development Prompts for Claude Code

> **How to use:** Copy each prompt into Claude Code in VS Code.
> Each step builds on the previous one. All steps develop frontend + backend + database simultaneously.

---

### STEP 1 — Project Scaffolding + Database Foundation

```
Create the project scaffolding for a pizzaria WhatsApp bot system.

BACKEND (FastAPI):
- Initialize FastAPI project in /backend with Python 3.12
- Set up SQLAlchemy async with PostgreSQL connection
- Set up Alembic for migrations
- Create config.py with Pydantic Settings (reads from .env):
  DATABASE_URL, REDIS_URL, OPENAI_API_KEY, WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET,
  JWT_SECRET, CORS_ORIGINS
- Create all database models with SQLAlchemy:

  Customer: id, phone (unique, indexed), name, cpf (nullable),
  addresses (JSON array), default_address_index, total_orders,
  last_order_at, created_at

  Category: id, name, display_order, is_active

  Product: id, category_id (FK), name, description, sizes (JSON:
  [{size: "pequena", price: 29.90}, {size: "grande", price: 49.90}]),
  is_pizza (bool), allows_half (bool), available_crusts (JSON array),
  available_extras (JSON array), ncm, cfop, csosn, cest, ibpt_code,
  origin_code, datacaixa_code, is_active, image_url

  DeliveryZone: id, neighborhood, fee, estimated_minutes, is_active

  Order: id, customer_id (FK), order_number (auto-increment per day,
  format: #001), items (relationship), status (enum: received,
  confirmed, preparing, out_for_delivery, delivered, cancelled),
  subtotal, delivery_fee, total, payment_method (enum: pix, credit,
  debit, cash, pickup), payment_code (SEFAZ: 01,03,04,17),
  delivery_address, delivery_neighborhood, customer_phone,
  observation, datacaixa_synced (bool), datacaixa_file (nullable),
  created_at, updated_at

  OrderItem: id, order_id (FK), product_id (FK), description
  (full text like "Pizza Grande 1/2 Calabresa + 1/2 Portuguesa
  Borda Catupiry"), unit_price, quantity, unit ("UN"),
  is_delivery_fee (bool)

  Conversation: id, customer_id (FK), phone, state (enum: greeting,
  browsing_menu, building_order, collecting_address,
  collecting_payment, confirming, completed, human_takeover),
  cart (JSON), context_messages (JSON array for GPT history),
  started_at, last_message_at, handed_off_at, assigned_agent

  User: id, username, password_hash, role (enum: admin, attendant),
  is_active

- Generate initial Alembic migration
- Create basic health check endpoint GET /api/health
- Create JWT auth utilities (create_token, verify_token, hash_password)
- Create auth routes: POST /api/auth/login, GET /api/auth/me
- Seed script that creates default admin user (admin/admin123)

FRONTEND (React.js):
- Initialize React.js project with Vite in /frontend
- Install and configure: tailwindcss, framer-motion, react-router-dom,
  axios, @tanstack/react-query, lucide-react, react-hot-toast,
  @react-three/fiber, @react-three/drei, recharts
- Set up Tailwind with custom theme:
  Colors: primary orange (#FF6B35), secondary dark (#1A1A2E),
  accent (#FFD700), success (#00C853), bg dark (#0F0F23),
  surface (#16213E), card (#1A1A3E)
  Fonts: "Space Grotesk" (headings) + "Inter" (body)
- Create base layout: Sidebar.jsx (collapsible, nav items with icons,
  animated active indicator), TopBar.jsx (page title, search,
  notifications, user dropdown), AnimatedPage.jsx (Framer Motion
  wrapper with fade+slide entrance)
- Create Login.jsx: dark gradient bg, centered card, 3D rotating pizza
  behind card (R3F torus geometry with warm materials), username +
  password fields, JWT auth flow
- Create protected route wrapper, empty page shells for all pages
- Create axios instance with JWT interceptor

DOCKER:
- docker-compose.yml: postgres:16, redis:7-alpine, backend, frontend
- Dockerfiles for backend (python:3.12-slim) and frontend (node:20-alpine)
```

---

### STEP 2 — Menu Management System

```
Build the complete menu management system.

BACKEND:
- CRUD routes for /api/menu/categories:
  GET (list with product count), POST, PUT /:id, DELETE /:id (soft delete)
- CRUD routes for /api/menu/products:
  GET (filters: category_id, is_active, is_pizza, search),
  POST, PUT /:id, DELETE /:id, GET /:id
- Menu service:
  - get_menu_for_bot(): structured menu for GPT system prompt
  - calculate_half_pizza_price(flavor1_id, flavor2_id, size):
    returns higher price (Brazilian standard)
  - build_pizza_description(flavors[], size, crust, extras[]):
    consolidated string for Datacaixa
  - validate_combination(items): checks compatibility
- Seed: 15+ pizza flavors (P/M/G/GG prices), 5 drinks, 3 sides,
  crusts (Catupiry, Cheddar, Chocolate, Sem Borda),
  extras (Extra Queijo, Extra Bacon, Sem Cebola, etc.)

FRONTEND:
- Menu.jsx: category tabs, product grid/list toggle, animated entrance
- Product cards: name, category badge, sizes/prices, active toggle,
  hover lift effect
- ProductModal.jsx: slide-in form, dynamic size/price rows,
  pizza-specific section (half toggle, crusts, extras),
  tax fields (collapsible)
- CategoryManager.jsx: drag-and-drop reorder, inline edit
- PizzaBuilder.jsx (3D): R3F cylinder base, colored topping shapes,
  visual split for meio-a-meio, slow rotation, ambient lighting
- TanStack Query with optimistic updates
```

---

### STEP 3 — Delivery Zone & Fee Management

```
Build delivery zone and fee management.

BACKEND:
- CRUD for /api/delivery/zones: GET, POST, PUT, DELETE, bulk import
- Delivery service:
  - lookup_zone(text): fuzzy match with pg_trgm (handles typos/accents)
  - calculate_fee(neighborhood): returns fee + estimated_minutes
  - is_within_delivery_area(neighborhood): bool
  - get_all_zones_formatted(): for GPT context

FRONTEND:
- Delivery.jsx: split layout (zone list + visual map)
- DeliveryZoneMap.jsx: SVG concentric circles, color-coded by fee,
  hover shows details, animated zone entrance
- FeeManager.jsx: sortable table, inline editing, bulk CSV import,
  search filter, slide-down add animation
- Stats bar: total zones, avg fee, min/max
```

---

### STEP 4 — Customer Management

```
Build customer management.

BACKEND:
- /api/customers: GET (paginated, search, sort), GET /:id (with orders),
  PUT /:id, GET /:id/orders
- Customer service:
  - find_or_create_by_phone(phone)
  - get_returning_customer_context(id): last order for repeat feature
  - update_address(id, address)

FRONTEND:
- Customers.jsx: list with avatar (initials), name, phone, order count,
  search with real-time filter
- CustomerProfile.jsx: slide-in panel, stats row (animated counters),
  address cards, order history timeline
- Subtle particle/bokeh effect in list header
```

---

### STEP 5 — Order Management + Dashboard

```
Build order management and real-time dashboard.

BACKEND:
- /api/orders: GET (filters: status, date, payment, customer; paginated),
  GET /:id, PUT /:id/status, GET /api/orders/stats
- WebSocket endpoint /api/orders/live: streams new_order, status_change
- Order service:
  - create_order(): validates items, calculates totals, status=received
  - next_order_number(): auto-increment per day (#001, #002)
  - update_status(): validates transitions, broadcasts WebSocket
- WebSocket ConnectionManager: tracks admin connections, auto-reconnect

FRONTEND:
- Orders.jsx:
  - Status tab filters with count badges
  - Order cards: number, customer, items preview, total, time,
    status badge, payment icon
  - Real-time: new orders slide in with pulse animation + sound
  - OrderDetail.jsx: full items, address, payment, status timeline,
    status advance buttons (touch-friendly, colored)
  - StatusUpdatePanel.jsx: large buttons for kitchen use

- Dashboard.jsx:
  - StatsCards.jsx: 4 cards with animated number counters
    (orders today, revenue, avg ticket, avg delivery time)
  - RevenueChart.jsx: Recharts area chart, 7-day, gradient fill
  - PeakHoursHeatmap.jsx: 7x24 grid color-coded by volume
  - LiveOrderFeed.jsx: real-time WebSocket feed
  - OrderGlobe.jsx (R3F): wireframe sphere, glowing dots for orders
  - ParticleBackground.jsx: floating warm particles behind stats
```

---

### STEP 6 — Meta WhatsApp Cloud API Integration + WhatsApp Engine

```
Build Meta WhatsApp Cloud API integration and message handling.

BACKEND:
- WhatsApp service (services/whatsapp.py):
  WhatsAppClient: send_text, send_interactive_buttons, send_interactive_list,
  send_media, send_template, download_media (via /v20.0/{media_id}),
  get_phone_number_status
  Retry logic, exponential backoff on Meta error codes, per-second rate limiting

- Webhook route POST /api/webhook/meta:
  Verify X-Hub-Signature-256 against WHATSAPP_APP_SECRET
  Handle GET verification challenge (hub.verify_token)
  Parse Meta webhook payload (entry[].changes[].value.messages[])
  Extract: phone (wa_id), text, media_id, button/list reply id
  Route to conversation handler
  Return 200 immediately, process async via Celery

- Conversation state manager (Redis):
  States: greeting, browsing_menu, building_order, collecting_address,
  collecting_payment, confirming, completed, human_takeover
  Cart in Redis as JSON, TTL 30 min inactivity
  get_state, set_state, clear_state

- Audio service: transcribe_audio via Whisper API,
  handles ogg/opus, fallback message on failure

FRONTEND:
- Settings > MetaWhatsAppConfig.jsx: phone_number_id, access token (masked),
  webhook URL display (copy button), Meta connection status indicator,
  approved templates list.
```

---

### STEP 7 — AI Conversation Engine (Core Bot Brain)

```
Build the AI conversation engine — the heart of the bot.

BACKEND:
- AI Engine (services/ai_engine.py):
  ConversationEngine.process_message(phone, text, is_audio):
  Gets state → calls GPT-4o with system prompt + context → parses
  response → executes actions → sends WhatsApp reply

  System prompt includes:
  - Personality: friendly Brazilian attendant, informal, natural
  - NEVER use numbered menus
  - Greet returning customers by name, offer repeat last order
  - Full cardápio injected dynamically
  - Delivery zones injected dynamically
  - Payment methods: PIX, Crédito, Débito, Dinheiro, Retirada
  - Current state + cart contents

  GPT-4o function calling tools:
  add_to_cart, remove_from_cart, set_delivery_address,
  set_payment_method, confirm_order, request_human_handoff,
  repeat_last_order, ask_clarification

  State transitions:
  greeting → browsing_menu → building_order → collecting_address →
  collecting_payment → confirming → completed
  any → human_takeover

- Order builder (services/order_builder.py):
  add_item, remove_item, get_cart_summary, calculate_totals,
  finalize_order (creates Order, triggers Datacaixa task)

- Handoff service: trigger_handoff (notify admin via WebSocket),
  release_handoff (return to bot)

FRONTEND:
- Conversations.jsx:
  ConversationList: active conversations, state badges, real-time
  ChatViewer: WhatsApp-style bubbles, audio waveform, cart sidebar
  HumanTakeover: text input for admin replies, "Return to Bot" button

- Settings > BotPersonality.jsx:
  Custom greeting, repeat-last-order toggle, working hours,
  max items, CPF toggle, TTS toggle
```

---

### STEP 8 — Datacaixa Integration (.txt Generator + Bridge)

```
Build Datacaixa .txt generator and Windows bridge app.

BACKEND:
- Datacaixa service (services/datacaixa.py):
  DatacaixaTxtGenerator:
  - generate_order_file(order_id): builds complete .txt content
  - format_pedido_line: PEDIDO|name|cpf|seller|observation|
    (observation = address, phone, neighborhood, mods)
  - format_item_line: ITEM|code|desc|price|qty|UN|NCM|total|
    CEST|CFOP|IBPT|CSOSN|origin|ibpt_code|
    Price format: Brazilian comma ("49,90")
  - format_delivery_fee_line: ITEM for TAXA DE ENTREGA
  - format_pgto_line: PGTO|code|total|
    Maps: pix→17, credit→03, debit→04, cash→01
  - get_next_file_number(): atomic counter, 8-digit zero-padded
  - File naming: ped_{number}.txt, UTF-8 encoding

- Bridge API (/api/bridge):
  GET /pending: orders with datacaixa_synced=false + .txt content
  POST /confirm/{id}: marks synced, stores filename
  GET /product-tax-data: all products with tax fields
  POST /heartbeat: bridge status tracking

BRIDGE APP (/bridge):
- bridge_service.py: polls /pending every 5s, writes .txt to
  Datacaixa folder, confirms via /confirm, heartbeat every 30s
- firebird_reader.py: reads BANCO.FDB (SYSDBA/masterkey),
  caches product tax data, refreshes every 6h
- config.ini: API URL, token, Datacaixa folder path, Firebird creds
- build.bat: PyInstaller → bridge.exe

FRONTEND:
- Settings > DatacaixaSync.jsx: bridge status (online/offline),
  sync counter, recent operations list, resync button, offline alert
```

---

### STEP 9 — Monitoring & Notifications

```
Build monitoring, error handling, notifications.

BACKEND:
- Global exception handler, structured logging
- Notification service: admin WhatsApp alerts for:
  bridge offline >5min, bot errors, sync failures, handoff requests,
  daily summary
- GET /api/health/detailed: checks postgres, redis, WhatsApp Cloud API,
  bridge, openai

DOCKER:
- Add Uptime Kuma: monitors all services, Telegram/email alerts

FRONTEND:
- Dashboard health widget: 4 status dots (API, WhatsApp, Bridge, DB),
  expandable details, pulse on red
```

---

### STEP 10 — Frontend Polish: 3D, Animations & Effects

```
Polish entire frontend with 3D, animations, visual effects.
Design: bright, modern, vibrant yet clean and sophisticated.

GLOBAL:
- ParticleBackground.jsx (R3F): warm orange particles, low opacity
- All page transitions: Framer Motion fade+slide, stagger children
- Glassmorphism cards: rgba bg, backdrop-filter blur, gradient border
- Loading: skeleton shimmer, CSS pizza spinner
- Color palette: bg #0F0F23, surface #16213E, primary #FF6B35,
  accent #FFD700, glass border rgba(255,255,255,0.12)

DASHBOARD 3D:
- OrderGlobe.jsx: wireframe sphere, glowing order dots, warm lighting
- StatsCards: animated count-up (useMotionValue), gradient border hover

LOGIN:
- Dark gradient bg, 3D rotating pizza (R3F torus + sphere toppings),
  warm point lights

CHARTS: animated entrance, gradient fills, glassmorphism tooltips

SIDEBAR: glowing active indicator, hover scale, smooth collapse

MICRO-INTERACTIONS: button scale on click, toggle slide, status pulse,
toast slide-in with progress, modal scale+fade with backdrop blur
```

---

### STEP 11 — Testing, Security & Deployment

```
Finalize with testing, security, deployment.

SECURITY:
- Rate limiting (slowapi): webhook 100/min, login 5/min, others 60/min
- CORS frontend-only, JWT 24h expiry + 7d refresh
- bcrypt passwords, SQLAlchemy ORM (no raw SQL)
- Webhook signature verification, env vars for all secrets

TESTING (pytest):
- Auth flow, menu CRUD, order creation + status transitions
- Datacaixa .txt format verification (encoding, pipes, commas)
- Delivery zone fuzzy matching, cart operations, half-pizza pricing
- Webhook parsing, conversation state transitions
- 80%+ coverage on services/

DEPLOYMENT:
- docker-compose.prod.yml: restart always, volume persistence
- Nginx: SSL (Certbot), proxy pass, WebSocket, gzip, security headers
- Backup: daily pg_dump, 7-day rotation
- Deploy script: ssh → git pull → docker compose up → migrate
- Frontend: Vite build with code splitting, gzip, no source maps
```

---

### STEP 12 — End-to-End Integration Test

```
Full end-to-end test simulating real pizzaria operation.

1. SETUP: all services running, menu seeded, zones configured,
   bridge connected, admin logged in

2. NEW CUSTOMER: "Oi boa noite" → bot greets → "quero uma pizza
   grande meia calabresa meia portuguesa com borda de catupiry"
   → bot parses correctly → "e uma coca 2 litros" → "fecha"
   → address → fee confirmed → "PIX" → order summary → "confirma"

3. ADMIN PANEL: order appears real-time, details correct,
   customer created, conversation visible

4. DATACAIXA: bridge picks up order, .txt written with correct
   format (PEDIDO|ITEM|ITEM|ITEM|PGTO|), UTF-8, comma decimals

5. RETURNING CUSTOMER: greets by name, offers repeat last order

6. AUDIO: voice message transcribed, order parsed correctly

7. HANDOFF: "quero falar com atendente" → transfer → admin replies
   → return to bot

8. ERRORS: nonsense → ask repeat, unavailable item → suggest alt,
   outside area → inform, bridge offline → alert, off-hours → auto-reply

Fix all issues before deployment.
```

---

## Milestone Delivery Map

| Milestone | Steps | Deliverable | Payment |
|-----------|-------|-------------|---------|
| M1 — Contratação | 1–3 | Scaffolding, DB, menu, delivery zones, Docker | R$ 3.000 (50%) |
| M2 — Bot Funcionando | 4–7 | Orders, AI bot, WhatsApp, customers, admin panel | R$ 1.800 (30%) |
| M3 — Integração Estável | 8–12 | Datacaixa, bridge, monitoring, polish, testing, deploy | R$ 1.200 (20%) |

---

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Bot framework | Custom FastAPI + GPT-4o (NOT n8n) | Client hated menu bots; n8n too rigid for complex pizza ordering state machine |
| WhatsApp | Meta WhatsApp Cloud API (official) | Meta-hosted, signed templates, no QR/session drift, free 1k service conversations/mo tier |
| POS integration | .txt file via bridge app | Only method Datacaixa supports (confirmed with their tech support) |
| AI model | GPT-4o (complex) + GPT-4o-mini (simple turns) | Cost optimization: ~70% of turns are greetings/confirmations |
| Audio | OpenAI Whisper API | Client specifically requested audio understanding |
| Tax data | Firebird DB on pizzeria PC (read-only) | Datacaixa requires full tax fields in every .txt |
| Admin panel | React.js + R3F + Framer Motion | Modern 3D-enhanced vibrant design |
| State mgmt | Redis conversation state | Fast, concurrent Saturday traffic, auto-expires |
| Deployment | Docker Compose on VPS | Simple, R$40-80/mo |

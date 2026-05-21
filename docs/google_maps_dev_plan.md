# Google Maps — phased development plan

Companion to `docs/google_maps_setup.md`. The setup guide gets the keys
created and validated; this plan defines what code changes ship in
what order to actually consume Google Maps inside the bot.

The plan is intentionally **phased** so each PR is independent,
reviewable, and reversible. Stop at any phase and the system stays
functional — Nominatim + Haversine remain wired as fallback paths.
Every phase has explicit acceptance criteria so "done" is unambiguous.

---

## Pre-flight checkpoint (already complete)

Before reading further, confirm these are in place — they are the
foundation every phase depends on:

- `pizzabot-planalto` project active in Google Cloud, with billing
  linked and the US$ 300 free-trial credit visible.
- Six APIs enabled: Geocoding, Places (legacy + New), Distance Matrix
  (or Routes), Maps JavaScript, Maps Static, Directions.
- Two API keys created with least-privilege restrictions:
  - `pizzabot-server-key` → IP restricted to `157.230.9.42`,
    restricted to 4–5 backend APIs.
  - `pizzabot-browser-key` → referrer restricted to
    `planaltopizzasesorvetes.com/*`, restricted to Maps JS + Places.
- Two budget alerts active in Cloud Billing (R$ 50 / R$ 280).
- Local `.env` populated with `GOOGLE_MAPS_SERVER_KEY` and
  `VITE_GOOGLE_MAPS_KEY` — both smoke-tested against the real Google
  endpoints and returning live data.

If any of those is missing, go back to `docs/google_maps_setup.md`
before starting Phase 0.

---

## Phase 0 — Foundation layer (skeleton, no user-visible change)

Goal: lay down the plumbing every later phase will import from, plus
a smoke-test script. After Phase 0, nothing in the UI or bot behavior
changes — only the internal code structure.

### What gets built

- New file `backend/app/services/google_maps.py` exposing four async
  functions: `geocode(address)`, `reverse_geocode(lat, lng)`,
  `distance_matrix(origin, destination)`, `directions(origin,
  destination)`. Each one:
  - Reuses the existing Redis cache pattern from
    `backend/app/services/geocode.py` (7-day TTL, SHA-1 cache key).
  - Returns a structured dict or `None` (never raises on Google
    errors — caller decides whether to fall back).
  - Logs the Google error envelope on any non-`OK` status, so issues
    are diagnosable from the backend log without enabling debug mode.
- Updated `backend/app/config.py` to read
  `GOOGLE_MAPS_SERVER_KEY` and expose it as
  `settings.google_maps_server_key: Optional[str]`. Optional by
  design — if unset, the new service module short-circuits to
  `None` and every caller naturally falls back.
- New script `scripts/verify_google.py` mirroring
  `scripts/verify_meta.py` byte for byte in structure: reads
  `.env`, hits each Google API the backend needs, prints PASS/FAIL
  per check, exits non-zero on any failure. This becomes part of
  the deploy smoke test.
- VPS deploy: copy the new env keys into `/opt/pizzabot/.env`,
  restart the backend container so it picks them up.

### Acceptance criteria

- `python3 scripts/verify_google.py` from the VPS exits 0 with all
  PASS lines.
- `curl http://127.0.0.1:8000/api/health` still returns `200` from
  the VPS — backend boots cleanly with the new code and the new env
  vars.
- Admin `/admin/customers` page still works as today (no regression
  from any frontend phase yet).

### Time estimate

Half a day, including write + test + deploy.

### Risk

Very low. The new service is pure addition with no integration into
any existing route. Worst case: revert the commit.

---

## Phase 1 — Address Autocomplete in customer portal

Goal: replace the manual address form on the customer-facing portal
with a single Places-Autocomplete input. Address typos and missing
data drop close to zero, lat/lng is captured at the point of entry
(eliminating the geocode-at-checkout step), and the customer's
perceived friction drops noticeably.

### Where the change lands

- `frontend/src/components/customers/AddressEditor.jsx` — replace
  the existing street + number + neighborhood + CEP inputs with a
  single `<AddressAutocomplete />` component plus a small read-only
  preview of the parsed result.
- `frontend/src/pages/customer/CustomerCheckout.jsx` — same swap on
  the checkout step.
- `frontend/src/pages/customer/CustomerAddresses.jsx` — same on the
  profile-level address management.
- New `frontend/src/services/maps.js` — lazy loader for the Google
  Maps JS SDK using `@googlemaps/js-api-loader`. Cached, idempotent,
  reads the key from `import.meta.env.VITE_GOOGLE_MAPS_KEY`. If the
  key is missing the loader resolves to `null` and the component
  renders the legacy manual form as fallback.
- New `frontend/src/components/customers/AddressAutocomplete.jsx` —
  wraps the new `PlacesAutocompleteElement` from the Places API
  (New). Restricts suggestions to Brazil and to a circle around the
  pizzeria (read from `bot_config.pizzaria_lat/lng`). Emits
  `onPick({ formatted, lat, lng, place_id, components })`.
- Backend `backend/app/models/customer.py` — the JSONB
  `addresses` column already exists; extend the per-address shape to
  include optional `lat`, `lng`, and `place_id` keys. No migration
  needed, JSONB tolerates new keys.

### Acceptance criteria

- A logged-in customer typing "Avenida Paulista" sees real Google
  predictions in the dropdown within 300 ms.
- Picking a prediction populates the form with the structured fields
  read-only, and saving the address persists `lat`, `lng`, and
  `place_id` in `customers.addresses`.
- A customer without the Google key set (dev environment or key
  outage) still sees the old manual form and can place an order —
  no broken UI.
- DB query confirms at least one new address row with non-null
  `lat`/`lng` after a real end-to-end checkout.

### Time estimate

One full day. The component itself is small; most of the time goes
into making the fallback path bulletproof.

### Risk

Medium. The fallback path has to be tested explicitly — easy to
build a great Google flow and leave the no-key path broken.

### Deploy

Standard `scripts/deploy.sh` (already validated for this repo).
Expect the nginx race documented in the project memory; one
`docker compose restart nginx` if it triggers.

---

## Phase 2 — Distance Matrix replaces Haversine in delivery fee

Goal: calculate delivery fees against real driving distance instead
of straight-line + detour factor. The bot stops over-charging
customers across the river (whose straight-line distance is short
but driving distance is long) and stops under-charging diagonal-cut
neighbors. Side benefit: real driving ETA becomes available for
"saiu pra entrega, chega em ~X min" templates.

### Where the change lands

- `backend/app/services/delivery.py` — function
  `calculate_fee_by_distance()` gains a Google branch. Order of
  attempts: (1) Google Distance Matrix with both customer coords
  and pizzeria coords, (2) Google geocode + Distance Matrix if the
  customer only sent an address string, (3) existing Haversine
  fallback. Return shape gains `eta_seconds: Optional[int]`.
- `backend/app/services/google_maps.py` — extend with a thin
  `distance_matrix_one(origin_latlng, dest_latlng)` helper that
  returns `(distance_meters, duration_seconds)`.
- New alembic migration `backend/alembic/versions/0022_delivery_zone_road_distance.py`:
  adds boolean column `delivery_zones.use_road_distance` with
  default `true`. Operator can set to `false` per zone if a Haversine
  calibration is preferred.
- `backend/app/schemas/delivery.py` — surface the new column.
- `frontend/src/components/delivery/DistanceDeliveryConfig.jsx` —
  add a toggle "Calcular por estrada (Google)" per zone, default on.

### Acceptance criteria

- An order placed with a customer address that has cached lat/lng
  (saved via Phase 1) reaches `calculate_fee_by_distance` and
  returns a `(fee, eta_seconds)` tuple where Google was used (verify
  by reading the `[delivery]` log line that logs the source —
  `google` or `haversine`).
- An order placed from a Phase-1-skipping flow (e.g. WhatsApp bot
  without geocoding) still computes a fee via Haversine.
- Manually toggling `use_road_distance` to `false` on a zone forces
  Haversine even when Google is available.
- The bot's "saiu pra entrega" message includes a real minutes
  count derived from `eta_seconds`, formatted like
  `~12 min` (template literal already in
  `docs/whatsapp_templates.md`).

### Time estimate

Half a day. Most of the work is the migration + the toggle UI.

### Risk

Low — the fallback is well established and the new path is wrapped
in `try/except` returning `None` on any Google error.

---

## Phase 3 — Visual map in the admin delivery configuration

Goal: turn the delivery-zone setup from a numeric form into a
visual one. Operator sees the pizzeria pin, concentric circles
for each fee band, and the last 50 order locations as small dots.
Decisions like "should I extend coverage by 1 km?" become a
two-second visual check.

### Where the change lands

- `frontend/src/components/delivery/DistanceDeliveryConfig.jsx` —
  add a `<DeliveryZoneMap>` panel above the band list.
- New `frontend/src/components/delivery/DeliveryZoneMap.jsx` —
  loads Maps JS via the loader from Phase 1, renders:
  - A `google.maps.Marker` for the pizzeria, `draggable: true`.
    On `dragend`, posts the new lat/lng to `/api/settings` (the
    `0021_pizzaria_geo` migration already provides the columns).
  - One `google.maps.Circle` per band with `radius =
    distance_max_km * 1000` and a `fillColor` graded by band index
    (lightest → cheapest, darkest → most expensive).
  - One faint marker per row of recent orders (read from a new
    `GET /api/orders/recent-locations?limit=50` endpoint).
- New backend route `backend/app/api/routes/orders.py` →
  `recent_locations()`: returns `[{lat, lng, order_id, created_at}]`
  for completed orders with non-null coordinates in the last 30 days.

### Acceptance criteria

- The admin user opening the delivery config sees the map within
  1.5 seconds (lazy-loaded SDK).
- Dragging the pizzeria marker and dropping it updates the lat/lng
  shown in the numeric fields below the map AND persists to the DB
  (verifiable by refreshing the page and seeing the new position).
- Circles redraw automatically when the operator edits a band's
  `distance_max_km`.
- If `VITE_GOOGLE_MAPS_KEY` is unset the map panel collapses to a
  gentle "Configure Google Maps to enable visual map" notice and the
  numeric form keeps working.

### Time estimate

One day. Map UI is straightforward; the operator-feedback details
(snap to address suggestion on drop, smooth zoom on band edit) are
the time sink.

### Risk

Low — pure admin feature. No customer impact even if it breaks.

---

## Phase 4 — WhatsApp location pin → structured address

Goal: when a customer sends a location pin from WhatsApp (the paperclip
→ Location button), the bot recognizes it, reverse-geocodes to a real
address, and offers a one-tap confirmation. Replaces the friction of
typing an address — the single biggest reason new customers abandon
the first order.

### Where the change lands

- `backend/app/services/conversation_state.py` (or wherever the
  webhook payload dispatch lives — check the handler that pivots on
  `messages[0].type`) — add a `"location"` branch.
- On `"location"` messages, extract `latitude` / `longitude` from
  the payload, call `services.google_maps.reverse_geocode(lat, lng)`,
  then `services.google_maps.distance_matrix_one(pizzeria, customer)`
  to get fee + ETA in one round trip.
- Reply with an interactive WhatsApp button message: header is the
  formatted address, body is "É aqui que você está? Taxa de entrega:
  R$ X · chega em ~Y min", buttons `[Sim, é aqui]` and `[Não, mando
  por texto]`.
- On `[Sim, é aqui]`, store the resolved address into the customer's
  `addresses` JSONB and continue the order flow at the same step the
  manual-address path lands on.
- On `[Não, mando por texto]`, ask for the address as today.

### Acceptance criteria

- A test message with a real location pin reaches the bot and gets
  a button-message reply in under 5 seconds.
- Clicking `[Sim, é aqui]` saves an address row with the lat/lng
  from the pin AND the formatted address from reverse geocode.
- The conversation transitions to the next state (e.g. menu
  presentation) seamlessly — no orphan step.
- A location pin that reverse-geocodes outside the delivery radius
  responds with "Infelizmente esse endereço está fora da nossa
  área" — same wording the address-by-text path uses.

### Time estimate

Half a day. The reverse-geocode plumbing is trivial; integrating
into the conversation state machine takes longer.

### Risk

Medium — touches the conversation state machine which is sensitive.
Mitigation: add a behind-flag toggle `BOT_LOCATION_PIN_ENABLED` so
the new path can be disabled without redeploy if it misbehaves.

---

## Phase 5 — Static map on the order tracking page

Goal: customer opens the tracking page mid-delivery and sees a map
with pizzeria pin + their pin + drawn route between them. Not
real-time tracking (would require driver app), just visual confidence
that the order is on its way. Reduces "cadê meu pedido?" pings on
WhatsApp by giving customers something to look at.

### Where the change lands

- New backend route in `backend/app/api/routes/customer/track.py`
  → `GET /api/customer/track/{order_id}/route-image`. Returns
  `{url, expires_at}` where `url` is a signed Static Maps URL
  carrying both markers and a `path=` with the polyline returned by
  `services.google_maps.directions()`. Cached in Redis for 30
  minutes per order_id.
- `frontend/src/pages/customer/CustomerTrack.jsx` — conditionally
  render `<img src={routeImageUrl} alt="Rota do pedido" />` when
  the order status is `out_for_delivery`. Skeleton placeholder
  while fetching.

### Acceptance criteria

- A test order moved to `out_for_delivery` status, opened on the
  tracking page, shows a static map image with both pins and a
  polyline within 2 seconds of page load.
- Refreshing the page within 30 minutes serves the cached URL (no
  duplicate Google billing).
- Orders not in `out_for_delivery` status hide the map component
  entirely — no broken-image icon.

### Time estimate

Half a day.

### Risk

Very low. Worst case: missing image → component hides itself.

---

## Total: ~3.5 days of focused dev to ship all five phases

Order of priority if dev capacity is constrained:

1. **Phase 1** first — addresses are the single biggest source of
   failed deliveries. Highest ROI per dev hour.
2. **Phase 2** second — small backend swap, directly improves fee
   fairness and unlocks accurate ETA messaging.
3. **Phase 4** third — high impact per low cost, removes the first-
   order abandonment cliff.
4. **Phase 3** fourth — nice-to-have operator tool, not customer-
   facing.
5. **Phase 5** last — cosmetic. Defer indefinitely if other priorities
   surface.

Phase 0 is the prerequisite for all of the above and must ship before
any of them.

---

## Out of scope (intentionally not addressed)

- **Real-time driver location tracking.** Requires a separate driver
  app with GPS sharing, websocket backend, and consent flows. Use
  WhatsApp for "vou aí em 5 min" from the moto until that builds.
- **Google Reviews / Place details on the marketing site.** Possible
  with Places API but belongs on the institutional site, not the
  ordering bot.
- **Replacing Nominatim entirely.** Keeping both with Google as the
  primary is more resilient at zero extra cost.
- **Maps Embed API.** Static images (Phase 5) cover the same need
  cheaper.

---

## Operational notes

- Every phase that calls Google from the backend uses the same Redis
  cache. Verify cache hit rate weekly with `redis-cli --scan
  --pattern 'gmaps:*' | wc -l` versus total geocode + distance calls
  in logs. Expect 80%+ hit rate after one week of traffic — that's
  what keeps the bill near zero.
- Budget alerts are already configured. If the R$ 50 alert fires,
  treat it as a code review trigger, not a billing emergency — it
  fires far before any real charge.
- Each phase ships independently. PRs should be one-phase-per-PR for
  clean revert paths. Tag commits with `feat(maps-phase-N): ...` so
  the rollout is greppable in `git log`.
- `scripts/verify_google.py` runs as part of the deploy smoke check
  alongside `scripts/verify_meta.py`. If either fails, the deploy
  script should refuse to restart the backend container (TODO: wire
  this into `scripts/deploy.sh` in Phase 0).

---

## Ready to start

Phase 0 is the next concrete unit of work. When you give the go-ahead,
I will:

1. Create `backend/app/services/google_maps.py` with the four async
   wrappers, all using the existing Redis cache pattern.
2. Add `google_maps_server_key` to `backend/app/config.py` and update
   `.env.example` if needed.
3. Write `scripts/verify_google.py` mirroring `scripts/verify_meta.py`.
4. Copy the keys into `/opt/pizzabot/.env` on the VPS.
5. Deploy via `scripts/deploy.sh`, run the new verify script, confirm
   PASS, and check that no existing route regressed.

Estimated turn-around: half a day. After that, Phase 1 unlocks.

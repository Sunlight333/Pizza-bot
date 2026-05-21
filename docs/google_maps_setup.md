# Google Maps Platform — key provisioning guide

Operator playbook for creating the Google Maps keys that Pizzabot will
consume (Geocoding, Distance Matrix, Places Autocomplete, visual maps
in the admin panel, and the order-tracking page). Written to be
followed without prior Google Cloud experience — every step lists
what to click, what NOT to click, and the signal that it worked.

Important premise: you do **not** need to pay a monthly subscription.
Google Maps Platform ships with a recurring **US$ 200/month credit**
that comfortably covers the traffic of a neighbourhood pizzeria. A
credit card is required only to enable billing — you only get charged
if the free credit is exhausted, and we configure alerts long before
that can happen.

Repo references used throughout this guide:
- New Google service module → `backend/app/services/google_maps.py` (to be created)
- Existing geocoder (kept as fallback) → `backend/app/services/geocode.py`
- Key configuration → `backend/app/config.py` + `.env`
- Frontend loader (to be created) → `frontend/src/services/maps.js`

---

## Prerequisites (5 min)

Before opening Google Cloud, make sure you have:

- An active Google account (a regular Gmail works). Recommended: use the
  same account as the business (`poorwoman704@gmail.com`) so everything
  shares one owner.
- A valid credit card accepted internationally (any Visa/Mastercard
  works, including virtual cards from Nubank/Inter).
- The fixed production VPS IP at hand: `157.230.9.42`.
- The domain that serves the frontend: `planaltopizzasesorvetes.com`
  (plus the admin/bot subdomain if separate — check the nginx config).

---

## Step 1 — Create the project in Google Cloud Console

Open `https://console.cloud.google.com/` while logged in.

At the top of the page, just to the right of the "Google Cloud" logo,
there is a project picker (usually shows "Select a project" or the name
of some old project). Click it → in the popup, click **NEW PROJECT** in
the upper-right corner.

Fill in:
- **Project name:** `pizzabot-planalto` (or similar — this name is just
  for you to recognize the project, it is never shown to customers).
- **Organization:** leave as `No organization` unless you have a Google
  Workspace organization.
- **Location:** `No organization` (default).

Click **CREATE** and wait ~30 seconds. A toast in the upper-right
corner notifies you when the project is ready.

After creation, **go back to the project picker at the top and select
the newly created project**. This is a common mistake: people create
the project and forget to select it, so every next step goes to the
wrong project.

Signal it worked: `pizzabot-planalto` appears at the top, next to the
Google Cloud logo.

---

## Step 2 — Enable billing (credit card)

In the left sidebar (☰ in the upper-left corner), go to **Billing**. If
you see "This project has no billing account", click **LINK A BILLING
ACCOUNT**.

If you don't have a billing account yet (first time on Google Cloud),
the system pushes you to a form to create one:

- **Account type:** `Individual` (simpler; `Business` requires a CNPJ).
- **Name and address:** your personal or business details.
- **Payment method:** credit card. Google places a R$1 hold to validate —
  released in ~3 business days.

Important: **on the final screen, an offer for "Free Trial — US$ 300
in credits over 90 days" appears**. Accept it. This credit is separate
from the recurring US$ 200/month Maps Platform credit; treat it as an
initial bonus.

Once the account is created, go back to your `pizzabot-planalto`
project and link it.

Signal it worked: under **Billing → Overview**, the account name and
free-trial balance are visible.

---

## Step 3 — Enable the specific APIs the bot will use

Each Google Maps product (Geocoding, Distance Matrix, etc.) is a
**separate API** that must be enabled individually. If you forget to
enable one, every call to that API returns `REQUEST_DENIED` with the
message "API has not been used in project".

In the left sidebar: **APIs & Services → Library**.

In the search bar, locate and enable each of the following, one at a
time, by clicking the blue **ENABLE** button:

- **Geocoding API** — converts address → lat/lng (Phases 1 and 4 of
  the rollout plan).
- **Places API** + **Places API (New)** — enable both. The "New" one
  is what modern Autocomplete uses; the legacy one is for a few
  fallback clients we may still consume (Phase 1).
- **Distance Matrix API** — driving distance and ETA between two
  points (Phase 2). Note: Google has recently merged Distance Matrix
  and Directions into a unified **Routes API**. If you don't find
  "Distance Matrix" as a standalone product, enable **Routes API**
  instead — it covers both use cases.
- **Maps JavaScript API** — required for any visual map in the
  frontend (Phase 3).
- **Maps Static API** — generates PNG map snapshots with pins and
  drawn routes (Phase 5).
- **Directions API** — computes the route drawn on the static map
  (Phase 5). Skip this if you enabled Routes API above.

Do NOT enable anything you won't use yet — e.g. "Roads API", "Time Zone
API", "Elevation API" — to keep cost tracking clear.

Signal it worked: under **APIs & Services → Enabled APIs & Services**,
all required products are listed with status "Enabled".

---

## Step 4 — Create the server key (backend)

Go to **APIs & Services → Credentials**.

Click **+ CREATE CREDENTIALS** at the top → **API key**.

A popup shows the freshly generated key (something like
`AIzaSyB...REDACTED...0xY`). **Don't copy it yet** — click the
**EDIT API KEY** link inside the popup to enter the configuration
screen.

Configure:

- **Name:** `pizzabot-server-key` (so you can identify it later).
- **Application restrictions:** select **IP addresses**. Add the VPS
  IP: `157.230.9.42`. If you have a staging server, add its IP as
  well. Any IPv6 addresses your VPS exposes go in the same list.
- **API restrictions:** select **Restrict key**. In the dropdown, pick
  only: `Geocoding API`, `Distance Matrix API` (or `Routes API`),
  `Directions API`, `Places API`, `Places API (New)`. **Do NOT**
  include Maps JavaScript or Maps Static — the backend does not call
  those.

Click **SAVE**. Back on the Credentials page, click the copy icon on
the key's row. Save it in a password manager — you need it in Step 8.

---

## Step 5 — Create the browser key (frontend)

Same screen: **+ CREATE CREDENTIALS → API key** again.

EDIT API KEY → configure:

- **Name:** `pizzabot-browser-key`.
- **Application restrictions:** select **Websites**. Under "Website
  restrictions", click **ADD** and add one entry per line:
  - `https://planaltopizzasesorvetes.com/*`
  - `https://www.planaltopizzasesorvetes.com/*`
  - `https://bot.planaltopizzasesorvetes.com/*` (if that's the admin
    or customer-portal subdomain — check the nginx config)
  - `http://localhost:5173/*` (for local development; remove later if
    you want to lock it down)
- **API restrictions:** select **Restrict key**. Pick only: `Maps
  JavaScript API`, `Places API`, `Places API (New)`. Do NOT include
  Geocoding / Distance Matrix / Directions — the browser must never
  call those directly (they would be exposed in DevTools).

Why two separate keys: the browser key is embedded in the JavaScript
bundle served by Vite, and anyone who opens DevTools can see it. With
referrer + API restrictions in place, even if someone steals the key,
they can only load a map on their own domain — they cannot drain your
Geocoding quota.

---

## Step 6 — Configure budget alerts (surprise-bill protection)

This step prevents bill shock. Without it, if a new phase consumes
more than expected, you only find out at the end of the month.

In the left sidebar: **Billing → Budgets & alerts → CREATE BUDGET**.

Configure:

- **Name:** `Maps spending guard`.
- **Time range:** `Monthly`.
- **Projects:** select only `pizzabot-planalto`.
- **Services:** select only the Maps services you enabled. If you leave
  "All services", it includes any other Google Cloud product you might
  use later — not what we want here.
- **Budget amount:** `Specified amount` → **US$ 50**. (Free tier is
  US$ 200 — this alert fires long before the credit is gone.)
- **Actions:** check all three boxes for 50%, 90%, and 100% of the
  budget. Add `poorwoman704@gmail.com` to "Email alerts to billing
  admins and users".

Click **FINISH**.

I also recommend creating a **second budget** at **US$ 150** with the
same alerts — that gives you two "defensive rings". If one fails (spam
filter, etc.), the other catches it.

Signal it worked: in the budgets list, both show status "Active".

---

## Step 7 — Save the keys in the project

On the VPS, edit `/opt/pizzabot/.env` and append:

    # Google Maps Platform
    GOOGLE_MAPS_SERVER_KEY=AIzaSyB...<paste the server key here>
    VITE_GOOGLE_MAPS_KEY=AIzaSyC...<paste the browser key here>

Why two variables: the backend reads `GOOGLE_MAPS_SERVER_KEY` for
server-to-server calls (Geocoding, Distance Matrix, Directions). Vite
reads `VITE_GOOGLE_MAPS_KEY` at build time and injects it into the
React bundle — Vite only exposes variables prefixed with `VITE_` to the
browser. Different prefix, different purpose, different restrictions in
Google Cloud.

In your local development `.env` (`/home/don/Pictures/Pizza/.env`), do
the same — optionally with a third, dev-dedicated key (created by
repeating Step 4 with your laptop's IP, or with "None" temporarily) so
you don't conflict with production.

**Never commit `.env` to git.** Verify it is gitignored:
`git check-ignore .env` should return `.env`.

---

## Step 8 — Smoke check (confirm the keys actually work)

Before shipping any feature in the plan, validate that the keys
respond. From the VPS, run:

    curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=Avenida+Paulista+1000+Sao+Paulo&key=$GOOGLE_MAPS_SERVER_KEY" | head -c 200

The expected output starts with `{ "results": [ {` and contains
`"status": "OK"`. If you get `"status": "REQUEST_DENIED"`, the key is
misconfigured (most likely the Geocoding API wasn't enabled, or the
VPS IP isn't in the restriction list).

To test the browser key, open the customer portal in a browser, open
DevTools console, and paste:

    fetch('https://maps.googleapis.com/maps/api/js?key=' + import.meta.env.VITE_GOOGLE_MAPS_KEY).then(r => console.log(r.status))

It should print `200`.

Recommended: create `scripts/verify_google.py` mirroring
`scripts/verify_meta.py`, testing both keys against every enabled API
and reporting PASS/FAIL — same structure, same message format. I can
build that when we start Phase 1.

---

## Expected cost per phase (quick reference)

To inform which phase to ship first, here's the estimated monthly cost
per API at the pizzeria's scale (~100 orders/day, reusing the 7-day
Redis cache already in `geocode.py`):

- Phase 1 (Places Autocomplete): ~US$ 6/month after cache.
- Phase 2 (Distance Matrix): ~US$ 5/month after cache.
- Phase 3 (Maps JS in admin): pennies (operator-only access).
- Phase 4 (Reverse Geocode of WhatsApp location pin): negligible (~US$ 0.05/month).
- Phase 5 (Static Maps + Directions): ~US$ 5/month.

Aggregate total: ~US$ 15–20/month. The free credit covers 10× that, so
the expected real bill during the first year of operation is **zero**.
The US$ 50 alert only fires if something has gone very wrong (e.g. a
loop calling Geocoding without cache).

---

## Troubleshooting (common issues)

**`REQUEST_DENIED` even with a valid-looking key:** it is almost always
one of three things — the API isn't enabled in the project (go back to
Step 3), the IP/domain restriction is blocking the call, or billing
wasn't activated. The `error_message` field of the JSON response
usually says which.

**`OVER_QUERY_LIMIT`:** rare on the free tier. If you see it, suspect
a loop in the code (some function calling Geocode on every render).
Check the backend logs to identify the noisy route.

**`ZERO_RESULTS` on a Brazilian address:** Google beats Nominatim but
isn't perfect on very new developments. The Nominatim fallback in
`geocode.py` covers that case. If neither finds it, the bot has a
flow to ask the customer to send a location pin (Phase 4).

**Browser key suddenly stops working:** check **APIs & Services →
Credentials → pizzabot-browser-key**. Google auto-disables keys when
it detects abuse. Also check **APIs & Services → Quotas** for the
current limit (defaults start low; raising them is a normal request).

**Billing account suspended:** happens when the card expires or is
declined. Everything stops immediately, with no advance notice. Keep
**Payment methods** current under Billing.

---

## Final checklist

Before considering this step complete, confirm:

- [ ] `pizzabot-planalto` project created and selected at the top of the console.
- [ ] Billing active, with a valid card and visible free-trial balance.
- [ ] All required APIs enabled under "Enabled APIs & Services".
- [ ] `pizzabot-server-key` created, restricted by VPS IP, restricted to the backend APIs (Geocoding, Distance Matrix or Routes, Directions, Places).
- [ ] `pizzabot-browser-key` created, restricted by portal domain, restricted to the frontend APIs (Maps JS, Places).
- [ ] Two budget alerts created (US$ 50 and US$ 150).
- [ ] Keys saved in the VPS `.env` (`GOOGLE_MAPS_SERVER_KEY` and `VITE_GOOGLE_MAPS_KEY`).
- [ ] `curl` smoke test returned `"status": "OK"`.
- [ ] `.env` was NOT accidentally committed (`git status` clean).

With those eight boxes ticked, the environment is ready. From here,
any phase of the rollout plan (see `docs/PIZZABOT_DEVELOPMENT_PLAN.md`
or the in-conversation summary) is just a code change — no more trips
to the Google Cloud Console.

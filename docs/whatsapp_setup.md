# WhatsApp Cloud API — remaining setup (Pizzaria Planalto)

Operator playbook for the WhatsApp Cloud API work that's **still open
as of 2026-05-19**. Everything Meta has confirmed complete (accounts,
verification, system-user token, webhook + handshake, `messages`
field subscription, Cloud API terms acceptance, payment method,
App Mode → Live) has been removed from this doc — re-running those
steps would either no-op or break a working install. Re-add a section
only if Meta's API shows that step regressing.

What the API currently reports for `393616145927879`:
- `code_verification_status: NOT_VERIFIED` ← the one hard blocker left
- `is_pin_enabled: false`
- `WABA.can_send_message: AVAILABLE` (Phase 5 done — payment cleared
  the `141006` error)
- `APP.can_send_message: AVAILABLE`, no webhook-subscription warning
  (Phase 3 done)
- `quality_rating: GREEN`, `name_status: AVAILABLE_WITHOUT_REVIEW`
- WABA currency: **USD** (not blocking, but BRL would save FX cost)
- Address: empty (not blocking, but App Review asks for it)
- Templates: `{"data":[]}` ← zero submitted

Repo references throughout:
- Backend client → `backend/app/services/whatsapp.py`
- Webhook handler → `backend/app/api/routes/webhook.py`
- Env reader → `backend/app/config.py`
- Template bodies → [`whatsapp_templates.md`](whatsapp_templates.md)
- Prod env file → `/opt/pizzabot/.env` on `157.230.9.42`

Every `curl` example below assumes you've exported these shell vars
from the VPS `.env`:

```bash
ssh root@157.230.9.42
cd /opt/pizzabot
export TOK=$(grep ^META_ACCESS_TOKEN= .env | cut -d= -f2-)
export PID=$(grep ^META_PHONE_NUMBER_ID= .env | cut -d= -f2-)
export WABA=$(grep ^META_WABA_ID= .env | cut -d= -f2-)
export VER=$(grep ^META_GRAPH_VERSION= .env | cut -d= -f2-)
export BASE="https://graph.facebook.com/$VER"
```

---

# What to do now

The two items below are the only remaining gates on production
messaging. **Order matters — do Phase 4 first.** Meta gates template
management (Phase 6) behind a registered, PIN-enabled phone; trying
to submit a template before Phase 4 returns
`error_subcode 2494160: "WABA not allowed to manage templates"` even
though the dashboard UI lets you fill the form. Discovered 2026-05-19
on this account.

---

## 1. Register the phone with a 2FA PIN (Phase 4)

### What this step actually does

The `/register` call binds your phone number into Meta's Cloud API
infrastructure and turns on WhatsApp's two-step verification (2FA)
for that number. Until this call succeeds, the phone is in a
half-configured state where:

- `code_verification_status` reports `NOT_VERIFIED`.
- `is_pin_enabled` reports `false`.
- Any `POST /v22.0/{phone_id}/messages` call fails — the bot cannot
  actually send WhatsApp messages.
- The WhatsApp Manager template editor accepts the form but the API
  rejects every submission with `error_subcode 2494160`
  ("WABA not allowed to manage templates"). This is the trap from
  2026-05-19: the dashboard UI doesn't reflect the gate, so it looks
  like the template submission "almost worked".
- The "Status" column in WhatsApp Manager → Phone Numbers shows
  *Offline*.

After a successful `/register`, all four of those flip simultaneously.
There's no second confirmation step Meta sends to the phone — no SMS,
no voice call. The call is one-shot and idempotent (re-running with
the same PIN is harmless).

### Prerequisites (all currently true on this account)

These must be in place or `/register` fails with a different error:

- **Cloud API terms accepted** — already done; otherwise `/register`
  returns `(#200) You must accept the WhatsApp Business Cloud API
  terms`. (Acceptance was implicit when the payment method landed.)
- **Phone added to the WABA** — already done; the
  `META_PHONE_NUMBER_ID` in `.env` resolves on the Graph API.
- **System-user token with `whatsapp_business_management` scope** —
  already done; the token in `META_ACCESS_TOKEN` debug-checks clean.
- **Display name approved (`name_status = AVAILABLE_WITHOUT_REVIEW`)** —
  already done.

### Choosing the PIN

It's 6 digits. Treat it as a long-lived secret — there's no expiry,
it doesn't rotate, and resetting it requires a Meta Support ticket
(see "If you lose the PIN" below). Specifically:

- **Don't use anything Meta can refuse.** Sequential digits
  (`123456`, `654321`), all-same (`111111`), or birthdays / common
  PINs from leaked-credentials lists are sometimes rejected.
- **Don't reuse your card PIN, banking PIN, or account-recovery PIN.**
  Meta employees can read this if you ever open a Support ticket.
- **Random is best.** Generate with:
  ```bash
  awk 'BEGIN{srand(); printf "%06d\n", int(rand()*1000000)}'
  ```

### Storing the PIN

**Before** you run the call, paste the PIN into Bitwarden or 1Password
under an entry named something like *"WhatsApp Cloud API 2FA PIN —
Pizzaria Planalto +55 17 99128-9777"*. Include in the entry:

- The PIN itself.
- The phone number it belongs to (so you don't confuse it with another
  WABA later).
- The date set (so an old PIN noted in a stale entry doesn't look
  current).
- The Meta phone-number-id (`393616145927879`) — Support will ask for
  it during recovery.

Reason: if the PIN is lost and the WABA ever needs re-registration
(after a port-out, after a Meta-side number reset, after a Support
intervention), the only recovery path is opening a Support ticket and
proving ownership of the business. That process takes 3–10 business
days, during which the bot cannot send any messages.

### The `/register` call, parameter by parameter

```bash
curl -s -X POST -H "Authorization: Bearer $TOK" \
  "$BASE/$PID/register" \
  -d "messaging_product=whatsapp" \
  -d "pin=YOUR_6_DIGIT_PIN"
```

- `$BASE/$PID/register` — Graph API endpoint
  `https://graph.facebook.com/v22.0/393616145927879/register`. The
  PID and version come from the shell vars exported at the top of
  this doc.
- `Authorization: Bearer $TOK` — the system-user token. The token
  needs `whatsapp_business_management` scope (already true).
- `messaging_product=whatsapp` — fixed string. Meta requires this
  even though it's redundant for a Cloud API endpoint.
- `pin=YOUR_6_DIGIT_PIN` — replace literally before running. Keep
  the rest of the call exactly as shown.

Why curl and not the dashboard: WhatsApp Manager hides 2FA setup in
different places per account variant (sometimes under Phone Numbers →
Two-step verification, sometimes inside an overflow menu, sometimes
not visible at all on newer accounts like this one). The API call is
the same on every account.

### Expected response

Success:
```json
{"success": true}
```

That's it — no PIN echoed back, no confirmation token. Meta does not
re-display the PIN you just set, ever. If you didn't store it before
the call, you don't have it now.

### Failure modes

If you see one of these instead of `{"success": true}`, here's what
each means and how to fix it:

- **`(#100) Invalid parameter, error_subcode 2388092` "Invalid PIN
  format"** — PIN wasn't six digits. Re-run with a strictly numeric,
  exactly-6-digit string.
- **`(#100) Invalid parameter` mentioning "weak PIN"** — Meta
  refused the PIN as too common. Generate a random one and retry.
- **`(#200) You must accept the WhatsApp Business Cloud API terms`** —
  shouldn't happen on this account (terms are accepted), but if it
  does, open WhatsApp Manager → Overview → Alerts and look for the
  terms checkbox.
- **`(#133005) Two-step verification PIN mismatch`** — there's
  already a PIN on this number from a previous registration. Either
  supply that old PIN (Meta accepts the same PIN as a no-op re-register)
  or run the 60-second reset:
  ```bash
  curl -s -X POST -H "Authorization: Bearer $TOK" "$BASE/$PID/deregister"
  ```
  then re-run `/register` with the new PIN.
- **`(#190) Invalid OAuth access token`** — `META_ACCESS_TOKEN` is
  expired, revoked, or has the wrong scopes. Regenerate the
  system-user token from Business Settings → System Users.
- **`(#10) Permission denied`** — the token's user doesn't have
  admin rights on this WABA. Re-assign the system user with full
  control over the WABA asset in Business Settings.

### Verifying it took

Three places to confirm — check at least the first two:

1. **Graph API** (authoritative — dashboards lag by 30–90 seconds):
   ```bash
   curl -s -H "Authorization: Bearer $TOK" \
     "$BASE/$PID?fields=code_verification_status,is_pin_enabled,name_status,quality_rating" \
     | python3 -m json.tool
   ```
   Expect:
   ```json
   {
     "code_verification_status": "VERIFIED",
     "is_pin_enabled": true,
     "name_status": "AVAILABLE_WITHOUT_REVIEW",
     "quality_rating": "GREEN",
     ...
   }
   ```

2. **`health_status` on the phone** — the additional_info field
   under the `PHONE_NUMBER` entity drops the "Your display name has
   not been approved yet" warning (slightly misleadingly worded by
   Meta — that string is really about the messaging tier, which
   re-evaluates after registration):
   ```bash
   curl -s -H "Authorization: Bearer $TOK" "$BASE/$PID?fields=health_status"
   ```

3. **WhatsApp Manager UI** — the *Status* column in
   Phone Numbers flips from *Offline* to *Connected*. Refresh the
   page; the dashboard caches state for ~1 minute.

### What unlocks after a successful Phase 4

- **Template management** — the `error_subcode 2494160` on
  `POST /{waba}/message_templates` is gone. The WhatsApp Manager
  template editor accepts submissions for real. This is the immediate
  unblocker for the `otp_login_code` submission you started.
- **`/messages` sending** — the bot can finally send real text,
  audio, image, and (once approved) template messages.
- **Test send from your own phone** — once Phase 6 templates are
  approved or even for plain text inside a 24h window, you can
  immediately verify with:
  ```bash
  curl -s -X POST -H "Authorization: Bearer $TOK" "$BASE/$PID/messages" \
    -H "Content-Type: application/json" \
    -d '{"messaging_product":"whatsapp","to":"5517991050473",
         "type":"text","text":{"body":"ping from prod"}}'
  ```
  (replace the `to` with a number that has messaged the bot in the
  last 24 hours).

### If you lose the PIN later

Two recovery paths, in increasing order of pain:

1. **You still have the system-user token** — call `/deregister`
   then re-`/register` with a fresh PIN. Bot sending stops for the
   ~10 seconds in between and resumes immediately:
   ```bash
   curl -s -X POST -H "Authorization: Bearer $TOK" "$BASE/$PID/deregister"
   curl -s -X POST -H "Authorization: Bearer $TOK" \
     "$BASE/$PID/register" \
     -d "messaging_product=whatsapp" \
     -d "pin=NEW_6_DIGIT_PIN"
   ```
2. **You also lost the system-user token** — open a Meta Business
   Support ticket at `business.facebook.com/business/help`. You'll
   need CNPJ documents, the WABA id (`100288279321420`), and the
   phone number id (`393616145927879`). Expect 3–10 business days
   downtime.

Both paths are why the PIN belongs in your password manager today,
not in a notebook.

---

## 2. Submit the four message templates (Phase 6)

This is the long pole because each submission needs 1–24h of Meta's
review time. Start now.

Open `https://business.facebook.com/wa/manage/message-templates/` and
submit all four templates in one sitting. Bodies, names, categories,
sample values and button settings are in
[`whatsapp_templates.md`](whatsapp_templates.md):

- `otp_login_code` — Authentication
- `admin_alert` — Utility
- `handoff_customer_wait` — Utility
- `order_status_update` — Utility (future, not wired yet)

While templates are `IN_REVIEW`, the code falls back to freeform
`send_text` — which only works inside the 24h customer-service
window. That's fine for dev but fails silently for portal OTPs and
out-of-hours admin alerts in production.

When Meta marks a template `APPROVED`, paste the exact (case-sensitive,
snake_case) name into the matching `META_TEMPLATE_*` line in
`/opt/pizzabot/.env`, then restart the backend so it picks up the
value:

```bash
ssh root@157.230.9.42
cd /opt/pizzabot
nano .env                 # e.g. META_TEMPLATE_OTP=otp_login_code
docker compose -f docker-compose.prod.yml restart backend
```

**Verify Phase 6:**
```bash
curl -s -H "Authorization: Bearer $TOK" \
  "$BASE/$WABA/message_templates?fields=name,status,category,language&limit=50" \
  | python3 -m json.tool
```
Expect four templates with `status: APPROVED` (or `IN_REVIEW` while
waiting). Match each `name` against the matching `META_TEMPLATE_*`
line on the VPS and confirm they agree exactly.

---

# Optional cleanups (not blocking, but worth doing)

## Change WABA currency from USD to BRL

Your card and revenue are in BRL but the WABA is denominated in USD,
so every Meta invoice will incur an FX spread + IOF tax (~6% combined)
when your Brazilian card issuer converts the charge. Fix:

Business Settings → WhatsApp Accounts → Pizzaria Planalto → Summary →
**Edit** next to "Business information" → Currency: **BRL** → Save.

Do this before Meta charges the card for the first invoice so the
first bill is already in BRL. No API verify — the Summary tab is
authoritative.

## Fill in the business address

Business Settings → WhatsApp Accounts → Pizzaria Planalto → Summary
currently shows `Address: No address`. Click **Edit** and fill in the
CNPJ-registered address (São José do Rio Preto, SP). This isn't
gating any message flow today but Meta surfaces it as a missing-info
chip and asks for it during any future App Review.

---

# Reference

## Pricing (post July-2025 model — per-message, not per-conversation)

Meta retired conversation-based pricing on 2025-07-01. The new model
is per-message; most of what this bot sends is free.

- **Free, unbounded:** any message sent inside the 24-hour
  customer-service window (customer messaged you → next 24h of replies
  cost nothing). Nearly every ordering conversation hits this path.
- **Free:** utility templates *also* inside the 24h window — so
  `handoff_customer_wait` fires for free because the customer just
  messaged a moment earlier.
- **Authentication templates** (`otp_login_code`): ~US$0.0315 per send
  (≈ R$0.16). Main paid line item; scales with portal logins.
- **Utility templates outside the 24h window** (`admin_alert`,
  `order_status_update`): ~US$0.0080 per send (≈ R$0.04).
- **Marketing templates**: ~US$0.0625 per send (≈ R$0.31). Bot doesn't
  send any today.

Order-of-magnitude check for Pizzaria Planalto: 100 OTPs/month + 30
out-of-window admin alerts ≈ **R$17/month**. 500 OTPs/month bumps it
to ~R$85; marketing pings would blow it up. The R$1,200/month OpenAI
bill (GPT-4o per turn) is the dominant variable cost — Meta WhatsApp
is the cheap part.

These rates change quarterly. Authoritative source:
https://developers.facebook.com/docs/whatsapp/pricing

## Tier ramp-up (automatic)

Meta starts every new account at **1K Tier** (250 unique
business-initiated conversations / 24h). The tier auto-raises:
- 1K → 10K after ~24h of healthy sending without violations.
- 10K → 100K after another period of clean sending.

Visible in `health_status.entities[PHONE_NUMBER].messaging_limit_tier`.
For a small pizzaria the 1K tier is plenty — no action needed.

## Common failure modes (and what Meta's error means)

- **Outbound `send_text` returns error `131047`** — outside the 24-hour
  customer-service window. Use a template (Phase 6) instead.
- **Outbound template returns error `132001` "template not found"** —
  the name in `META_TEMPLATE_*` doesn't match exactly (case-sensitive)
  or the template isn't `APPROVED` yet. Re-check name and status.
- **Outbound template returns error `131008` "param mismatch"** — the
  number of `{{n}}` variables in the template doesn't match the
  `body_params` your caller passes. Align the template body with the
  call site.
- **Outbound text returns error `131056` "pair rate limit"** — same
  recipient too many times in a short window. Back off and dedupe.
- **`/register` returns error `133005` "PIN mismatch"** — Meta has a
  cached PIN on the number from a prior registration. Either supply
  the old PIN, or use the account-recovery flow at WhatsApp Manager →
  Phone Numbers to reset.
- **Outbound to a specific number returns error `133010` "recipient
  not opted in"** — that customer blocked the business or never
  messaged it. Nothing to fix on our side; it's a Meta-side block.
- **`webhook: meta signature mismatch` in backend logs** —
  `META_APP_SECRET` no longer matches the App secret on Meta. Re-copy
  it from App settings → Basic and restart the backend.
- **Every outbound returns error `141006`** — payment method has
  regressed (card expired or was removed). Re-add in Business Settings
  → WhatsApp Accounts → Payment Settings.

For the full error-code reference:
https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/

## Quick status snapshot (one command)

To audit everything in one call from the VPS:
```bash
ssh root@157.230.9.42
cd /opt/pizzabot
export TOK=$(grep ^META_ACCESS_TOKEN= .env | cut -d= -f2-)
export PID=$(grep ^META_PHONE_NUMBER_ID= .env | cut -d= -f2-)
export WABA=$(grep ^META_WABA_ID= .env | cut -d= -f2-)
export VER=$(grep ^META_GRAPH_VERSION= .env | cut -d= -f2-)
export BASE="https://graph.facebook.com/$VER"

echo "--- token ---"
curl -s -H "Authorization: Bearer $TOK" "$BASE/debug_token?input_token=$TOK" | python3 -m json.tool
echo "--- phone health ---"
curl -s -H "Authorization: Bearer $TOK" "$BASE/$PID?fields=display_phone_number,verified_name,code_verification_status,is_pin_enabled,quality_rating,health_status" | python3 -m json.tool
echo "--- waba ---"
curl -s -H "Authorization: Bearer $TOK" "$BASE/$WABA?fields=name,business_verification_status,account_review_status,country" | python3 -m json.tool
echo "--- subscribed apps ---"
curl -s -H "Authorization: Bearer $TOK" "$BASE/$WABA/subscribed_apps" | python3 -m json.tool
echo "--- templates ---"
curl -s -H "Authorization: Bearer $TOK" "$BASE/$WABA/message_templates?fields=name,status,category,language&limit=50" | python3 -m json.tool
```

Run this whenever the bot stops working — it's the same 5 calls used
to write this doc, and the diff against a previous run is usually
enough to spot what regressed.

# WhatsApp Cloud API — Message Templates

> This doc is **Phase 6** of the full Cloud API setup. If the bot isn't
> receiving messages at all, the problem is usually in Phases 3–5, not
> here — start at **[`whatsapp_setup.md`](whatsapp_setup.md)** first
> and come back to this file once `health_status` on the phone is clean.

Meta enforces a **24-hour customer service window**: outside it, you can only
send pre-approved **message templates**. This doc lists every template the
pizzabot needs, what to paste into the Meta dashboard, and which `.env` key
to fill in after Meta approves each one.

---

## When + where to submit

Submit at the WhatsApp Manager → Message Templates → Create Template:
`https://business.facebook.com/wa/manage/message-templates/`

Approval takes 1–24h per template (usually under 1 hour for utility and
authentication categories). After approval, the template name (exactly as
you submitted it) goes into the corresponding `META_TEMPLATE_*` env var on
the VPS, and the backend picks up the template on next restart.

All templates target Brazilian Portuguese (`pt_BR`).

---

## Meta body rules — read before writing any new template

Meta's reviewer enforces three structural rules on every Utility/Marketing
body. Authentication bodies are pre-canned by Meta and don't apply.

1. **Variables can't be at the start or end of the body.** `{{1}} ...` and
   `... {{2}}` are both rejected. Wrap every placeholder with fixed text
   on both sides — even one word and a period is enough.
2. **Length-vs-variable ratio.** Meta wants enough fixed characters to
   carry meaning around each variable. A body of `🔔 [{{1}}] {{2}}` (16
   chars, 2 variables) is rejected with the error *"too many variables for
   its length. Reduce the number of variables or increase the message
   length."* Aim for at least ~30 fixed characters per variable.
3. **No carrier/spam triggers in the fixed text.** Phrases like "click
   here", "act now", "URGENT", phone numbers in the body, all-caps words,
   and excessive emoji raise the spam score. One emoji at the start is
   fine; three is not.

If the body in the form is shown with a red ring + an error line below it,
re-read these rules. The Submit button stays disabled until the body
passes all three.

A worked example: the original draft of `admin_alert` was
`🔔 [{{1}}] {{2}}` — rejected on rules 1 and 2. The accepted form
`🔔 Alerta automático [{{1}}]: {{2}} — verifique o painel admin.` adds
fixed text on both sides of each variable and pushes the body past 60
characters. The code calling the template doesn't care about the extra
fixed text because it only substitutes the positional `{{1}}` and `{{2}}`
values.

---

## Template 1 — OTP for customer portal login

- **Name:** `otp_login_code`
- **Category:** Authentication
- **Language:** Brazilian Portuguese (`pt_BR`)
- **Body text:** Meta restricts Authentication-category bodies to their
  pre-approved patterns — you can't type freeform text here the way you
  can for Utility. Accept Meta's default pt_BR wording (typically
  something like *"Seu código de verificação é {{1}}. Para sua
  segurança, não o compartilhe."*). Don't try to paste our own
  wording — the submission will be rejected.
- **Variables:** `{{1}}` = the 6-digit code (sample value: `135790`)
- **Code delivery setup:** select **Copy code** (NOT Zero-tap autofill
  and NOT One-tap autofill). The portal is a web app, not a native
  Android/iOS app, so the autofill options don't apply — the customer
  needs a tap-to-copy button to paste into the browser form.
- **Code expiration:** Yes, 10 minutes
- **Footer:** Meta auto-adds the standard security recommendation for
  authentication templates — leave empty in the submit form.

`.env` key once approved: `META_TEMPLATE_OTP=otp_login_code`

Used by `app/services/otp.py` and `app/services/customer_login.py` to
deliver the 6-digit verification code when a customer logs in or registers
on the web portal. Critical because most portal users have never messaged
the bot — freeform send would fail outside the 24h window. This template
works any time.

---

## Template 2 — Admin alert

Bridge offline, daily summary, handoff requests, ad-hoc operator alerts.

- **Name:** `admin_alert`
- **Category:** Utility
- **Language:** `pt_BR`
- **Body text:**
  ```
  🔔 Alerta automático [{{1}}]: {{2}} — verifique o painel admin.
  ```
  Meta rejects the shorter form `🔔 [{{1}}] {{2}}` with the error
  "too many variables for its length. Variables can't be at the start
  or end of the template." Fixed text on both sides of every variable
  is required, plus a minimum total length. The body above clears both
  rules.
- **Variables:**
  - `{{1}}` = alert kind (sample value: `bridge_offline`)
  - `{{2}}` = alert message (sample value: `Datacaixa offline há 5min, último ping 14:32`)

`.env` key once approved: `META_TEMPLATE_ADMIN_ALERT=admin_alert`

Used by `app/services/notifications.py` to alert every number in
`ADMIN_PHONES`. Without this template, alerts fail any time the admin
hasn't messaged the bot in the last 24h — which is essentially always for
operational alerts that fire at random hours.

---

## Template 3 — Customer handoff "atendente vai responder"

- **Name:** `handoff_customer_wait`
- **Category:** Utility
- **Language:** `pt_BR`
- **Body text:**
  ```
  Só um instante 🙏 Um atendente já vai te responder por aqui mesmo.
  ```
- **Variables:** none

`.env` key once approved: `META_TEMPLATE_HANDOFF_CUSTOMER=handoff_customer_wait`

Used by `app/services/handoff.py` and sent to the customer the instant the
bot hands off to a human (customer asked for human, rate limit hit, token
budget blown). Without it, the customer thinks they're being ignored while
the operator picks up the chat.

Note: customer handoffs are usually inside the 24h window because the
customer just messaged the bot, so freeform `send_text` works as a
fallback. The template is the safer canonical choice and also ensures
consistent wording across operators.

---

## Template 4 — Order status update (optional, future)

- **Name:** `order_status_update`
- **Category:** Utility
- **Language:** `pt_BR`
- **Body text:**
  ```
  Atualização do seu pedido #{{1}}: {{2}}. Qualquer dúvida é só responder aqui.
  ```
  Meta rejects shorter forms ending in `{{2}}` — variables can't be at
  the start or end. The trailing sentence keeps `{{2}}` in the middle
  and satisfies the length-vs-variable-count rule.
- **Variables:**
  - `{{1}}` = order number (sample value: `1024`)
  - `{{2}}` = status text (sample value: `saiu pra entrega 🛵 chega em ~15 min`)

`.env` key once approved: `META_TEMPLATE_ORDER_STATUS=order_status_update`

Not currently wired into the code — placeholder for when the operator
wants to send late status updates (delivery delayed, substitution, etc.)
from the admin panel outside the 24h window.

---

## Submitting a template — step by step

The Create Template flow is two screens: **Set up template** (category +
subtype) then **Edit template** (name + body + variables + buttons).

Screen 1 — Set up template:

1. Open `https://business.facebook.com/wa/manage/message-templates/` and
   make sure the top-right WABA selector shows **Pizzaria Planalto**.
2. Click **Create Template**.
3. Category tab at the top: pick **Utility** (for admin_alert,
   handoff_customer_wait, order_status_update) or **Authentication**
   (for otp_login_code).
4. Subtype radio below the category tabs: **Default** for every template
   we use. The other subtypes (Flows, Order Status, Order Details,
   Calling permissions) have extra required fields we don't need.
5. Click **Next**.

Screen 2 — Edit template:

6. Name: paste the exact string from the template's "Name" field above
   (snake_case, lowercase). A green check appears when the name is
   unique within the WABA.
7. Language: select **Portuguese (BR)**.
8. Type of variable: leave on **Number**. We use positional `{{1}}` /
   `{{2}}` not named variables.
9. Media sample: **None**. No template uses an image/video header.
10. Header: leave empty.
11. Body: paste the exact text from the "Body text" field above. You can
    either click **+ Add variable** to insert `{{1}}` / `{{2}}` or just
    type them inline — both work. Watch for the red error ring; if it
    appears, re-read the *Meta body rules* section above.
12. Variable Samples (separate panel that appears below the body once
    variables are present): fill each `{{n}}` box with the sample value
    listed under "Variables" for that template. Required for review.
13. Footer: leave empty.
14. Buttons:
    - For `otp_login_code`: click **Add Button → One-time password →
      Copy code**.
    - For every other template: leave empty.
15. Message validity period: leave the toggle **off** (default 10-minute
    window is fine for every template we send).
16. Click **Submit for review**.
17. Wait for status to flip from `In review` to `Active`. Most approvals
    arrive within 1 hour. The "Quality pending" tag that appears next to
    `Active` is normal — it just means Meta hasn't gathered enough send
    data to compute a quality score yet, and does **not** mean the
    template is unusable. It is fully usable as soon as it says `Active`.
18. Once `Active`, paste the template name into the matching
    `META_TEMPLATE_*` line in `/opt/pizzabot/.env` on the VPS, then
    restart the backend:
    ```
    ssh root@157.230.9.42 'cd /opt/pizzabot && docker compose -f docker-compose.prod.yml restart backend'
    ```

---

## Why the .env-key indirection

The code reads each template **name** from an env var rather than
hard-coding it, for three reasons:

- Different environments (dev/prod) may end up with different approved
  template names because Meta App Review is per-app.
- A rejected template can be resubmitted under a new name without any
  code change — just update the env var.
- During the gap between submission and approval, the env var stays empty
  and the code falls back to freeform `send_text` (which works inside the
  24h window for testing).

---

## After approval — what's still needed for Live Mode

Templates are **necessary but not sufficient** for production. See
[`whatsapp_setup.md`](whatsapp_setup.md) for the full ordered flow.
The remaining phases after templates approve:

- **Phase 5** — payment method on the WABA (blocks every business-initiated
  message until done — including OTPs and admin alerts).
- **Phase 7** — App Review for Advanced Access on `whatsapp_business_messaging`
  + flip App Mode from Development to Live, so the bot can message any
  customer phone (not just registered testers).

Business verification (`whatsapp_setup.md` Phase 0 step 7) is already
complete for Pizzaria Planalto as of 2026-05-15.

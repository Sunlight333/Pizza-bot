# WhatsApp Cloud API — Message Templates

Meta enforces a **24-hour customer service window**: outside it, you can only
send pre-approved **message templates**. This doc lists every template the
pizzabot needs, what to paste into the Meta dashboard, and which `.env` key
to fill in after Meta approves each one.

## When + where to submit

- Submit at: **WhatsApp Manager → Message Templates → Create Template**
  (`https://business.facebook.com/wa/manage/message-templates/`)
- Approval time: 1–24h per template, usually <1h for utility/authentication.
- After approval, the template **name** (exactly as you submitted it) goes
  into the corresponding `META_TEMPLATE_*` env var on the VPS. The backend
  automatically picks up the template on next restart.
- All templates target **language: Brazilian Portuguese (`pt_BR`)**.

## Template 1 — OTP for customer portal login

| Field | Value |
|---|---|
| Name | `otp_login_code` |
| Category | **Authentication** |
| Language | Brazilian Portuguese (pt_BR) |
| Body | `Seu código de acesso é {{1}}. Válido por 10 minutos.` |
| Button | **One-Time-Password (Copy code)** — auto-filled with `{{1}}` |
| Add code expiration | Yes — 10 minutes |
| Security recommendation footer | Auto-added by Meta for authentication templates |

**`.env` key:** `META_TEMPLATE_OTP=otp_login_code`

**Used by:** `app/services/otp.py`, `app/services/customer_login.py` —
delivers the 6-digit verification code when a customer logs in or
registers on the web portal. Critical: most portal users have never
messaged the bot, so freeform send fails outside the 24h window. This
template works any time.

## Template 2 — Admin alert (bridge offline, daily summary, handoff)

| Field | Value |
|---|---|
| Name | `admin_alert` |
| Category | **Utility** |
| Language | pt_BR |
| Body | `🔔 [{{1}}] {{2}}` |
| Sample body params | `{{1}}` = `bridge_offline`, `{{2}}` = `Datacaixa offline há 5min, último ping 14:32` |

**`.env` key:** `META_TEMPLATE_ADMIN_ALERT=admin_alert`

**Used by:** `app/services/notifications.py` — sends to every number in
`ADMIN_PHONES` for bridge offline, handoff requests, daily summary, and
ad-hoc operator alerts. Without this template, admin alerts fail any
time the admin hasn't messaged the bot in the last 24h (~always).

## Template 3 — Customer handoff "atendente vai responder"

| Field | Value |
|---|---|
| Name | `handoff_customer_wait` |
| Category | **Utility** |
| Language | pt_BR |
| Body | `Só um instante 🙏 Um atendente já vai te responder por aqui mesmo.` |
| Variables | None |

**`.env` key:** `META_TEMPLATE_HANDOFF_CUSTOMER=handoff_customer_wait`

**Used by:** `app/services/handoff.py` — sent to the customer the instant
the bot hands off to a human (customer asked for human, rate limit hit,
token budget blown). Without it, the customer thinks they're being
ignored while the operator picks up the chat.

Note: customer handoffs are USUALLY inside the 24h window (the customer
just messaged the bot) so freeform send_text works too. The template is
the safer canonical choice + ensures consistent wording.

## Template 4 — Order status update (optional, future)

| Field | Value |
|---|---|
| Name | `order_status_update` |
| Category | **Utility** |
| Language | pt_BR |
| Body | `Atualização do seu pedido #{{1}}: {{2}}` |
| Sample body params | `{{1}}` = `1024`, `{{2}}` = `saiu pra entrega 🛵 chega em ~15 min` |

**`.env` key:** `META_TEMPLATE_ORDER_STATUS=order_status_update`

**Used by:** not currently wired into the code — placeholder for when
the operator wants to send late status updates (delivery delayed,
substitution, etc.) from the admin panel outside the 24h window.

## Submitting a template — UI walkthrough

1. https://business.facebook.com/wa/manage/message-templates/ (top-right
   dropdown should show **Pizzaria Planalto** WABA)
2. **Create Template** → category from table above → language **Portuguese (BR)**
3. **Name** = exact string from "Name" column (snake_case, lowercase)
4. Header: leave empty (none of our templates use headers)
5. Body: paste the exact text from the table. Click **Add variable** to
   insert `{{1}}`, `{{2}}` — Meta requires sample values for each
   variable (use the "Sample body params" examples)
6. Footer: leave empty (Meta auto-adds the security note for AUTH templates)
7. Buttons:
   - For `otp_login_code`: click **Add Button → One-time password → Copy code**
   - For others: leave empty
8. **Submit for review**
9. Wait for status to flip from `IN_REVIEW` → `APPROVED` (refresh page; 1-24h)
10. Once `APPROVED`, copy the template name → paste into the matching
    `META_TEMPLATE_*` in `/opt/pizzabot/.env` on the VPS → restart backend:
    ```
    ssh root@157.230.9.42 'cd /opt/pizzabot && docker compose -f docker-compose.prod.yml restart backend'
    ```

## Why the .env-key indirection

The code reads the template **name** from env vars rather than hard-coding
because:

- Different environments (dev/prod) might have different approved template
  names (Meta App Review is per-app).
- A rejected template can be resubmitted under a new name without code
  changes — just update the env var.
- During the period between submission and approval, the env var stays
  empty and the code falls back to freeform `send_text` (which works
  inside the 24h window for testing).

## After submission — what's still missing

Even with all 4 templates submitted + approved, the bot still requires:

1. App Review approval of `whatsapp_business_messaging` (Advanced Access)
   — opens up Live Mode messaging to any customer phone, not just testers.
2. Business Verification (CNPJ + supporting docs) — required to apply for
   App Review.
3. Payment method on file in Business Settings → Billing — required once
   the 1,000 free service-conversations/month cap is hit (Brazil tier:
   ~$0.005-0.038 per conversation thereafter).

The templates above are necessary but not sufficient for Live Mode.

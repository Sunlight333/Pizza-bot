"""Human handoff — flip conversation state, notify admins, reassure customer.

When the bot hands off (customer asked for a human, abuse, token-budget
runaway, etc.):
  1. Set conversation state → human_takeover so the bot stops replying
  2. Broadcast over WebSocket so admin panel highlights the row
  3. Send the customer a short "atendente vai responder em instantes"
     message so they don't think they were ignored. Inside the 24h
     window (always true here — we just received their message) we send
     freeform; if META_TEMPLATE_HANDOFF_CUSTOMER is set we use that
     template so the message is consistent across all handoffs.
  4. Alert admins (templates if configured, freeform otherwise).

The customer message is best-effort — if Meta send fails we still flip
state and notify admins so the operator can manually reach out.
"""
import logging
from datetime import datetime, timezone

from app.config import settings
from app.services import conversation_state as state_svc
from app.services.websocket import manager

log = logging.getLogger(__name__)


CUSTOMER_FALLBACK_TEXT = (
    "Já avisei a equipe 🙏 Alguém vai te responder por aqui em instantes. "
    "Se preferir adiantar, pode chamar direto no (17) 3237-1112 — fica à "
    "vontade."
)

# Reasons that indicate the customer was on the cancellation/abandonment
# path. Tagged so the stale-conversation report can break down the funnel
# (% of handoffs that were cancellations vs. other escalation types).
_CANCEL_REASONS = {
    "cancel_request", "customer_complaint", "customer_frustration",
    "customer_abandon", "ai_triggered_cancel",
}


async def trigger_handoff(
    phone: str,
    reason: str = "customer_request",
    *,
    notify_customer: bool = True,
    notify_admins: bool = True,
) -> None:
    """Flip the conversation to human_takeover mode.

    `notify_customer` + `notify_admins` default to True for bot-initiated
    handoffs (customer asked, rate limit hit, token budget blown). They
    should be False when the admin themselves triggers handoff from the
    panel — the admin is already in the chat about to type, no point
    pinging them or sending the customer a "wait, someone is coming"
    message right before that someone types directly.
    """
    data = await state_svc.get_state(phone)
    data["state"] = "human_takeover"
    data["handed_off_at"] = datetime.now(timezone.utc).isoformat()
    data["handoff_reason"] = reason
    if reason in _CANCEL_REASONS:
        data["cancellation_reason"] = reason
    await state_svc.set_state(phone, data)
    await manager.broadcast("handoff_requested", {"phone": phone, "reason": reason})

    # Persist a system breadcrumb on the conversation log so the analytics
    # query for cancellations doesn't have to read Redis state (volatile,
    # 30-min TTL). One row per handoff, role=system, content tagged
    # `[HANDOFF reason=X]` so it's grep-able.
    try:
        from app.database import AsyncSessionLocal
        from app.models.conversation_message import ConversationMessage, MessageRole
        async with AsyncSessionLocal() as db:
            db.add(ConversationMessage(
                phone=phone,
                customer_id=data.get("customer_id"),
                role=MessageRole.system,
                content=f"[HANDOFF reason={reason}]",
            ))
            await db.commit()
    except Exception:
        log.exception("handoff: breadcrumb persist failed for %s", phone)

    if notify_customer:
        try:
            # Lazy-import to dodge a cycle (whatsapp → notifications → handoff
            # would loop on import).
            from app.services.whatsapp import client as wa_client
            template_name = settings.meta_template_handoff_customer
            sent = False
            if template_name:
                res = await wa_client.send_template(
                    phone, name=template_name, language="pt_BR",
                )
                sent = not (isinstance(res, dict) and res.get("error"))
            if not sent:
                await wa_client.send_text(phone, CUSTOMER_FALLBACK_TEXT)
        except Exception:
            log.exception("handoff: failed to send customer reassurance to %s", phone)

    if notify_admins:
        try:
            from app.services.notifications import handoff_requested_alert
            await handoff_requested_alert(phone, reason)
        except Exception:
            log.exception("handoff: failed to notify admins about %s", phone)


async def release_handoff(phone: str) -> None:
    data = await state_svc.get_state(phone)
    data["state"] = "greeting"
    await state_svc.set_state(phone, data)
    await manager.broadcast("handoff_released", {"phone": phone})

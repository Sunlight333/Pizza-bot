"""
Notification service — dispatches alerts to admin phones via WhatsApp.
Rate-limited per event-kind to prevent storms.
"""
import logging
from datetime import datetime, timezone

import redis.asyncio as redis

from app.config import settings
from app.services.whatsapp import client as wa_client

log = logging.getLogger(__name__)


def _admin_phones() -> list[str]:
    """Normalized admin phone list — digits only, no +/spaces, deduplicated.

    The env var lets operators paste numbers in any reasonable shape
    (`+55 17 9...`, `5517...`, `(17) 99128-9777`); we normalize to the same
    digits-only E.164 the rest of the project uses so equality checks against
    inbound `phone` values (which are also digits-only from Meta's `wa_id`)
    actually match.
    """
    raw = (settings.admin_phones or "").split(",")
    out: list[str] = []
    seen: set[str] = set()
    for p in raw:
        digits = "".join(ch for ch in p if ch.isdigit())
        if digits and digits not in seen:
            seen.add(digits)
            out.append(digits)
    return out


def is_admin_phone(phone: str | None) -> bool:
    """True when `phone` belongs to an operator (matches ADMIN_PHONES).

    Used by the webhook + ai_engine to skip bot-side ordering logic for
    inbound from the pizzaria's own number(s) — see notes in
    ai_engine.process_incoming.
    """
    if not phone:
        return False
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits in _admin_phones() if digits else False


async def _should_send(kind: str, cooldown_seconds: int = 300) -> bool:
    client = redis.from_url(settings.redis_url, decode_responses=True)
    key = f"notif:last:{kind}"
    last = await client.get(key)
    if last:
        try:
            if (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds() < cooldown_seconds:
                return False
        except Exception:
            pass
    await client.set(key, datetime.now(timezone.utc).isoformat(), ex=cooldown_seconds * 2)
    return True


async def alert(kind: str, message: str, cooldown_seconds: int = 300) -> None:
    """Dispatch an alert to every ADMIN_PHONES recipient.

    Tries template first (when META_TEMPLATE_ADMIN_ALERT is set), falls
    back to freeform text otherwise. Why both:
      - Templates work outside the 24-hour customer-service window — the
        normal case for admin alerts (bridge offline at 3am, daily summary,
        etc.) where the admin hasn't messaged the bot recently.
      - Freeform text is the dev/staging fallback before the template is
        approved by Meta. Inside the 24h window it still delivers; outside,
        Meta returns 131047 and the admin won't see the alert.

    Each call is rate-limited per `kind` to prevent storms.
    """
    if not await _should_send(kind, cooldown_seconds):
        return
    phones = _admin_phones()
    if not phones:
        log.info("alert fired but ADMIN_PHONES empty: [%s] %s", kind, message)
        return
    template_name = settings.meta_template_admin_alert
    for phone in phones:
        try:
            if template_name:
                res = await wa_client.send_template(
                    phone,
                    name=template_name,
                    language="pt_BR",
                    body_params=[kind, message],
                )
                # If Meta rejected the template (typo, not approved, etc.)
                # fall through to freeform — better the admin sees SOMETHING
                # than silently nothing.
                if isinstance(res, dict) and res.get("error"):
                    log.warning(
                        "admin template %s failed for %s: %s — falling back to text",
                        template_name, phone, res.get("error"),
                    )
                    await wa_client.send_text(phone, f"🔔 {kind}\n{message}")
            else:
                await wa_client.send_text(phone, f"🔔 {kind}\n{message}")
        except Exception:
            log.exception("failed to send alert to %s", phone)


async def bridge_offline_alert(last_seen: str | None) -> None:
    msg = "Bridge do Datacaixa está offline há mais de 5 minutos."
    if last_seen:
        msg += f" Último heartbeat: {last_seen}"
    await alert("bridge_offline", msg, cooldown_seconds=300)


async def handoff_requested_alert(phone: str, reason: str) -> None:
    await alert("handoff", f"Cliente {phone} pediu atendente. Motivo: {reason}", cooldown_seconds=60)


async def daily_summary(orders: int, revenue: float) -> None:
    brl = f"R$ {revenue:.2f}".replace(".", ",")
    await alert("daily_summary", f"Resumo do dia: {orders} pedidos, {brl} em receita.", cooldown_seconds=3600)

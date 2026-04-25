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
    return [p.strip() for p in (settings.admin_phones or "").split(",") if p.strip()]


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
    if not await _should_send(kind, cooldown_seconds):
        return
    phones = _admin_phones()
    if not phones:
        log.info("alert fired but ADMIN_PHONES empty: [%s] %s", kind, message)
        return
    for phone in phones:
        try:
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

"""
APScheduler — periodic background jobs.
Runs in the same process as FastAPI, started/stopped via app lifespan.
"""
import logging
from datetime import datetime, timedelta, timezone

import redis.asyncio as redis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.conversation_message import ConversationMessage, MessageRole
from app.models.order import Order, OrderStatus
from app.services import notifications

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")

# States the bot considers "mid-order" — these are the only ones eligible
# for the idle-nudge. A conversation in `greeting` or `human_takeover` is
# either already cold or already being handled by a person; pinging it
# would just be noise.
_MID_ORDER_STATES = {
    "building_order", "collecting_payment", "confirming",
    "collecting_address",
}

_IDLE_NUDGE_TEXT = (
    "Oi, vi que você parou de responder por aqui 🙏 "
    "Se ainda quiser fechar o pedido é só me chamar — ou, se preferir "
    "falar direto com a equipe, é no (17) 3237-1112 que te atendem na "
    "hora 😊"
)


async def check_idle_mid_order() -> None:
    """Send a one-time nudge to customers whose conversation has gone
    silent (>=5 min) in the middle of an order.

    Behaviour:
      - Iterates Redis state keys (conv:*) — same source-of-truth the
        bot uses, so a "completed" or "human_takeover" conversation
        is never bothered.
      - Skips when state.get("_nudged_at") is already set — one nudge
        per conversation, ever.
      - Only nudges if the LAST persisted message for that phone has
        role=user (customer was the last to speak — bot's turn was
        skipped, so the silence is on US) AND it's older than 5 min.
      - The nudge text always surfaces the human-channel phone so the
        operator can rescue the order even if the bot can't recover.

    Failures are isolated per phone — one bad send doesn't abort the
    sweep. Designed to run every 3 min from the scheduler.
    """
    from app.services import conversation_state as state_svc
    from app.services.whatsapp import client as wa_client

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    rc = state_svc._client()
    nudged = 0
    try:
        async for key in rc.scan_iter(match="conv:*", count=100):
            phone = key.split(":", 1)[1]
            try:
                state = await state_svc.get_state(phone)
            except Exception:
                log.exception("idle-nudge: get_state failed for %s", phone)
                continue
            if state.get("state") not in _MID_ORDER_STATES:
                continue
            if state.get("_nudged_at"):
                continue

            async with AsyncSessionLocal() as db:
                row = (
                    await db.execute(
                        select(ConversationMessage)
                        .where(ConversationMessage.phone == phone)
                        .order_by(ConversationMessage.created_at.desc())
                        .limit(1)
                    )
                ).scalar_one_or_none()
            if row is None or row.role != MessageRole.user:
                continue
            if row.created_at > cutoff:
                continue

            try:
                await wa_client.send_text(phone, _IDLE_NUDGE_TEXT)
            except Exception:
                log.exception("idle-nudge: send failed for %s", phone)
                continue

            try:
                state["_nudged_at"] = datetime.now(timezone.utc).isoformat()
                await state_svc.set_state(phone, state)
            except Exception:
                log.exception("idle-nudge: mark _nudged_at failed for %s", phone)
            nudged += 1
    except Exception:
        log.exception("idle-nudge sweep crashed")
    if nudged:
        log.info("idle-nudge: %d customer(s) nudged", nudged)


async def check_bridge_offline() -> None:
    """If the bridge has not checked in for >5 minutes, alert admins."""
    try:
        client = redis.from_url(settings.redis_url, decode_responses=True)
        last = await client.get("bridge:last_heartbeat")
        if not last:
            await notifications.bridge_offline_alert(None)
            return
        try:
            seen = datetime.fromisoformat(last)
        except Exception:
            return
        if (datetime.now(timezone.utc) - seen).total_seconds() > 300:
            await notifications.bridge_offline_alert(last)
    except Exception:
        log.exception("check_bridge_offline failed")


async def daily_summary() -> None:
    try:
        now = datetime.now(timezone.utc)
        start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(func.count(), func.coalesce(func.sum(Order.total), 0)).where(
                    Order.created_at >= start,
                    Order.status == OrderStatus.delivered,
                )
            )
            count, revenue = res.one()
        await notifications.daily_summary(int(count or 0), float(revenue or 0))
    except Exception:
        log.exception("daily_summary failed")


def start() -> None:
    if scheduler.running:
        return
    scheduler.add_job(check_bridge_offline, "interval", minutes=1, id="bridge_check")
    scheduler.add_job(
        check_idle_mid_order, "interval", minutes=3, id="idle_mid_order_nudge"
    )
    scheduler.add_job(
        daily_summary,
        "cron",
        hour=2,  # 23h Brasília
        minute=0,
        id="daily_summary",
    )
    scheduler.start()
    log.info("scheduler started")


def shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("scheduler stopped")

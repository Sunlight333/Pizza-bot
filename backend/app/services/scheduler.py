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
from app.models.order import Order, OrderStatus
from app.services import notifications

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")


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

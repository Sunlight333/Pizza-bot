import asyncio
import logging
from datetime import datetime, timezone

import httpx
import redis.asyncio as redis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

log = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "reachable"}


async def _check_postgres(db: AsyncSession) -> dict:
    try:
        await db.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _check_redis() -> dict:
    try:
        client = redis.from_url(settings.redis_url, decode_responses=True)
        await client.ping()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _check_whatsapp() -> dict:
    """
    Health check for Meta Cloud API. There's no "is the number paired"
    state to query — the WABA-phone binding is permanent. We probe the
    phone-number resource as a credentials sanity check (it returns the
    display number + verified name when the token has access). A 200
    means token + phone_number_id are good and Meta is reachable.
    """
    if not settings.meta_access_token or not settings.meta_phone_number_id:
        return {"ok": False, "error": "not configured"}
    url = (
        f"https://graph.facebook.com/{settings.meta_graph_version}/"
        f"{settings.meta_phone_number_id}"
    )
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                url,
                headers={"Authorization": f"Bearer {settings.meta_access_token}"},
            )
        if r.status_code == 200:
            j = r.json()
            return {
                "ok": True,
                "display_phone_number": j.get("display_phone_number"),
                "verified_name": j.get("verified_name"),
                "quality_rating": j.get("quality_rating"),
            }
        return {"ok": False, "error": f"http {r.status_code}", "body": r.text[:200]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _check_bridge() -> dict:
    try:
        client = redis.from_url(settings.redis_url, decode_responses=True)
        last = await client.get("bridge:last_heartbeat")
        if not last:
            return {"ok": False, "error": "never checked in"}
        delta = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds()
        return {"ok": delta < 120, "last_heartbeat": last, "seconds_since": delta}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _check_openai() -> dict:
    if not settings.openai_api_key or settings.openai_api_key.startswith("sk-replace"):
        return {"ok": False, "error": "not configured"}
    return {"ok": True, "note": "key present, not actively pinged"}


@router.get("/health/detailed")
async def health_detailed(db: AsyncSession = Depends(get_db)):
    postgres, redis_s, whatsapp, bridge_s, openai_s = await asyncio.gather(
        _check_postgres(db),
        _check_redis(),
        _check_whatsapp(),
        _check_bridge(),
        _check_openai(),
    )
    all_ok = all(x["ok"] for x in (postgres, redis_s))  # infra is the bar
    return {
        "status": "ok" if all_ok else "degraded",
        "postgres": postgres,
        "redis": redis_s,
        "whatsapp": whatsapp,
        "bridge": bridge_s,
        "openai": openai_s,
    }

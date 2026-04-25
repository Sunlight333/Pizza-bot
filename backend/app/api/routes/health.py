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


async def _check_evolution() -> dict:
    if not settings.evolution_api_url:
        return {"ok": False, "error": "not configured"}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{settings.evolution_api_url.rstrip('/')}/instance/connectionState/{settings.evolution_instance_name}",
                headers={"apikey": settings.evolution_api_key},
            )
            return {"ok": r.status_code < 500, "http": r.status_code}
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
    postgres, redis_s, evolution, bridge_s, openai_s = await asyncio.gather(
        _check_postgres(db),
        _check_redis(),
        _check_evolution(),
        _check_bridge(),
        _check_openai(),
    )
    all_ok = all(x["ok"] for x in (postgres, redis_s))  # infra is the bar
    return {
        "status": "ok" if all_ok else "degraded",
        "postgres": postgres,
        "redis": redis_s,
        "evolution": evolution,
        "bridge": bridge_s,
        "openai": openai_s,
    }

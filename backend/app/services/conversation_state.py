"""Redis-backed conversation state — per-phone cart + state + message context."""
import json
from typing import Optional

import redis.asyncio as redis

from app.config import settings

_redis: Optional[redis.Redis] = None


def _client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


STATE_TTL_SECONDS = 30 * 60  # 30min inactivity


def _key(phone: str) -> str:
    return f"conv:{phone}"


async def get_state(phone: str) -> dict:
    raw = await _client().get(_key(phone))
    if not raw:
        return {
            "state": "greeting",
            "cart": {"items": []},
            "context_messages": [],
            "customer_id": None,
        }
    return json.loads(raw)


async def set_state(phone: str, data: dict) -> None:
    await _client().set(_key(phone), json.dumps(data), ex=STATE_TTL_SECONDS)


async def clear_state(phone: str) -> None:
    await _client().delete(_key(phone))


async def append_message(phone: str, role: str, content: str, max_history: int = 20) -> None:
    data = await get_state(phone)
    ctx = data.get("context_messages", [])
    ctx.append({"role": role, "content": content})
    data["context_messages"] = ctx[-max_history:]
    await set_state(phone, data)

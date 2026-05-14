"""Address → (lat, lng) geocoding via OpenStreetMap Nominatim.

Used by services/delivery.calculate_fee_by_distance to find the right
distance band when the operator enabled `delivery_by_distance`.

Choice of provider: Nominatim is free, no key required, and works well
for Brazilian addresses. The rate limit (1 req/s) is fine because every
result is cached in Redis for 7 days keyed by the normalised query, so
a busy night with 100 orders typically hits Nominatim 10–20 times
(every other address is a repeat customer).

We pass a User-Agent that identifies the project — Nominatim blocks
clients without one. We DON'T pass the customer's name or phone number,
only the address itself, so this never leaks PII to OSM.

Fallback chain (ordered):
  1. Nominatim with the structured query (street + number + city + cep)
  2. Nominatim with a freeform fallback (no number)
  3. None  →  caller falls back to neighbourhood-name lookup.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from typing import Optional

import httpx
import redis.asyncio as redis

from app.config import settings

log = logging.getLogger(__name__)

NOMINATIM = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "pizzabot/1.0 (planaltopizzasesorvetes.com)"
CACHE_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days

_redis: Optional[redis.Redis] = None
_throttle_lock = asyncio.Lock()
_last_call_at = 0.0


def _client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _normalise(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _cache_key(query: str) -> str:
    h = hashlib.sha1(_normalise(query).encode("utf-8")).hexdigest()[:16]
    return f"geocode:{h}"


async def _throttle() -> None:
    """Nominatim usage policy: at most 1 req/sec from a single client."""
    global _last_call_at
    async with _throttle_lock:
        loop = asyncio.get_event_loop()
        now = loop.time()
        wait = 1.0 - (now - _last_call_at)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_call_at = loop.time()


async def _nominatim(query: str) -> Optional[dict]:
    cache = _client()
    key = _cache_key(query)
    try:
        cached = await cache.get(key)
    except Exception:
        cached = None
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    await _throttle()
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            r = await c.get(
                NOMINATIM,
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "br"},
                headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt"},
            )
        if r.status_code != 200:
            log.info("Nominatim %s → HTTP %s", query, r.status_code)
            return None
        rows = r.json()
        if not rows:
            # Cache the miss too, but shorter — addresses get added to OSM.
            try:
                await cache.set(key, json.dumps(None), ex=24 * 60 * 60)
            except Exception:
                pass
            return None
        row = rows[0]
        result = {
            "lat": float(row["lat"]),
            "lng": float(row["lon"]),
            "display_name": row.get("display_name"),
            "source": "nominatim",
        }
        try:
            await cache.set(key, json.dumps(result), ex=CACHE_TTL_SECONDS)
        except Exception:
            pass
        return result
    except Exception as e:
        log.warning("Nominatim call failed for %r: %s", query, e)
        return None


def _build_query(
    *,
    street: Optional[str],
    number: Optional[str],
    neighborhood: Optional[str],
    city: Optional[str],
    cep: Optional[str],
    free_form: Optional[str] = None,
) -> str:
    if free_form:
        return free_form
    parts: list[str] = []
    if street:
        parts.append(street + (f" {number}" if number else ""))
    if neighborhood:
        parts.append(neighborhood)
    if city:
        parts.append(city)
    elif cep:
        # CEP alone narrows to the city without us needing to know it.
        parts.append(cep)
    parts.append("Brasil")
    return ", ".join(p for p in parts if p)


async def geocode(
    *,
    street: Optional[str] = None,
    number: Optional[str] = None,
    neighborhood: Optional[str] = None,
    city: Optional[str] = None,
    cep: Optional[str] = None,
    free_form: Optional[str] = None,
) -> Optional[dict]:
    """Geocode an address. Returns {lat, lng, display_name, source} or None.

    Tries the most specific query first; if that fails, retries without
    the house number (some streets are mapped at the road level only).
    Caches both hits and misses in Redis.
    """
    primary = _build_query(
        street=street, number=number, neighborhood=neighborhood,
        city=city, cep=cep, free_form=free_form,
    )
    res = await _nominatim(primary)
    if res:
        return res

    if number:
        fallback = _build_query(
            street=street, number=None, neighborhood=neighborhood,
            city=city, cep=cep,
        )
        if fallback != primary:
            res = await _nominatim(fallback)
            if res:
                return res

    return None

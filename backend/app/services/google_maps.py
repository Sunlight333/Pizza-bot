"""Google Maps Platform wrappers — geocoding, reverse geocoding,
distance matrix, and directions.

This module is the single touch point for any backend call into the
Google Maps API. Callers should never `httpx` Google directly; they
should import one of these four functions, which give us:

  - Uniform Redis caching (same 7-day TTL as services/geocode.py, but
    keyed `gmaps:` to keep the namespaces distinct from Nominatim).
  - Uniform error handling: any non-`OK` status returns None, with the
    Google error envelope logged at WARNING level so it shows up in the
    backend logs without needing debug mode.
  - One env-var lookup. If `GOOGLE_MAPS_SERVER_KEY` is unset, every
    function short-circuits to None so callers automatically degrade
    to their existing fallback (Nominatim for geocode, Haversine for
    distance). This keeps dev environments running without forcing
    everyone to provision a key.

The Redis cache treats hits and misses the same way (cached as a JSON
string; explicit `null` for misses) but uses a shorter TTL for misses
to allow new Google data to be picked up — same trick services/geocode.py
uses.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Optional

import httpx
import redis.asyncio as redis

from app.config import settings

log = logging.getLogger(__name__)

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"

CACHE_TTL_HIT = 7 * 24 * 60 * 60   # 7 days
CACHE_TTL_MISS = 24 * 60 * 60      # 1 day — addresses get added to Google

_redis: Optional[redis.Redis] = None


def _client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _cache_key(kind: str, payload: str) -> str:
    h = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:16]
    return f"gmaps:{kind}:{h}"


async def _cached_get(key: str) -> tuple[bool, Any]:
    """Return (found, value). found=False means not in cache."""
    try:
        raw = await _client().get(key)
    except Exception:
        return False, None
    if raw is None:
        return False, None
    try:
        return True, json.loads(raw)
    except Exception:
        return False, None


async def _cached_set(key: str, value: Any, *, ttl: int) -> None:
    try:
        await _client().set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass


def _key_available() -> bool:
    return bool(settings.google_maps_server_key)


async def _graph_get(url: str, params: dict) -> Optional[dict]:
    """Single network call. Returns the JSON body on 200, or None.
    Adds the API key as the last parameter so it isn't accidentally
    overwritten by a caller-supplied `key` field.
    """
    params = {**params, "key": settings.google_maps_server_key}
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            r = await c.get(url, params=params)
    except Exception as e:
        log.warning("Google Maps HTTP error on %s: %s", url, e)
        return None
    if r.status_code != 200:
        log.warning("Google Maps %s → HTTP %s", url, r.status_code)
        return None
    try:
        return r.json()
    except Exception:
        log.warning("Google Maps non-JSON body on %s", url)
        return None


def _ok(body: Optional[dict]) -> bool:
    """Google uses `status: "OK"` for success; anything else (REQUEST_DENIED,
    OVER_QUERY_LIMIT, ZERO_RESULTS, INVALID_REQUEST, UNKNOWN_ERROR) means
    we should NOT use the payload. ZERO_RESULTS is technically a "the
    address doesn't exist" case but we treat it as None too — the
    Nominatim fallback may still find it.
    """
    if not body:
        return False
    status = body.get("status")
    if status == "OK":
        return True
    # Surface the error envelope so deploys with broken keys are obvious
    # in the log instead of mysteriously silent.
    if status:
        log.warning(
            "Google Maps non-OK: status=%s error_message=%s",
            status, body.get("error_message"),
        )
    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def geocode(address: str) -> Optional[dict]:
    """Address → {lat, lng, formatted, place_id, location_type, source='google'} or None.

    Returns None when:
      - Google returns no result, or
      - Google returns only APPROXIMATE results (city/neighborhood centroid).
        That signal means we don't have a real address — feeding the
        centroid into Haversine + bands would charge whatever fee the
        centroid happens to fall in (the bug that produced R$ 7 for
        bairro-only inputs). Caller should ask the customer for a
        complete street + number instead of pricing a centroid.

    Accepted location_types: ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER.
    """
    address = (address or "").strip()
    if not address or not _key_available():
        return None

    key = _cache_key("geo", address.lower())
    found, cached = await _cached_get(key)
    if found:
        return cached  # may be None (cached miss)

    body = await _graph_get(GEOCODE_URL, {"address": address, "region": "br"})
    if not _ok(body):
        await _cached_set(key, None, ttl=CACHE_TTL_MISS)
        return None

    results = body.get("results") or []
    if not results:
        await _cached_set(key, None, ttl=CACHE_TTL_MISS)
        return None
    top = results[0]
    location_type = (
        (top.get("geometry") or {}).get("location_type") or "APPROXIMATE"
    )
    if location_type == "APPROXIMATE":
        log.info(
            "google geocode rejected as too imprecise (location_type=APPROXIMATE) "
            "for address=%r — caller should ask the customer for a real number.",
            address,
        )
        await _cached_set(key, None, ttl=CACHE_TTL_MISS)
        return None
    loc = top.get("geometry", {}).get("location", {})
    result = {
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "formatted": top.get("formatted_address"),
        "place_id": top.get("place_id"),
        "location_type": location_type,
        "source": "google",
    }
    await _cached_set(key, result, ttl=CACHE_TTL_HIT)
    return result


async def reverse_geocode(lat: float, lng: float) -> Optional[dict]:
    """(lat, lng) → {formatted, place_id, components, source='google'} or None.

    Used when a WhatsApp customer sends a location pin. components is a
    dict like {"street": "Rua X", "number": "123", "neighborhood": "...",
    "city": "...", "postal_code": "..."} so the bot can populate the
    customer record fields without re-asking.
    """
    if lat is None or lng is None or not _key_available():
        return None

    key = _cache_key("rev", f"{lat:.6f},{lng:.6f}")
    found, cached = await _cached_get(key)
    if found:
        return cached

    body = await _graph_get(GEOCODE_URL, {"latlng": f"{lat},{lng}"})
    if not _ok(body):
        await _cached_set(key, None, ttl=CACHE_TTL_MISS)
        return None

    results = body.get("results") or []
    if not results:
        await _cached_set(key, None, ttl=CACHE_TTL_MISS)
        return None
    top = results[0]
    components: dict[str, str] = {}
    for comp in top.get("address_components", []):
        types = comp.get("types") or []
        if "route" in types:
            components["street"] = comp.get("long_name")
        elif "street_number" in types:
            components["number"] = comp.get("long_name")
        elif "sublocality" in types or "sublocality_level_1" in types:
            components["neighborhood"] = comp.get("long_name")
        elif "administrative_area_level_2" in types and "city" not in components:
            components["city"] = comp.get("long_name")
        elif "locality" in types:
            components["city"] = comp.get("long_name")
        elif "postal_code" in types:
            components["postal_code"] = comp.get("long_name")
    result = {
        "formatted": top.get("formatted_address"),
        "place_id": top.get("place_id"),
        "components": components,
        "source": "google",
    }
    await _cached_set(key, result, ttl=CACHE_TTL_HIT)
    return result


async def distance_matrix(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> Optional[dict]:
    """Coords → {distance_meters, duration_seconds, source='google'} or None.

    Computed by Google as real driving distance + time on the road
    network, not straight-line. Used by services/delivery to set a
    correct delivery fee and ETA when both endpoints have coordinates.
    """
    if None in (origin_lat, origin_lng, dest_lat, dest_lng):
        return None
    if not _key_available():
        return None

    key = _cache_key(
        "dm",
        f"{origin_lat:.5f},{origin_lng:.5f}->{dest_lat:.5f},{dest_lng:.5f}",
    )
    found, cached = await _cached_get(key)
    if found:
        return cached

    body = await _graph_get(DISTANCE_MATRIX_URL, {
        "origins": f"{origin_lat},{origin_lng}",
        "destinations": f"{dest_lat},{dest_lng}",
        "mode": "driving",
    })
    if not _ok(body):
        await _cached_set(key, None, ttl=CACHE_TTL_MISS)
        return None

    try:
        elem = body["rows"][0]["elements"][0]
        if elem.get("status") != "OK":
            log.warning("Distance Matrix element non-OK: %s", elem.get("status"))
            await _cached_set(key, None, ttl=CACHE_TTL_MISS)
            return None
        result = {
            "distance_meters": int(elem["distance"]["value"]),
            "duration_seconds": int(elem["duration"]["value"]),
            "source": "google",
        }
    except (KeyError, IndexError, TypeError) as e:
        log.warning("Distance Matrix unexpected shape: %s", e)
        return None

    await _cached_set(key, result, ttl=CACHE_TTL_HIT)
    return result


async def directions(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> Optional[dict]:
    """Coords → {polyline, distance_meters, duration_seconds, source='google'}.

    Used by Phase 5 (static map on order tracking). The polyline is the
    encoded path string ready to pass to Maps Static API as `path=enc:...`.
    """
    if None in (origin_lat, origin_lng, dest_lat, dest_lng):
        return None
    if not _key_available():
        return None

    key = _cache_key(
        "dir",
        f"{origin_lat:.5f},{origin_lng:.5f}->{dest_lat:.5f},{dest_lng:.5f}",
    )
    found, cached = await _cached_get(key)
    if found:
        return cached

    body = await _graph_get(DIRECTIONS_URL, {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "mode": "driving",
    })
    if not _ok(body):
        await _cached_set(key, None, ttl=CACHE_TTL_MISS)
        return None

    try:
        route = body["routes"][0]
        leg = route["legs"][0]
        result = {
            "polyline": route["overview_polyline"]["points"],
            "distance_meters": int(leg["distance"]["value"]),
            "duration_seconds": int(leg["duration"]["value"]),
            "source": "google",
        }
    except (KeyError, IndexError, TypeError) as e:
        log.warning("Directions unexpected shape: %s", e)
        return None

    await _cached_set(key, result, ttl=CACHE_TTL_HIT)
    return result

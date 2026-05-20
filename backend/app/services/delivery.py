"""
Delivery zone service — fuzzy neighborhood matching + fee calculation.

Two modes:
  - by-name: lookup_zone() with pg_trgm + unaccent. Default. Used when
    bot_config.delivery_by_distance is false OR coordinates aren't set.
  - by-distance: calculate_fee_by_distance() with Haversine. Geocodes
    the customer's address (services.geocode) and picks the
    delivery_zones band whose [distance_min_km..distance_max_km] window
    contains the computed km. Falls back to by-name when geocoding fails.
"""
from __future__ import annotations

import math
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot_config import BotConfig
from app.models.delivery_zone import DeliveryZone
from app.services import geocode as geocode_svc


SIMILARITY_THRESHOLD = 0.35
# Real driving paths are longer than straight-line distance. Multiplying
# the Haversine result by ~1.3 is the common "urban detour" rule of
# thumb; matches a city grid better than raw great-circle without
# needing a routing engine.
DETOUR_FACTOR = 1.3


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0  # Earth radius, km
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


async def lookup_zone(db: AsyncSession, query: str) -> Optional[dict]:
    """
    Return best matching zone for a free-text neighborhood query, or None.
    The returned dict includes: zone (DeliveryZone) and confidence (float 0-1).
    """
    q = (query or "").strip()
    if not q:
        return None

    # Try exact case-insensitive match first
    exact = await db.execute(
        select(DeliveryZone).where(
            DeliveryZone.is_active.is_(True),
            DeliveryZone.neighborhood.ilike(q),
        )
    )
    z = exact.scalar_one_or_none()
    if z is not None:
        return {"zone": z, "confidence": 1.0}

    # Fuzzy match with pg_trgm + unaccent
    result = await db.execute(
        text(
            """
            SELECT id,
                   similarity(unaccent(lower(neighborhood)), unaccent(lower(:q))) AS sim
            FROM delivery_zones
            WHERE is_active = true
            ORDER BY sim DESC
            LIMIT 1
            """
        ),
        {"q": q},
    )
    row = result.first()
    if row is None or row.sim is None or row.sim < SIMILARITY_THRESHOLD:
        return None

    zone = (
        await db.execute(select(DeliveryZone).where(DeliveryZone.id == row.id))
    ).scalar_one()
    return {"zone": zone, "confidence": float(row.sim)}


async def calculate_fee(db: AsyncSession, neighborhood: str) -> Optional[dict]:
    match = await lookup_zone(db, neighborhood)
    if not match:
        return None
    z = match["zone"]
    return {
        "neighborhood": z.neighborhood,
        "fee": float(z.fee),
        "estimated_minutes": z.estimated_minutes,
        "confidence": match["confidence"],
    }


async def is_within_delivery_area(db: AsyncSession, neighborhood: str) -> bool:
    return await lookup_zone(db, neighborhood) is not None


# ---------------------------------------------------------------------------
# Distance-based delivery
# ---------------------------------------------------------------------------

async def _lookup_band_for_distance(
    db: AsyncSession, km: float
) -> Optional[DeliveryZone]:
    """Return the active zone whose [distance_min_km..max_km] contains km.

    When multiple bands overlap (operator misconfiguration), the smallest
    band wins — narrower bands are more specific.
    """
    res = await db.execute(
        select(DeliveryZone)
        .where(
            DeliveryZone.is_active.is_(True),
            DeliveryZone.distance_min_km.isnot(None),
            DeliveryZone.distance_max_km.isnot(None),
            DeliveryZone.distance_min_km <= km,
            DeliveryZone.distance_max_km >= km,
        )
        .order_by(
            (DeliveryZone.distance_max_km - DeliveryZone.distance_min_km).asc(),
        )
    )
    return res.scalars().first()


async def calculate_fee_by_distance(
    db: AsyncSession,
    cfg: BotConfig,
    *,
    street: Optional[str] = None,
    number: Optional[str] = None,
    neighborhood: Optional[str] = None,
    city: Optional[str] = None,
    cep: Optional[str] = None,
) -> Optional[dict]:
    """Geocode → Haversine → band lookup. Returns:
      - {fee, estimated_minutes, distance_km, source: 'distance', ...}  hit
      - {out_of_zone: True, distance_km, source: 'distance', ...}        beyond last band
      - None                                                              geocode failed / disabled
    """
    if not cfg or not cfg.delivery_by_distance:
        return None
    if cfg.pizzaria_lat is None or cfg.pizzaria_lng is None:
        return None

    geo = await geocode_svc.geocode(
        street=street, number=number, neighborhood=neighborhood,
        city=city, cep=cep,
    )
    if not geo:
        return None

    km = _haversine_km(
        float(cfg.pizzaria_lat), float(cfg.pizzaria_lng),
        geo["lat"], geo["lng"],
    ) * DETOUR_FACTOR

    # Hard cap: if the operator set max_delivery_km, anything beyond it is
    # out-of-zone regardless of band coverage. Lets them cap the entire
    # delivery radius with one knob instead of editing every band's max.
    if cfg.max_delivery_km is not None and km > float(cfg.max_delivery_km):
        return {
            "neighborhood": None,
            "fee": None,
            "estimated_minutes": None,
            "confidence": 1.0,
            "distance_km": round(km, 2),
            "source": "distance",
            "out_of_zone": True,
            "exceeded_max_km": float(cfg.max_delivery_km),
        }

    band = await _lookup_band_for_distance(db, km)
    if band is None:
        return {
            "neighborhood": None,
            "fee": None,
            "estimated_minutes": None,
            "confidence": 1.0,
            "distance_km": round(km, 2),
            "source": "distance",
            "out_of_zone": True,
        }
    return {
        "neighborhood": band.neighborhood,
        "fee": float(band.fee),
        "estimated_minutes": band.estimated_minutes,
        "confidence": 1.0,
        "distance_km": round(km, 2),
        "source": "distance",
    }


async def resolve_delivery_fee(
    db: AsyncSession,
    *,
    cfg: Optional[BotConfig] = None,
    street: Optional[str] = None,
    number: Optional[str] = None,
    neighborhood: Optional[str] = None,
    city: Optional[str] = None,
    cep: Optional[str] = None,
) -> Optional[dict]:
    """One-stop resolver used by the bot and the customer portal.

    Tries distance-based first when enabled in config; falls through to
    by-name lookup when geocoding fails (returns None). When the
    distance lookup resolves but the address is beyond the last band,
    surfaces `out_of_zone=True` — do NOT silently fall back to a name
    match, that would let an addr 30 km away sneak through.
    """
    if cfg is None:
        cfg = (
            await db.execute(select(BotConfig).where(BotConfig.id == 1))
        ).scalar_one_or_none()

    if cfg and cfg.delivery_by_distance:
        result = await calculate_fee_by_distance(
            db, cfg, street=street, number=number,
            neighborhood=neighborhood, city=city, cep=cep,
        )
        if result is not None:
            return result

    # Either disabled, or geocode failed → use neighbourhood name.
    if neighborhood:
        return await calculate_fee(db, neighborhood)
    return None


async def get_all_zones_formatted(db: AsyncSession) -> str:
    """Compact text block for GPT system prompt."""
    res = await db.execute(
        select(DeliveryZone)
        .where(DeliveryZone.is_active.is_(True))
        .order_by(DeliveryZone.fee)
    )
    zones = res.scalars().all()
    if not zones:
        return "(nenhum bairro cadastrado)"

    def line(z: DeliveryZone) -> str:
        # If the zone is a distance band pricing model, the label is
        # already the km range — don't duplicate it. Otherwise it's a named
        # bairro and we just show fee + ETA.
        base = f"- {z.neighborhood}: R$ {float(z.fee):.2f} (~{z.estimated_minutes}min)"
        return base.replace(".", ",")

    return "\n".join(line(z) for z in zones)

"""
Delivery zone service — fuzzy neighborhood matching + fee calculation.
Uses pg_trgm similarity() + unaccent() to tolerate typos and missing accents.
"""
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.delivery_zone import DeliveryZone


SIMILARITY_THRESHOLD = 0.35


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
    return "\n".join(
        f"- {z.neighborhood}: R$ {float(z.fee):.2f} (~{z.estimated_minutes}min)".replace(".", ",")
        for z in zones
    )

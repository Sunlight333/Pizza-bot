import csv
import io
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.delivery_zone import DeliveryZone
from app.schemas.delivery import (
    DeliveryZoneCreate,
    DeliveryZoneOut,
    DeliveryZoneUpdate,
    ZoneLookupResult,
)
from app.services import delivery as svc

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/zones", response_model=List[DeliveryZoneOut])
async def list_zones(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeliveryZone).order_by(DeliveryZone.fee))
    return res.scalars().all()


@router.post("/zones", response_model=DeliveryZoneOut, status_code=status.HTTP_201_CREATED)
async def create_zone(payload: DeliveryZoneCreate, db: AsyncSession = Depends(get_db)):
    z = DeliveryZone(**payload.model_dump())
    db.add(z)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(400, "Neighborhood already exists")
    await db.refresh(z)
    return z


@router.put("/zones/{zone_id}", response_model=DeliveryZoneOut)
async def update_zone(zone_id: int, payload: DeliveryZoneUpdate, db: AsyncSession = Depends(get_db)):
    z = (await db.execute(select(DeliveryZone).where(DeliveryZone.id == zone_id))).scalar_one_or_none()
    if not z:
        raise HTTPException(404, "Zone not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(z, k, v)
    await db.commit()
    await db.refresh(z)
    return z


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(zone_id: int, db: AsyncSession = Depends(get_db)):
    z = (await db.execute(select(DeliveryZone).where(DeliveryZone.id == zone_id))).scalar_one_or_none()
    if not z:
        raise HTTPException(404, "Zone not found")
    await db.delete(z)
    await db.commit()


def _band_label(min_km: float, max_km: float) -> str:
    """Format a distance band as the admin-facing label, e.g. '2,1-3 km'."""
    def fmt(v: float) -> str:
        return str(int(v)) if v == int(v) else ("%.1f" % v).replace(".", ",")
    return f"{fmt(min_km)}-{fmt(max_km)} km"


@router.post("/zones/import")
async def bulk_import_zones(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    CSV import for distance-band delivery fees.

    Header row required:
        distance_min_km,distance_max_km,fee,estimated_minutes

    Bands whose [min, max] window already exists are updated in place
    (fee + estimated_minutes refreshed); bands new to the table are
    inserted with a synthesised neighborhood label like "2,1-3 km".
    Matches by (min, max) pair rather than by name so the operator
    can keep renaming free without losing referential identity.
    """
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    required = {"distance_min_km", "distance_max_km", "fee", "estimated_minutes"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            400, f"CSV must include columns: {', '.join(sorted(required))}"
        )

    inserted = 0
    updated = 0
    errors: list[str] = []

    existing_rows = (await db.execute(select(DeliveryZone))).scalars().all()
    by_band: dict[tuple[float, float], DeliveryZone] = {}
    for z in existing_rows:
        if z.distance_min_km is not None and z.distance_max_km is not None:
            by_band[(float(z.distance_min_km), float(z.distance_max_km))] = z

    for row_idx, row in enumerate(reader, 2):
        try:
            raw_min = (row["distance_min_km"] or "").strip().replace(",", ".")
            raw_max = (row["distance_max_km"] or "").strip().replace(",", ".")
            if not raw_min or not raw_max:
                continue
            min_km = float(raw_min)
            max_km = float(raw_max)
            if max_km <= min_km:
                errors.append(f"row {row_idx}: max ({max_km}) must be > min ({min_km})")
                continue
            fee = float((row["fee"] or "0").replace(",", "."))
            mins = int(row["estimated_minutes"] or 45)
            existing_zone = by_band.get((min_km, max_km))
            if existing_zone:
                existing_zone.fee = fee
                existing_zone.estimated_minutes = mins
                existing_zone.is_active = True
                updated += 1
            else:
                db.add(DeliveryZone(
                    neighborhood=_band_label(min_km, max_km),
                    fee=fee,
                    estimated_minutes=mins,
                    is_active=True,
                    distance_min_km=min_km,
                    distance_max_km=max_km,
                ))
                inserted += 1
        except Exception as e:
            errors.append(f"row {row_idx}: {e}")

    await db.commit()
    return {"inserted": inserted, "updated": updated, "errors": errors}


@router.get("/zones/lookup", response_model=ZoneLookupResult)
async def lookup(q: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    result = await svc.lookup_zone(db, q)
    if not result:
        return ZoneLookupResult(matched=False)
    z = result["zone"]
    return ZoneLookupResult(
        matched=True,
        neighborhood=z.neighborhood,
        fee=float(z.fee),
        estimated_minutes=z.estimated_minutes,
        confidence=result["confidence"],
    )


# ---------- Geocoding helper for the admin Delivery page -----------

class GeocodeQuery(BaseModel):
    address: str = Field(..., min_length=3, max_length=300)


class GeocodeResult(BaseModel):
    found: bool
    lat: Optional[float] = None
    lng: Optional[float] = None
    display_name: Optional[str] = None


@router.post("/geocode", response_model=GeocodeResult)
async def admin_geocode(payload: GeocodeQuery):
    """Geocode a free-form address (used by the 'Buscar coordenadas'
    button on the admin Delivery page)."""
    from app.services import geocode as geocode_svc
    res = await geocode_svc.geocode(free_form=payload.address)
    if not res:
        return GeocodeResult(found=False)
    return GeocodeResult(
        found=True,
        lat=res["lat"],
        lng=res["lng"],
        display_name=res.get("display_name"),
    )


class SimulateQuery(BaseModel):
    address: str = Field(..., min_length=3, max_length=300)


@router.post("/simulate")
async def admin_simulate_delivery(
    payload: SimulateQuery,
    db: AsyncSession = Depends(get_db),
):
    """Admin "test an address" simulator.

    Geocodes the typed address, runs the exact same fee-resolution path
    the bot uses (calculate_fee_by_distance with the saved pizzeria
    coords), and returns:
      - the resolved address + coords
      - driving distance + ETA from Google (Haversine fallback if Google
        is unavailable)
      - the matched delivery band (fee + estimated_minutes) or out-of-
        zone reason
      - a signed Static Maps URL drawing the route between the two pins
        so the operator can eyeball the trajectory

    Used by the admin Delivery page panel that lets operators quote a
    delivery before the customer places the order.
    """
    import urllib.parse

    from app.config import settings
    from app.models.bot_config import BotConfig
    from app.services import geocode as nominatim_svc
    from app.services import google_maps as gmaps

    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    if not cfg or cfg.pizzaria_lat is None or cfg.pizzaria_lng is None:
        raise HTTPException(
            409, "Defina lat/lng da pizzaria antes de simular endereços.",
        )

    # Try Google first (better Brazilian coverage on new addresses),
    # fall back to Nominatim if Google isn't configured or didn't find it.
    g = None
    if settings.google_maps_server_key:
        g = await gmaps.geocode(payload.address)
    if not g:
        n = await nominatim_svc.geocode(free_form=payload.address)
        if n:
            g = {
                "lat": n["lat"],
                "lng": n["lng"],
                "formatted": n.get("display_name"),
                "source": "nominatim",
            }
    if not g:
        return {
            "found": False,
            "reason": "Endereço não localizado pelo Google nem pelo Nominatim.",
        }

    # Run the bot's exact fee resolver with the geocoded coords so the
    # result is identical to what a real customer at that address would
    # see at checkout.
    zone = await svc.resolve_delivery_fee(
        db,
        cfg=cfg,
        customer_lat=g["lat"],
        customer_lng=g["lng"],
    )

    # Build the route image. Falls back gracefully when Google isn't
    # configured — the operator still gets the distance + fee numbers,
    # just without the visual trajectory.
    route_image_url: Optional[str] = None
    polyline: Optional[str] = None
    if settings.google_maps_server_key:
        dirs = await gmaps.directions(
            float(cfg.pizzaria_lat), float(cfg.pizzaria_lng),
            float(g["lat"]), float(g["lng"]),
        )
        if dirs:
            polyline = dirs["polyline"]
        params = {
            "size": "600x300",
            "scale": "2",
            "maptype": "roadmap",
            "language": "pt-BR",
            "markers": [
                f"color:red|label:P|{cfg.pizzaria_lat},{cfg.pizzaria_lng}",
                f"color:blue|label:C|{g['lat']},{g['lng']}",
            ],
            "key": settings.google_maps_server_key,
        }
        if polyline:
            params["path"] = f"weight:4|color:0x86efacdd|enc:{polyline}"
        qs = urllib.parse.urlencode(params, doseq=True, safe="|:,;")
        route_image_url = f"https://maps.googleapis.com/maps/api/staticmap?{qs}"

    return {
        "found": True,
        "address": {
            "formatted": g.get("formatted"),
            "lat": g["lat"],
            "lng": g["lng"],
            "source": g.get("source", "google"),
        },
        "delivery": zone,  # contains fee, distance_km, eta_seconds, etc.
        "route_image_url": route_image_url,
    }

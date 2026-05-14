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


@router.post("/zones/import")
async def bulk_import_zones(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    CSV import — header row required: neighborhood,fee,estimated_minutes
    Existing neighborhoods are updated (case-insensitive); new ones inserted.
    """
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    required = {"neighborhood", "fee", "estimated_minutes"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            400, f"CSV must include columns: {', '.join(sorted(required))}"
        )

    inserted = 0
    updated = 0
    errors: list[str] = []

    existing = {
        z.neighborhood.lower(): z
        for z in (await db.execute(select(DeliveryZone))).scalars().all()
    }

    for row_idx, row in enumerate(reader, 2):
        try:
            name = (row["neighborhood"] or "").strip()
            if not name:
                continue
            fee = float((row["fee"] or "0").replace(",", "."))
            mins = int(row["estimated_minutes"] or 45)
            existing_zone = existing.get(name.lower())
            if existing_zone:
                existing_zone.fee = fee
                existing_zone.estimated_minutes = mins
                existing_zone.is_active = True
                updated += 1
            else:
                db.add(DeliveryZone(neighborhood=name, fee=fee, estimated_minutes=mins, is_active=True))
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

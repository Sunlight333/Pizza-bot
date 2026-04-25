"""
Bridge API — the Windows bridge service on the pizzeria PC polls these endpoints
to pick up pending orders, confirm sync, and pull product tax data.

Auth: separate bridge token (different from admin JWT) so the bridge creds can
be issued/revoked independently. Pass header X-Bridge-Token.
"""
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as redis

from app.config import settings
from app.database import get_db
from app.models.order import Order
from app.models.product import Product
from app.services.datacaixa import generate_order_file, next_filename

log = logging.getLogger(__name__)
router = APIRouter()


async def _verify_bridge(x_bridge_token: str = Header(...)):
    expected = settings.bridge_token or (settings.jwt_secret[:16] + "bridge")
    if not x_bridge_token or x_bridge_token != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid bridge token")


class PendingOrder(BaseModel):
    order_id: int
    order_number: int
    filename: str
    content: str


class ConfirmPayload(BaseModel):
    filename: str


class ProductTax(BaseModel):
    id: int
    name: str
    ncm: str | None
    cfop: str | None
    csosn: str | None
    cest: str | None
    ibpt_code: str | None
    origin_code: str | None
    datacaixa_code: str | None


class HeartbeatPayload(BaseModel):
    host: str
    version: str | None = None


@router.get("/pending", response_model=List[PendingOrder], dependencies=[Depends(_verify_bridge)])
async def pending_orders(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Order).where(Order.datacaixa_synced.is_(False)).order_by(Order.created_at).limit(20)
    )
    orders = res.scalars().all()
    out: list[PendingOrder] = []
    for o in orders:
        content = await generate_order_file(db, o.id)
        filename = await next_filename()
        # Stash filename on the order row so confirm can match
        o.datacaixa_file = filename
        out.append(PendingOrder(order_id=o.id, order_number=o.order_number, filename=filename, content=content))
    await db.commit()
    return out


@router.post("/confirm/{order_id}", dependencies=[Depends(_verify_bridge)])
async def confirm(order_id: int, payload: ConfirmPayload, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone
    from app.models.bot_config import BotConfig

    o = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not o:
        raise HTTPException(404, "order not found")
    o.datacaixa_synced = True
    o.datacaixa_file = payload.filename

    # If the operator opted into 'auto' fiscal emission, mark fiscal_emitted now —
    # we trust Datacaixa to have emitted the cupom on import. With the safe default
    # 'manual' the operator must call /api/orders/{id}/fiscal-emit explicitly.
    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    if cfg and cfg.fiscal_emission_mode == "auto":
        o.fiscal_emitted = True
        o.fiscal_emitted_at = datetime.now(timezone.utc)

    await db.commit()
    return {"ok": True}


@router.get("/product-tax-data", response_model=List[ProductTax], dependencies=[Depends(_verify_bridge)])
async def product_tax_data(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Product).where(Product.is_active.is_(True)))
    return [
        ProductTax(
            id=p.id,
            name=p.name,
            ncm=p.ncm,
            cfop=p.cfop,
            csosn=p.csosn,
            cest=p.cest,
            ibpt_code=p.ibpt_code,
            origin_code=p.origin_code,
            datacaixa_code=p.datacaixa_code,
        )
        for p in res.scalars().all()
    ]


@router.post("/heartbeat", dependencies=[Depends(_verify_bridge)])
async def heartbeat(payload: HeartbeatPayload):
    client = redis.from_url(settings.redis_url, decode_responses=True)
    await client.set(
        "bridge:last_heartbeat",
        datetime.now(timezone.utc).isoformat(),
        ex=600,
    )
    await client.set("bridge:host", payload.host, ex=600)
    if payload.version:
        await client.set("bridge:version", payload.version, ex=600)
    return {"ok": True}


@router.get("/status")
async def status_endpoint():
    """Public — used by the admin panel to show bridge connectivity."""
    client = redis.from_url(settings.redis_url, decode_responses=True)
    last = await client.get("bridge:last_heartbeat")
    host = await client.get("bridge:host")
    version = await client.get("bridge:version")
    online = False
    if last:
        try:
            delta = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds()
            online = delta < 120
        except Exception:
            pass
    return {
        "online": online,
        "last_heartbeat": last,
        "host": host,
        "version": version,
    }

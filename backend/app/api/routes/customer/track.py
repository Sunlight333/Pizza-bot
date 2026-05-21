"""Public order tracking — no auth required, masked PII.

The tracking_token (signed JWT) is what gates access. It's in the URL
query / path, so anyone the customer shares the link with can watch
the status. We mask the address for that reason — only the
neighborhood + last 4 chars of street are shown.

The WebSocket subscribes per order_id; status_change broadcasts from
the admin route are fanned out via tracking_manager.
"""
import json
import urllib.parse

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.bot_config import BotConfig
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.services import google_maps as gmaps
from app.services.customer_tracking import tracking_manager
from app.utils.tracking_token import decode_tracking_token

router = APIRouter()


class StatusEvent(BaseModel):
    status: str
    transitioned_at: str


class PublicTrackingOut(BaseModel):
    order_number: int
    status: str
    total: float
    eta_minutes_hint: int = 45  # best-effort; refined later
    delivery_neighborhood: str | None = None
    address_mask: str | None = None
    items: list[dict]
    history: list[StatusEvent]


def _mask_address(addr: str | None) -> str | None:
    if not addr:
        return None
    if len(addr) <= 8:
        return "•••"
    head = addr[:4]
    tail = addr[-4:]
    return f"{head}••••{tail}"


@router.get("/{token}", response_model=PublicTrackingOut)
async def public_track(token: str, db: AsyncSession = Depends(get_db)):
    try:
        order_id = decode_tracking_token(token)
    except ValueError:
        raise HTTPException(404, "Link inválido ou expirado")

    o = (
        await db.execute(select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if o is None:
        raise HTTPException(404, "Pedido não encontrado")

    history_res = await db.execute(
        select(OrderStatusHistory)
        .where(OrderStatusHistory.order_id == o.id)
        .order_by(OrderStatusHistory.transitioned_at.asc())
    )
    return PublicTrackingOut(
        order_number=o.order_number,
        status=o.status.value,
        total=float(o.total),
        delivery_neighborhood=o.delivery_neighborhood,
        address_mask=_mask_address(o.delivery_address),
        items=[
            {"description": i.description, "quantity": i.quantity}
            for i in o.items
            if not i.is_delivery_fee
        ],
        history=[
            StatusEvent(status=h.status.value, transitioned_at=h.transitioned_at.isoformat())
            for h in history_res.scalars().all()
        ],
    )


_ROUTE_IMAGE_TTL = 30 * 60  # 30 min — about the life of an active delivery
_redis: redis.Redis | None = None


def _redis_client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


@router.get("/{token}/route-image")
async def route_image(token: str, db: AsyncSession = Depends(get_db)):
    """Return a signed Maps Static API URL with the route drawn from the
    pizzeria to the customer, for orders currently out for delivery.

    Returns 404 if the order isn't out_for_delivery, if either endpoint
    is missing coords, or if Google isn't configured. The frontend hides
    the map component on 404 so the page stays clean.
    """
    try:
        order_id = decode_tracking_token(token)
    except ValueError:
        raise HTTPException(404, "Link inválido ou expirado")

    if not settings.google_maps_server_key:
        raise HTTPException(404, "Mapa indisponível")

    cache_key = f"track:routeimg:{order_id}"
    cached = await _redis_client().get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass  # fall through to rebuild

    order = (
        await db.execute(select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if order is None or order.status.value != "out_for_delivery":
        raise HTTPException(404, "Pedido não disponível para mapa")
    if order.delivery_lat is None or order.delivery_lng is None:
        raise HTTPException(404, "Sem coordenadas no pedido")

    cfg = (
        await db.execute(select(BotConfig).where(BotConfig.id == 1))
    ).scalar_one_or_none()
    if not cfg or cfg.pizzaria_lat is None or cfg.pizzaria_lng is None:
        raise HTTPException(404, "Sem coordenadas da pizzaria")

    p_lat, p_lng = float(cfg.pizzaria_lat), float(cfg.pizzaria_lng)
    c_lat, c_lng = float(order.delivery_lat), float(order.delivery_lng)

    route = await gmaps.directions(p_lat, p_lng, c_lat, c_lng)
    polyline = route["polyline"] if route else None

    params = {
        "size": "600x300",
        "scale": "2",
        "maptype": "roadmap",
        "language": "pt-BR",
        "markers": [
            f"color:red|label:P|{p_lat},{p_lng}",
            f"color:blue|label:C|{c_lat},{c_lng}",
        ],
        "key": settings.google_maps_server_key,
    }
    if polyline:
        # `enc:` prefix tells the Static Maps API the path is an encoded
        # polyline rather than a list of lat/lng pairs.
        params["path"] = f"weight:4|color:0xef4444cc|enc:{polyline}"
    # urlencode supports list values for repeated keys (markers).
    qs = urllib.parse.urlencode(params, doseq=True, safe="|:,;")
    url = f"https://maps.googleapis.com/maps/api/staticmap?{qs}"

    payload = {
        "url": url,
        "eta_seconds": route.get("duration_seconds") if route else None,
        "distance_meters": route.get("distance_meters") if route else None,
    }
    await _redis_client().set(cache_key, json.dumps(payload), ex=_ROUTE_IMAGE_TTL)
    return payload


@router.websocket("/ws/{token}")
async def track_ws(websocket: WebSocket, token: str):
    """Subscribe to live status changes for one order. Unauthenticated
    by design — the token is the credential."""
    try:
        order_id = decode_tracking_token(token)
    except ValueError:
        await websocket.close(code=4404)
        return
    await tracking_manager.subscribe(order_id, websocket)
    try:
        while True:
            # Client doesn't need to send anything; we keep the socket
            # open by awaiting messages and dropping them.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await tracking_manager.unsubscribe(order_id, websocket)

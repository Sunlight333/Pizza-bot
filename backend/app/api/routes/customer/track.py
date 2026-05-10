"""Public order tracking — no auth required, masked PII.

The tracking_token (signed JWT) is what gates access. It's in the URL
query / path, so anyone the customer shares the link with can watch
the status. We mask the address for that reason — only the
neighborhood + last 4 chars of street are shown.

The WebSocket subscribes per order_id; status_change broadcasts from
the admin route are fanned out via tracking_manager.
"""
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
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

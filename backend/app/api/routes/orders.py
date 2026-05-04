from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.order import Order, OrderStatus, PaymentMethod
from app.schemas.order import OrderCreate, OrderOut, OrderStats, OrderStatusUpdate
from app.services import order_service
from app.services.websocket import manager

router = APIRouter()
public_router = APIRouter()


def _serialize_items(order: Order):
    return [
        {
            "id": i.id,
            "product_id": i.product_id,
            "description": i.description,
            "unit_price": float(i.unit_price),
            "quantity": i.quantity,
            "unit": i.unit,
            "is_delivery_fee": i.is_delivery_fee,
        }
        for i in (order.items or [])
    ]


def _serialize_order(order: Order) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer_id": order.customer_id,
        "customer_phone": order.customer_phone,
        "status": order.status.value,
        "subtotal": float(order.subtotal),
        "delivery_fee": float(order.delivery_fee),
        "total": float(order.total),
        "payment_method": order.payment_method.value,
        "payment_code": order.payment_code,
        "delivery_address": order.delivery_address,
        "delivery_neighborhood": order.delivery_neighborhood,
        "observation": order.observation,
        "datacaixa_synced": order.datacaixa_synced,
        "datacaixa_file": order.datacaixa_file,
        "fiscal_emitted": order.fiscal_emitted,
        "fiscal_emitted_at": order.fiscal_emitted_at.isoformat() if order.fiscal_emitted_at else None,
        "scheduled_for": order.scheduled_for.isoformat() if order.scheduled_for else None,
        "items": _serialize_items(order),
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
    }


@router.get("", response_model=List[OrderOut], dependencies=[Depends(get_current_user)])
async def list_orders(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    payment: Optional[PaymentMethod] = None,
    customer_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = Query(None, min_length=1, max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    q = select(Order)
    if status_filter:
        q = q.where(Order.status == status_filter)
    if payment:
        q = q.where(Order.payment_method == payment)
    if customer_id:
        q = q.where(Order.customer_id == customer_id)
    if date_from:
        q = q.where(Order.created_at >= date_from)
    if date_to:
        q = q.where(Order.created_at <= date_to)
    if search:
        # Match a numeric order number, the phone (most common operator query),
        # or a free-text fragment in address/observation.
        from sqlalchemy import or_
        like = f"%{search}%"
        clauses = [
            Order.customer_phone.ilike(like),
            Order.delivery_address.ilike(like),
            Order.observation.ilike(like),
        ]
        if search.strip().isdigit():
            clauses.append(Order.order_number == int(search.strip()))
        q = q.where(or_(*clauses))
    q = q.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(q)
    return [_serialize_order(o) for o in res.scalars().all()]


@router.get("/stats", response_model=OrderStats, dependencies=[Depends(get_current_user)])
async def stats(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    cnt_res = await db.execute(
        select(func.count(), func.coalesce(func.sum(Order.total), 0)).where(Order.created_at >= start)
    )
    orders_today, revenue_today = cnt_res.one()
    avg = float(revenue_today) / orders_today if orders_today else 0

    by_status_res = await db.execute(
        select(Order.status, func.count())
        .where(Order.created_at >= start)
        .group_by(Order.status)
    )
    by_status = {row[0].value: int(row[1]) for row in by_status_res.all()}

    hour_res = await db.execute(
        select(
            func.extract("hour", Order.created_at).label("h"),
            func.count().label("c"),
        )
        .where(Order.created_at >= now - timedelta(days=7))
        .group_by("h")
        .order_by("h")
    )
    by_hour = [{"hour": int(r.h), "count": int(r.c)} for r in hour_res.all()]

    # Revenue per day, last 7 days — for the dashboard chart
    rev_res = await db.execute(
        select(
            func.date(Order.created_at).label("d"),
            func.coalesce(func.sum(Order.total), 0).label("rev"),
        )
        .where(Order.created_at >= now - timedelta(days=7))
        .group_by("d")
        .order_by("d")
    )
    revenue_7d = [
        {"date": r.d.isoformat() if hasattr(r.d, "isoformat") else str(r.d),
         "revenue": float(r.rev)}
        for r in rev_res.all()
    ]

    # 7×24 heatmap — day-of-week (0=Sun in Postgres) × hour-of-day
    heatmap_res = await db.execute(
        select(
            func.extract("dow", Order.created_at).label("dow"),
            func.extract("hour", Order.created_at).label("h"),
            func.count().label("c"),
        )
        .where(Order.created_at >= now - timedelta(days=30))
        .group_by("dow", "h")
    )
    by_dow_hour = [
        {"dow": int(r.dow), "hour": int(r.h), "count": int(r.c)}
        for r in heatmap_res.all()
    ]

    sync_pending_res = await db.execute(
        select(func.count()).where(Order.datacaixa_synced.is_(False))
    )
    sync_completed_today_res = await db.execute(
        select(func.count()).where(
            Order.datacaixa_synced.is_(True),
            Order.created_at >= start,
        )
    )

    return OrderStats(
        orders_today=int(orders_today),
        revenue_today=float(revenue_today),
        avg_ticket=avg,
        by_status=by_status,
        by_hour=by_hour,
        revenue_7d=revenue_7d,
        by_dow_hour=by_dow_hour,
        sync_pending=int(sync_pending_res.scalar_one()),
        sync_completed_today=int(sync_completed_today_res.scalar_one()),
    )


@router.get("/{order_id}", response_model=OrderOut, dependencies=[Depends(get_current_user)])
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    o = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Order not found")
    return _serialize_order(o)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(get_current_user)])
async def create_order_route(payload: OrderCreate, db: AsyncSession = Depends(get_db)):
    try:
        order = await order_service.create_order(
            db,
            customer_phone=payload.customer_phone,
            customer_name=payload.customer_name,
            customer_cpf=payload.customer_cpf,
            items_data=[i.model_dump() for i in payload.items],
            delivery_address=payload.delivery_address,
            delivery_neighborhood=payload.delivery_neighborhood,
            delivery_fee=payload.delivery_fee,
            payment_method=payload.payment_method,
            observation=payload.observation,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    data = _serialize_order(order)
    await manager.broadcast("new_order", data)
    return data


@router.put("/{order_id}/status", response_model=OrderOut, dependencies=[Depends(get_current_user)])
async def update_status_route(order_id: int, payload: OrderStatusUpdate, db: AsyncSession = Depends(get_db)):
    try:
        order = await order_service.update_status(db, order_id, payload.status)
    except ValueError as e:
        raise HTTPException(400, str(e))
    data = _serialize_order(order)
    await manager.broadcast("status_change", data)
    return data


@router.get("/{order_id}/history", dependencies=[Depends(get_current_user)])
async def order_status_history(order_id: int, db: AsyncSession = Depends(get_db)):
    from app.models.order_status_history import OrderStatusHistory
    res = await db.execute(
        select(OrderStatusHistory)
        .where(OrderStatusHistory.order_id == order_id)
        .order_by(OrderStatusHistory.transitioned_at.asc())
    )
    return [
        {
            "id": h.id,
            "status": h.status.value,
            "note": h.note,
            "transitioned_at": h.transitioned_at.isoformat(),
        }
        for h in res.scalars().all()
    ]


@router.post("/{order_id}/resync", response_model=OrderOut, dependencies=[Depends(get_current_user)])
async def resync_order(order_id: int, db: AsyncSession = Depends(get_db)):
    """Reset Datacaixa sync flag so the bridge picks the order up again."""
    o = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Order not found")
    o.datacaixa_synced = False
    o.datacaixa_file = None
    await db.commit()
    await db.refresh(o)
    return _serialize_order(o)


@router.post("/{order_id}/fiscal-emit", response_model=OrderOut, dependencies=[Depends(get_current_user)])
async def mark_fiscal_emitted(order_id: int, db: AsyncSession = Depends(get_db)):
    """
    Operator confirms that the cupom fiscal was emitted in Datacaixa for this order.
    Required when bot_config.fiscal_emission_mode='manual' (the safe default until
    Datacaixa's auto-emit behaviour is confirmed).
    """
    from datetime import datetime, timezone
    o = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Order not found")
    if not o.datacaixa_synced:
        raise HTTPException(400, "Order must be synced to Datacaixa before fiscal emission")
    o.fiscal_emitted = True
    o.fiscal_emitted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(o)
    return _serialize_order(o)


@router.get("/fiscal/pending", dependencies=[Depends(get_current_user)])
async def list_pending_fiscal(db: AsyncSession = Depends(get_db)):
    """Orders that were synced to Datacaixa but not yet fiscally emitted.
    Powers the DatacaixaSync widget's manual-confirm queue.
    """
    from sqlalchemy import desc
    res = await db.execute(
        select(Order)
        .where(Order.datacaixa_synced.is_(True), Order.fiscal_emitted.is_(False))
        .order_by(desc(Order.created_at))
        .limit(50)
    )
    out = []
    for o in res.scalars().all():
        out.append({
            "id": o.id,
            "order_number": o.order_number,
            "total": float(o.total),
            "customer_phone": o.customer_phone,
            "datacaixa_file": o.datacaixa_file,
            "created_at": o.created_at.isoformat(),
        })
    return out


# WebSocket — auth via query-string token (subprotocol would be cleaner but
# browsers don't let you set Authorization on WebSocket constructor)
@public_router.websocket("/live")
async def live_orders(ws: WebSocket, token: str = Query(...)):
    from app.utils.security import decode_token

    try:
        decode_token(token)
    except Exception:
        await ws.close(code=4401)
        return

    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive — we don't expect inbound messages
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)

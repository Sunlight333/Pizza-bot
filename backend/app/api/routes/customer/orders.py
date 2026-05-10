"""Customer-facing orders: history list, detail, reorder.

All routes require the customer session cookie. Authorization rule:
order.customer_id must equal session customer_id — this is the entire
authz check; an admin token cannot satisfy it because admin tokens
have no customer audience claim.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.api.routes.customer.deps import get_current_customer
from app.database import get_db
from app.models.customer import Customer
from app.models.customer_cart import CustomerCart
from app.models.order import Order
from app.models.order_status_history import OrderStatusHistory
from app.utils.tracking_token import create_tracking_token

router = APIRouter()


class OrderSummary(BaseModel):
    id: int
    order_number: int
    status: str
    total: float
    item_count: int
    created_at: str
    channel: str


class OrderItemOut(BaseModel):
    description: str
    unit_price: float
    quantity: int
    is_delivery_fee: bool


class StatusEvent(BaseModel):
    status: str
    transitioned_at: str


class OrderDetail(BaseModel):
    id: int
    order_number: int
    status: str
    subtotal: float
    delivery_fee: float
    total: float
    payment_method: str
    delivery_address: str | None = None
    delivery_neighborhood: str | None = None
    observation: str | None = None
    created_at: str
    channel: str
    items: List[OrderItemOut]
    history: List[StatusEvent]
    tracking_token: str


@router.get("", response_model=List[OrderSummary])
async def list_orders(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    res = await db.execute(
        select(Order)
        .where(Order.customer_id == customer.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    orders = res.scalars().all()
    return [
        OrderSummary(
            id=o.id,
            order_number=o.order_number,
            status=o.status.value,
            total=float(o.total),
            item_count=sum(i.quantity for i in o.items if not i.is_delivery_fee),
            created_at=o.created_at.isoformat(),
            channel=o.channel,
        )
        for o in orders
    ]


@router.get("/{order_id}", response_model=OrderDetail)
async def get_order(
    order_id: int,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    o = (
        await db.execute(select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if o is None or o.customer_id != customer.id:
        raise HTTPException(404, "Pedido não encontrado")
    history_res = await db.execute(
        select(OrderStatusHistory)
        .where(OrderStatusHistory.order_id == o.id)
        .order_by(OrderStatusHistory.transitioned_at.asc())
    )
    history = [
        StatusEvent(status=h.status.value, transitioned_at=h.transitioned_at.isoformat())
        for h in history_res.scalars().all()
    ]
    return OrderDetail(
        id=o.id,
        order_number=o.order_number,
        status=o.status.value,
        subtotal=float(o.subtotal),
        delivery_fee=float(o.delivery_fee),
        total=float(o.total),
        payment_method=o.payment_method.value,
        delivery_address=o.delivery_address,
        delivery_neighborhood=o.delivery_neighborhood,
        observation=o.observation,
        created_at=o.created_at.isoformat(),
        channel=o.channel,
        items=[
            OrderItemOut(
                description=i.description,
                unit_price=float(i.unit_price),
                quantity=i.quantity,
                is_delivery_fee=i.is_delivery_fee,
            )
            for i in o.items
        ],
        history=history,
        tracking_token=create_tracking_token(o.id),
    )


@router.post("/{order_id}/reorder")
async def reorder(
    order_id: int,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """Clone an old order's items into the customer's current cart.

    We can only reliably reorder lines that originated from the web
    (they carry the structured _web_meta in CustomerCart history). For
    lines without meta — e.g. WhatsApp orders — we synthesize a best-
    effort entry that adds the product at its first size with no
    crust/extras; the customer can then edit before checkout.
    """
    o = (
        await db.execute(select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if o is None or o.customer_id != customer.id:
        raise HTTPException(404, "Pedido não encontrado")

    new_items: list[dict] = []
    for item in o.items:
        if item.is_delivery_fee or item.product_id is None:
            continue
        new_items.append({
            "product_id": item.product_id,
            "size": "",  # web_cart will fall back to first size
            "crust": None,
            "extras": [],
            "half_with_product_id": None,
            "sem_massa": False,
            "quantity": item.quantity,
        })

    cart_res = await db.execute(
        select(CustomerCart).where(CustomerCart.customer_id == customer.id)
    )
    cart = cart_res.scalar_one_or_none()
    if cart is None:
        cart = CustomerCart(customer_id=customer.id, items=new_items)
        db.add(cart)
    else:
        cart.items = new_items
        flag_modified(cart, "items")
    await db.commit()
    return {"items_added": len(new_items)}

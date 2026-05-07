"""
Order service — creation, sequencing, status transitions.
"""
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.order import PAYMENT_CODE_MAP, Order, OrderStatus, PaymentMethod
from app.models.order_item import OrderItem
from app.services.customer_service import find_or_create_by_phone


VALID_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.received: {OrderStatus.confirmed, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.preparing, OrderStatus.cancelled},
    OrderStatus.preparing: {OrderStatus.out_for_delivery, OrderStatus.cancelled},
    OrderStatus.out_for_delivery: {OrderStatus.delivered, OrderStatus.cancelled},
    OrderStatus.delivered: set(),
    OrderStatus.cancelled: set(),
}


async def next_order_number(db: AsyncSession) -> int:
    """Per-day sequential — resets at midnight local."""
    today = datetime.now(timezone.utc).date()
    start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    res = await db.execute(
        select(func.coalesce(func.max(Order.order_number), 0)).where(Order.created_at >= start)
    )
    return int(res.scalar_one() or 0) + 1


async def create_order(
    db: AsyncSession,
    *,
    customer_phone: str,
    customer_name: str | None,
    customer_cpf: str | None,
    items_data: Iterable[dict],
    delivery_address: str | None,
    delivery_neighborhood: str | None,
    delivery_fee: float,
    payment_method: PaymentMethod,
    observation: str | None,
    scheduled_for: datetime | None = None,
    delivery_lat: float | None = None,
    delivery_lng: float | None = None,
) -> Order:
    items_list = [dict(i) for i in items_data]
    if not items_list:
        raise ValueError("Order requires at least one item")

    customer = await find_or_create_by_phone(db, customer_phone)
    if customer_name and not customer.name:
        customer.name = customer_name
    if customer_cpf and not customer.cpf:
        customer.cpf = customer_cpf

    subtotal = sum(float(i["unit_price"]) * int(i.get("quantity", 1)) for i in items_list if not i.get("is_delivery_fee"))
    total = subtotal + float(delivery_fee or 0)

    number = await next_order_number(db)

    order = Order(
        customer_id=customer.id,
        order_number=number,
        status=OrderStatus.received,
        subtotal=subtotal,
        delivery_fee=delivery_fee or 0,
        total=total,
        payment_method=payment_method,
        payment_code=PAYMENT_CODE_MAP[payment_method],
        delivery_address=delivery_address,
        delivery_neighborhood=delivery_neighborhood,
        delivery_lat=delivery_lat,
        delivery_lng=delivery_lng,
        customer_phone=customer_phone,
        observation=observation,
        scheduled_for=scheduled_for,
    )
    db.add(order)
    await db.flush()

    for entry in items_list:
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=entry.get("product_id"),
                description=entry["description"],
                unit_price=float(entry["unit_price"]),
                quantity=int(entry.get("quantity", 1)),
                unit=entry.get("unit", "UN"),
                is_delivery_fee=bool(entry.get("is_delivery_fee", False)),
            )
        )

    # If delivery_fee > 0 and not already in items, add a delivery-fee item line
    if delivery_fee and delivery_fee > 0 and not any(i.get("is_delivery_fee") for i in items_list):
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=None,
                description="Taxa de Entrega",
                unit_price=float(delivery_fee),
                quantity=1,
                unit="UN",
                is_delivery_fee=True,
            )
        )

    from app.models.order_status_history import OrderStatusHistory
    db.add(OrderStatusHistory(order_id=order.id, status=OrderStatus.received))

    customer.total_orders = (customer.total_orders or 0) + 1
    customer.last_order_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(order)
    return order


async def update_status(db: AsyncSession, order_id: int, new_status: OrderStatus) -> Order:
    from app.models.order_status_history import OrderStatusHistory

    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one_or_none()
    if order is None:
        raise ValueError(f"Order {order_id} not found")
    if new_status != order.status and new_status not in VALID_TRANSITIONS[order.status]:
        raise ValueError(f"Invalid transition {order.status.value} → {new_status.value}")
    if new_status != order.status:
        db.add(OrderStatusHistory(order_id=order.id, status=new_status))
    order.status = new_status
    await db.commit()
    await db.refresh(order)
    return order

"""Customer service — used by webhook/bot and admin API."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.order import Order, OrderStatus


async def find_or_create_by_phone(
    db: AsyncSession,
    phone: str,
    *,
    push_name: Optional[str] = None,
) -> Customer:
    """Find an existing customer or create a new one for the phone/JID.

    `push_name` is the WhatsApp display name from the incoming message.
    For anonymised LID contacts (where we never get a real phone number)
    this is the only human-readable label we can show in the panel; we
    write it to `name` when the customer hasn't set it themselves.
    """
    phone = phone.strip()
    existing = (
        await db.execute(select(Customer).where(Customer.phone == phone))
    ).scalar_one_or_none()
    if existing:
        # Backfill name from pushName if we never had one — useful when the
        # row was created before pushName capture landed, or for LID
        # contacts where pushName is the only label we have.
        if push_name and not existing.name:
            existing.name = push_name.strip()[:120]
            await db.commit()
            await db.refresh(existing)
        return existing
    c = Customer(
        phone=phone,
        name=(push_name.strip()[:120] if push_name else None),
        addresses=[],
        default_address_index=0,
        total_orders=0,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


async def get_returning_customer_context(db: AsyncSession, customer_id: int) -> Optional[dict]:
    """Return last delivered order summary for 'repeat last order' flow."""
    res = await db.execute(
        select(Order)
        .where(
            Order.customer_id == customer_id,
            Order.status.in_([OrderStatus.delivered, OrderStatus.out_for_delivery, OrderStatus.preparing]),
        )
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    last = res.scalar_one_or_none()
    if not last:
        return None
    return {
        "order_id": last.id,
        "order_number": last.order_number,
        "items": [
            {"description": i.description, "unit_price": float(i.unit_price), "quantity": i.quantity}
            for i in last.items
            if not i.is_delivery_fee
        ],
        "payment_method": last.payment_method.value,
        "delivery_address": last.delivery_address,
        "delivery_neighborhood": last.delivery_neighborhood,
        "total": float(last.total),
    }


async def update_address(db: AsyncSession, customer_id: int, address: dict) -> Customer:
    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one()
    addrs = list(c.addresses or [])
    addrs.append(address)
    c.addresses = addrs
    c.default_address_index = len(addrs) - 1
    await db.commit()
    await db.refresh(c)
    return c

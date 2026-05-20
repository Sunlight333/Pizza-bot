from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.models.order import Order
from app.schemas.customer import CustomerListItem, CustomerOut, CustomerUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])

# Exact phrase the operator must type to confirm a full wipe. Kept as a
# Portuguese string so the admin UI prompt and the backend check live in
# the same language the operator sees on screen.
WIPE_ALL_CONFIRMATION = "APAGAR TUDO"


class BulkDeleteIn(BaseModel):
    ids: List[int] = Field(..., min_length=1, max_length=500)


class WipeAllIn(BaseModel):
    confirm: str


@router.get("", response_model=List[CustomerListItem])
async def list_customers(
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query("last_order_at", pattern="^(last_order_at|total_orders|name|created_at)$"),
    db: AsyncSession = Depends(get_db),
):
    q = select(Customer)
    if search:
        q = q.where(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
            )
        )
    sort_map = {
        "last_order_at": Customer.last_order_at.desc().nulls_last(),
        "total_orders": Customer.total_orders.desc(),
        "name": Customer.name.asc().nulls_last(),
        "created_at": Customer.created_at.desc(),
    }
    q = q.order_by(sort_map[sort]).limit(limit).offset(offset)
    res = await db.execute(q)
    return res.scalars().all()


@router.get("/{customer_id}")
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Customer not found")

    res = await db.execute(
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
        .limit(20)
    )
    orders = res.scalars().all()

    # Pull the linked CustomerAccount (web-portal account) if it exists.
    # Surfacing email / opt-in / birthday / verification state in the
    # admin Clientes drawer lets the operator answer questions like
    # "is this customer registered on the web?" without bouncing
    # between tables.
    account = (
        await db.execute(
            select(CustomerAccount).where(CustomerAccount.customer_id == customer_id)
        )
    ).scalar_one_or_none()

    payload = CustomerOut.model_validate(c).model_dump()
    payload["account"] = (
        {
            "email": account.email,
            "email_verified": account.email_verified,
            "marketing_opt_in": account.marketing_opt_in,
            "phone_verified_at": account.phone_verified_at.isoformat()
            if account.phone_verified_at else None,
            "last_login_at": account.last_login_at.isoformat()
            if account.last_login_at else None,
            "created_at": account.created_at.isoformat(),
        }
        if account is not None
        else None
    )
    payload["birthday"] = c.birthday.isoformat() if c.birthday else None
    payload["orders"] = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status.value,
            "total": float(o.total),
            "payment_method": o.payment_method.value,
            "created_at": o.created_at.isoformat(),
            "items": [
                {"description": i.description, "quantity": i.quantity, "unit_price": float(i.unit_price)}
                for i in o.items
            ],
        }
        for o in orders
    ]
    return payload


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
):
    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Customer not found")
    data = payload.model_dump(exclude_unset=True)
    if "addresses" in data and data["addresses"] is not None:
        data["addresses"] = [a if isinstance(a, dict) else a.model_dump() for a in data["addresses"]]
    for k, v in data.items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return c


async def _delete_customers(db: AsyncSession, ids: List[int]) -> int:
    # orders.customer_id is ON DELETE RESTRICT, so we have to drop the
    # orders ourselves before the customer rows can go. order_items and
    # order_status_history cascade off orders, and customer_accounts /
    # customer_carts cascade off customers — so two deletes is enough.
    # conversations / conversation_messages use SET NULL on customer_id,
    # which preserves the chat log but anonymizes it (intentional: keeps
    # message history queryable for analytics without holding PII).
    await db.execute(delete(Order).where(Order.customer_id.in_(ids)))
    res = await db.execute(delete(Customer).where(Customer.id.in_(ids)))
    await db.commit()
    return res.rowcount or 0


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    exists = (await db.execute(select(Customer.id).where(Customer.id == customer_id))).scalar_one_or_none()
    if not exists:
        raise HTTPException(404, "Customer not found")
    await _delete_customers(db, [customer_id])


@router.post("/bulk-delete")
async def bulk_delete_customers(
    payload: BulkDeleteIn,
    db: AsyncSession = Depends(get_db),
):
    deleted = await _delete_customers(db, payload.ids)
    return {"deleted": deleted}


@router.post("/wipe-all")
async def wipe_all_customers(
    payload: WipeAllIn,
    db: AsyncSession = Depends(get_db),
):
    if payload.confirm != WIPE_ALL_CONFIRMATION:
        raise HTTPException(
            400,
            f"Confirmação inválida. Digite exatamente '{WIPE_ALL_CONFIRMATION}' para apagar tudo.",
        )
    # Mirror scripts/reset_for_launch.sh: same 8 tables, same order. Using
    # TRUNCATE ... CASCADE in one statement so partial failure isn't a
    # possibility — either all operational data is gone or none of it is.
    # users/products/categories/delivery_zones/bot_config/alembic_version
    # are deliberately omitted to preserve admin access and the catalog.
    await db.execute(text(
        "TRUNCATE TABLE "
        "conversation_messages, conversations, "
        "customer_carts, customer_accounts, "
        "order_status_history, order_items, orders, "
        "customers "
        "RESTART IDENTITY CASCADE"
    ))
    await db.commit()
    return {"wiped": True}


@router.get("/{customer_id}/orders")
async def get_customer_orders(customer_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
        .limit(50)
    )
    orders = res.scalars().all()
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "status": o.status.value,
            "total": float(o.total),
            "payment_method": o.payment_method.value,
            "created_at": o.created_at.isoformat(),
            "items": [
                {"description": i.description, "quantity": i.quantity, "unit_price": float(i.unit_price)}
                for i in o.items
            ],
        }
        for o in orders
    ]

"""Server-side cart for the logged-in customer.

Stores the structured selection (size/crust/extras/half) — NOT the
priced lines. Every read goes through web_cart.build_lines so prices
always reflect the current menu state. If a price changes between
add-to-cart and checkout, the customer sees the new total before
placing the order.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.routes.customer.deps import get_current_customer
from app.database import get_db
from app.models.customer import Customer
from app.models.customer_cart import CustomerCart
from app.services import web_cart

router = APIRouter()


class CartItemIn(BaseModel):
    product_id: int
    size: Optional[str] = None
    crust: Optional[str] = None
    extras: List[str] = Field(default_factory=list)
    half_with_product_id: Optional[int] = None
    sem_massa: bool = False
    quantity: int = Field(default=1, ge=1, le=20)
    observation: Optional[str] = None


class CartIn(BaseModel):
    items: List[CartItemIn] = Field(default_factory=list)


class CartLineOut(BaseModel):
    product_id: int
    description: str
    unit_price: float
    quantity: int
    line_total: float
    image_url: Optional[str] = None
    meta: dict


class CartOut(BaseModel):
    items: List[CartLineOut]
    subtotal: float
    item_count: int


async def _load_cart(db: AsyncSession, customer: Customer) -> CustomerCart:
    res = await db.execute(
        select(CustomerCart).where(CustomerCart.customer_id == customer.id)
    )
    cart = res.scalar_one_or_none()
    if cart is None:
        cart = CustomerCart(customer_id=customer.id, items=[])
        db.add(cart)
        await db.flush()
    return cart


def _present(lines: list[dict]) -> CartOut:
    out_items = [
        CartLineOut(
            product_id=l["product_id"],
            description=l["description"],
            unit_price=l["unit_price"],
            quantity=l["quantity"],
            line_total=round(l["unit_price"] * l["quantity"], 2),
            image_url=l["_web_meta"].get("image_url"),
            meta=l["_web_meta"],
        )
        for l in lines
    ]
    subtotal = sum(i.line_total for i in out_items)
    return CartOut(
        items=out_items,
        subtotal=round(subtotal, 2),
        item_count=sum(i.quantity for i in out_items),
    )


@router.get("", response_model=CartOut)
async def get_cart(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    cart = await _load_cart(db, customer)
    try:
        lines = await web_cart.build_lines(db, cart.items or [])
    except web_cart.WebCartError as e:
        # Stale items (deactivated product, etc) — drop them silently and
        # return what we can. Frontend re-renders without the removed line.
        kept = []
        for item in cart.items or []:
            try:
                kept.extend(await web_cart.build_lines(db, [item]))
            except web_cart.WebCartError:
                continue
        cart.items = [k["_web_meta"] | {"observation": k.get("observation")} for k in kept]
        flag_modified(cart, "items")
        await db.commit()
        lines = kept
    return _present(lines)


@router.put("", response_model=CartOut)
async def replace_cart(
    payload: CartIn,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    structured = [i.model_dump() for i in payload.items]
    try:
        lines = await web_cart.build_lines(db, structured)
    except web_cart.WebCartError as e:
        raise HTTPException(409, str(e))
    cart = await _load_cart(db, customer)
    cart.items = structured
    flag_modified(cart, "items")
    await db.commit()
    return _present(lines)


@router.post("/import", response_model=CartOut)
async def import_cart(
    payload: CartIn,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """Merge a guest (localStorage) cart into the server cart on login.

    Strategy: if the server cart is empty, take the local cart wholesale.
    Otherwise keep the server cart (cross-device wins) and ignore the
    local one. Frontend offers an explicit "use the cart from this
    device" button for the override case.
    """
    cart = await _load_cart(db, customer)
    if not cart.items:
        return await replace_cart(payload, customer=customer, db=db)
    lines = await web_cart.build_lines(db, cart.items or [])
    return _present(lines)


@router.delete("", response_model=CartOut)
async def clear_cart(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    cart = await _load_cart(db, customer)
    cart.items = []
    flag_modified(cart, "items")
    await db.commit()
    return _present([])

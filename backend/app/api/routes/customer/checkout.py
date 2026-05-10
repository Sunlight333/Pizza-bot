"""Checkout — quote + place.

quote: idempotent. Pulls the customer's saved cart (or accepts an
overriding payload), resolves delivery fee for the selected address,
returns canonical totals. Called on every checkout-page mount and on
address change.

place: the side-effect endpoint. Builds order_service-shape items via
web_cart, finalizes via order_service.create_order (same path the bot
uses), broadcasts new_order over WebSocket, returns a tracking token.

Idempotency: clients pass an idempotency_key on /place; we cache the
order_id under `checkout:idem:{customer_id}:{key}` for 30 min to defeat
double-submit (page refresh, button mash, network retry).
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import redis.asyncio as redis

from app.api.routes.customer.deps import get_current_customer
from app.api.routes.customer.menu import _client as _redis_client
from app.config import settings
from app.database import get_db
from app.models.customer import Customer
from app.models.customer_cart import CustomerCart
from app.models.order import PaymentMethod
from app.services import delivery as delivery_svc
from app.services import order_service, web_cart
from app.utils.tracking_token import create_tracking_token

log = logging.getLogger(__name__)
router = APIRouter()


class CheckoutBody(BaseModel):
    address_index: int = Field(..., ge=0)
    payment_method: PaymentMethod
    observation: Optional[str] = Field(default=None, max_length=500)
    change_for: Optional[float] = Field(default=None, ge=0)
    items: Optional[list[dict]] = None  # optional: override server cart for one-shot quote


class PlaceBody(CheckoutBody):
    idempotency_key: str = Field(..., min_length=8, max_length=64)


class QuoteOut(BaseModel):
    items: list[dict]
    subtotal: float
    delivery_fee: float
    total: float
    eta_minutes: Optional[int] = None
    delivery_neighborhood: Optional[str] = None
    error: Optional[str] = None  # 'out_of_zone', 'cart_empty', etc.


def _select_address(customer: Customer, idx: int) -> Optional[dict]:
    addrs = list(customer.addresses or [])
    if idx < 0 or idx >= len(addrs):
        return None
    return addrs[idx]


async def _structured_items(
    db: AsyncSession, customer: Customer, override: Optional[list[dict]]
) -> list[dict]:
    if override is not None:
        return override
    res = await db.execute(
        select(CustomerCart).where(CustomerCart.customer_id == customer.id)
    )
    cart = res.scalar_one_or_none()
    return list(cart.items) if cart and cart.items else []


@router.post("/quote", response_model=QuoteOut)
async def quote(
    body: CheckoutBody,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    structured = await _structured_items(db, customer, body.items)
    if not structured:
        return QuoteOut(items=[], subtotal=0, delivery_fee=0, total=0, error="cart_empty")

    try:
        lines = await web_cart.build_lines(db, structured)
    except web_cart.WebCartError as e:
        raise HTTPException(409, str(e))

    address = _select_address(customer, body.address_index)
    delivery_fee = 0.0
    eta = None
    neighborhood = None
    err: Optional[str] = None
    if address is None:
        err = "no_address"
    else:
        neighborhood = address.get("neighborhood")
        zone = await delivery_svc.calculate_fee(db, neighborhood or "")
        if zone is None:
            err = "out_of_zone"
        else:
            delivery_fee = zone["fee"]
            eta = zone["estimated_minutes"]

    presented = [
        {
            "product_id": l["product_id"],
            "description": l["description"],
            "unit_price": l["unit_price"],
            "quantity": l["quantity"],
            "line_total": round(l["unit_price"] * l["quantity"], 2),
            "image_url": l["_web_meta"].get("image_url"),
        }
        for l in lines
    ]
    t = web_cart.totals(lines, delivery_fee)
    return QuoteOut(
        items=presented,
        subtotal=t["subtotal"],
        delivery_fee=t["delivery_fee"],
        total=t["total"],
        eta_minutes=eta,
        delivery_neighborhood=neighborhood,
        error=err,
    )


def _idem_key(customer_id: int, key: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]", "", key)[:64]
    return f"checkout:idem:{customer_id}:{safe}"


@router.post("/place", status_code=status.HTTP_201_CREATED)
async def place(
    body: PlaceBody,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    rclient = _redis_client()
    idem_k = _idem_key(customer.id, body.idempotency_key)

    cached = await rclient.get(idem_k)
    if cached:
        return json.loads(cached)

    structured = await _structured_items(db, customer, body.items)
    if not structured:
        raise HTTPException(409, "Carrinho vazio")

    try:
        lines = await web_cart.build_lines(db, structured)
    except web_cart.WebCartError as e:
        raise HTTPException(409, str(e))

    address = _select_address(customer, body.address_index)
    if address is None:
        raise HTTPException(400, "Selecione um endereço de entrega")
    zone = await delivery_svc.calculate_fee(db, address.get("neighborhood") or "")
    if zone is None:
        raise HTTPException(409, "Não entregamos neste bairro")

    addr_str = ", ".join(filter(None, [
        address.get("street"),
        address.get("number"),
        address.get("complement"),
    ]))
    if address.get("reference"):
        addr_str += f" (ref: {address['reference']})"

    obs = (body.observation or "").strip() or None
    if body.payment_method == PaymentMethod.cash and body.change_for is not None:
        change_note = (
            f"Troco para R$ {body.change_for:.2f}".replace(".", ",")
            if body.change_for > 0 else "Paga exato (sem troco)"
        )
        obs = (obs + " | " if obs else "") + change_note

    items_for_order = [
        {k: v for k, v in line.items() if k != "_web_meta" and k != "observation"}
        for line in lines
    ]

    order = await order_service.create_order(
        db,
        customer_phone=customer.phone,
        customer_name=customer.name,
        customer_cpf=customer.cpf,
        items_data=items_for_order,
        delivery_address=addr_str,
        delivery_neighborhood=address.get("neighborhood"),
        delivery_fee=zone["fee"],
        payment_method=body.payment_method,
        observation=obs,
    )

    # Stamp the channel — distinguishes web orders in admin / reports.
    order.channel = "web"
    await db.commit()
    await db.refresh(order)

    # Clear the persistent cart now that the order is placed.
    cart_res = await db.execute(
        select(CustomerCart).where(CustomerCart.customer_id == customer.id)
    )
    cart = cart_res.scalar_one_or_none()
    if cart:
        cart.items = []
        await db.commit()

    # Broadcast for live admin dashboard. Same shape the bot orders use.
    try:
        from app.services.websocket import manager
        from app.api.routes.orders import _serialize_order
        await manager.broadcast("new_order", _serialize_order(order))
    except Exception:
        log.exception("websocket broadcast failed for order %s", order.id)

    token = create_tracking_token(order.id)
    response = {
        "order_id": order.id,
        "order_number": order.order_number,
        "total": float(order.total),
        "tracking_token": token,
    }
    await rclient.set(idem_k, json.dumps(response), ex=30 * 60)
    return response

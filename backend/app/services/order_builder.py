"""
Order builder — shapes the cart held in Redis and finalizes it into a DB Order.
Operates on the raw dict structure used by conversation_state.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import PaymentMethod
from app.models.product import Product
from app.services import order_service
from app.services.menu_service import (
    build_pizza_description,
    calculate_half_pizza_price,
    validate_combination,
)


async def _load_products(db: AsyncSession, ids: list[int]) -> dict[int, Product]:
    if not ids:
        return {}
    res = await db.execute(select(Product).where(Product.id.in_(ids)))
    return {p.id: p for p in res.scalars().all()}


async def add_pizza(
    db: AsyncSession,
    cart: dict,
    *,
    flavor_ids: list[int],
    size: str,
    crust: Optional[str] = None,
    extras: Optional[list[str]] = None,
    quantity: int = 1,
) -> dict:
    products = await _load_products(db, flavor_ids)
    flavors = [products[i] for i in flavor_ids if i in products]
    if len(flavors) != len(flavor_ids):
        raise ValueError("Sabor desconhecido")

    validate_combination(flavors, size, crust, extras)

    if len(flavors) == 1:
        price = next(
            (float(s["price"]) for s in (flavors[0].sizes or []) if s["size"].lower() == size.lower()),
            None,
        )
        if price is None:
            raise ValueError(f"Tamanho '{size}' indisponível")
    elif len(flavors) == 2:
        from app.models.bot_config import BotConfig
        cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
        mode = (cfg.half_pizza_pricing if cfg else "max") or "max"
        price = calculate_half_pizza_price(flavors[0], flavors[1], size, mode=mode)
    else:
        # 3+ flavors — defensive (BR pizzarias rarely allow this; bot validates earlier).
        # Use max across all halves regardless of mode — averaging doesn't generalise cleanly.
        prices = []
        for f in flavors:
            p = next((float(s["price"]) for s in (f.sizes or []) if s["size"].lower() == size.lower()), None)
            if p is None:
                raise ValueError(f"Tamanho '{size}' indisponível para {f.name}")
            prices.append(p)
        price = max(prices)

    description = build_pizza_description(flavors, size, crust, extras)
    item = {
        "product_id": flavors[0].id,  # representative; Datacaixa uses description
        "description": description,
        "unit_price": price,
        "quantity": quantity,
        "unit": "UN",
        "is_delivery_fee": False,
    }
    items = cart.setdefault("items", [])
    items.append(item)
    return item


async def add_simple_product(db: AsyncSession, cart: dict, *, product_id: int, quantity: int = 1, size: str = "único") -> dict:
    p = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not p:
        raise ValueError("Produto não encontrado")
    price = next((float(s["price"]) for s in (p.sizes or []) if s["size"].lower() == size.lower()), None)
    if price is None:
        # fall back to first size
        if p.sizes:
            size = p.sizes[0]["size"]
            price = float(p.sizes[0]["price"])
        else:
            raise ValueError("Produto sem preço")
    desc = f"{p.name}" + (f" ({size})" if size.lower() != "único" else "")
    item = {
        "product_id": p.id,
        "description": desc,
        "unit_price": price,
        "quantity": quantity,
        "unit": "UN",
        "is_delivery_fee": False,
    }
    cart.setdefault("items", []).append(item)
    return item


def remove_item(cart: dict, index: int) -> None:
    items = cart.get("items", [])
    if 0 <= index < len(items):
        items.pop(index)


def cart_totals(cart: dict) -> tuple[float, float, float]:
    subtotal = sum(float(i["unit_price"]) * int(i.get("quantity", 1)) for i in cart.get("items", []))
    fee = float(cart.get("delivery_fee", 0) or 0)
    return subtotal, fee, subtotal + fee


def cart_summary(cart: dict) -> str:
    lines = []
    for i, it in enumerate(cart.get("items", []), 1):
        price = float(it["unit_price"]) * int(it.get("quantity", 1))
        lines.append(f"{i}. {it['quantity']}× {it['description']} — R$ {price:.2f}".replace(".", ","))
    sub, fee, total = cart_totals(cart)
    lines.append(f"\nSubtotal: R$ {sub:.2f}".replace(".", ","))
    if fee:
        lines.append(f"Entrega: R$ {fee:.2f}".replace(".", ","))
    lines.append(f"*Total: R$ {total:.2f}*".replace(".", ","))
    return "\n".join(lines)


async def finalize(db: AsyncSession, *, phone: str, cart: dict, customer_name: Optional[str] = None) -> dict:
    if not cart.get("items"):
        raise ValueError("Carrinho vazio")
    payment = cart.get("payment_method")
    if not payment:
        raise ValueError("Forma de pagamento não definida")
    pm = PaymentMethod(payment)

    order = await order_service.create_order(
        db,
        customer_phone=phone,
        customer_name=customer_name or cart.get("customer_name"),
        customer_cpf=cart.get("customer_cpf"),
        items_data=cart["items"],
        delivery_address=cart.get("delivery_address"),
        delivery_neighborhood=cart.get("delivery_neighborhood"),
        delivery_fee=float(cart.get("delivery_fee", 0) or 0),
        payment_method=pm,
        observation=cart.get("observation"),
    )

    from app.services.websocket import manager
    from app.api.routes.orders import _serialize_order
    await manager.broadcast("new_order", _serialize_order(order))

    return {"order_id": order.id, "order_number": order.order_number, "total": float(order.total)}

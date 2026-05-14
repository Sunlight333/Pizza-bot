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
    crust_price,
    extras_price_total,
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
    sem_massa: bool = False,
) -> dict:
    products = await _load_products(db, flavor_ids)
    flavors = [products[i] for i in flavor_ids if i in products]
    if len(flavors) != len(flavor_ids):
        missing = [i for i in flavor_ids if i not in products]
        raise ValueError(
            f"flavor_ids inválidos: {missing}. Use os IDs marcados com [id:N] "
            f"no CARDÁPIO do system prompt — não chute. Se não achar o sabor "
            f"que o cliente quer, pergunte com ask_clarification."
        )

    validate_combination(flavors, size, crust, extras)

    # If the pizzaria opted into flat pizza pricing in BotConfig, every pizza
    # uses that price as the base — no per-size lookup, no half-pizza math.
    # Crust upcharges and paid extras still add on top.
    from app.models.bot_config import BotConfig
    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()

    flat_with = float(cfg.pizza_flat_price_with_crust) if cfg and cfg.pizza_flat_price_with_crust is not None else None
    flat_without = float(cfg.pizza_flat_price_without_crust) if cfg and cfg.pizza_flat_price_without_crust is not None else None

    if sem_massa:
        if flat_without is None:
            raise ValueError(
                "Pizza sem massa não está habilitada (configure pizza_flat_price_without_crust)."
            )
        price = flat_without
        # When the customer goes sem massa, paid bordas don't apply (no crust
        # to recheio). Silently ignore any crust the LLM passed.
        crust = None
    elif flat_with is not None:
        price = flat_with
    elif len(flavors) == 1:
        price = next(
            (float(s["price"]) for s in (flavors[0].sizes or []) if s["size"].lower() == size.lower()),
            None,
        )
        if price is None:
            raise ValueError(f"Tamanho '{size}' indisponível")
    elif len(flavors) == 2:
        mode = (cfg.half_pizza_pricing if cfg else "max") or "max"
        price = calculate_half_pizza_price(flavors[0], flavors[1], size, mode=mode)
    else:
        # 3+ flavors — defensive (BR pizzarias rarely allow this; bot validates earlier).
        prices = []
        for f in flavors:
            p = next((float(s["price"]) for s in (f.sizes or []) if s["size"].lower() == size.lower()), None)
            if p is None:
                raise ValueError(f"Tamanho '{size}' indisponível para {f.name}")
            prices.append(p)
        price = max(prices)

    # Paid extras (e.g. "extra queijo R$ 5") and stuffed-crust upcharges
    # (catupiry/cheddar) add to the unit price; free options ("sem borda",
    # cebola, requeijão) are catalogued at 0 and pass through.
    price = round(
        price
        + crust_price(flavors[0], crust, size)
        + extras_price_total(flavors[0], extras, size),
        2,
    )

    description = build_pizza_description(flavors, size, crust, extras)
    if sem_massa:
        description = description + " (SEM MASSA)"
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


async def finalize(
    db: AsyncSession,
    *,
    phone: str,
    cart: dict,
    customer_name: Optional[str] = None,
    scheduled_for=None,
) -> dict:
    if not cart.get("items"):
        raise ValueError("Carrinho vazio")
    payment = cart.get("payment_method")
    if not payment:
        raise ValueError("Forma de pagamento não definida")
    pm = PaymentMethod(payment)

    # Stitch operational notes into observation so the cashier and the
    # motoboy see them on the printed ticket.
    obs = (cart.get("observation") or "").strip()
    notes: list[str] = []
    change_for = cart.get("change_for")
    if pm == PaymentMethod.cash and change_for is not None:
        try:
            cf = float(change_for)
        except (TypeError, ValueError):
            cf = 0.0
        notes.append(
            f"Troco para R$ {cf:.2f}".replace(".", ",")
            if cf > 0 else "Paga exato (sem troco)"
        )
    lat = cart.get("delivery_lat")
    lng = cart.get("delivery_lng")
    if lat is not None and lng is not None:
        notes.append(f"GPS: {lat}, {lng}")
    if notes:
        obs = (obs + " | " if obs else "") + " | ".join(notes)

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
        observation=obs or None,
        scheduled_for=scheduled_for,
        delivery_lat=lat,
        delivery_lng=lng,
    )

    from app.services.websocket import manager
    from app.api.routes.orders import _serialize_order
    await manager.broadcast("new_order", _serialize_order(order))

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "total": float(order.total),
        "scheduled_for": scheduled_for.isoformat() if scheduled_for else None,
    }

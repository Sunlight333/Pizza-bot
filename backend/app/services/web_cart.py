"""Server-side cart builder for the customer portal.

Takes the structured selection the web UI sends (product_id, size,
crust, extras, half_with_product_id, quantity) and computes the
canonical line items in the shape order_service.create_order consumes.

Pricing math is the SAME as the bot's: it goes through
menu_service.crust_price / extras_price_total /
calculate_half_pizza_price, plus the BotConfig flat-pricing override
when configured. Client-side display is informational; this service is
the source of truth.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bot_config import BotConfig
from app.models.product import Product
from app.services.menu_service import (
    build_pizza_description,
    calculate_half_pizza_price,
    crust_price,
    extras_price_total,
    validate_combination,
)


class WebCartError(Exception):
    """Raised when the structured cart can't be priced. Message is
    customer-friendly Portuguese (surfaced in the UI verbatim)."""


async def _load_products(db: AsyncSession, ids: set[int]) -> dict[int, Product]:
    if not ids:
        return {}
    res = await db.execute(select(Product).where(Product.id.in_(ids)))
    return {p.id: p for p in res.scalars().all()}


async def _bot_config(db: AsyncSession) -> Optional[BotConfig]:
    res = await db.execute(select(BotConfig).where(BotConfig.id == 1))
    return res.scalar_one_or_none()


def _flat_prices(cfg: Optional[BotConfig]) -> tuple[Optional[float], Optional[float]]:
    if cfg is None:
        return (None, None)
    fw = float(cfg.pizza_flat_price_with_crust) if cfg.pizza_flat_price_with_crust is not None else None
    fwo = float(cfg.pizza_flat_price_without_crust) if cfg.pizza_flat_price_without_crust is not None else None
    return (fw, fwo)


async def build_lines(
    db: AsyncSession,
    structured_items: list[dict],
) -> list[dict]:
    """Validate + price every line. Raises WebCartError on the first
    invalid item.

    Each input dict shape:
      {
        "product_id": int,
        "size": str,
        "crust": Optional[str],
        "extras": Optional[list[str]],
        "half_with_product_id": Optional[int],
        "sem_massa": Optional[bool],
        "quantity": Optional[int] = 1,
      }

    Returns line dicts in the order_service shape:
      {product_id, description, unit_price, quantity, unit, is_delivery_fee,
       _web_meta: {...original input...}}
    """
    if not structured_items:
        return []

    needed_ids = set()
    for it in structured_items:
        if pid := it.get("product_id"):
            needed_ids.add(int(pid))
        if hp := it.get("half_with_product_id"):
            needed_ids.add(int(hp))
    products = await _load_products(db, needed_ids)
    cfg = await _bot_config(db)
    flat_with, flat_without = _flat_prices(cfg)

    lines: list[dict] = []
    for raw in structured_items:
        try:
            product_id = int(raw["product_id"])
        except (KeyError, TypeError, ValueError):
            raise WebCartError("Item sem produto definido.")
        product = products.get(product_id)
        if product is None or not product.is_active:
            raise WebCartError("Um item do seu pedido não está mais disponível.")

        size = (raw.get("size") or "").strip()
        crust = (raw.get("crust") or "").strip() or None
        extras = list(raw.get("extras") or [])
        sem_massa = bool(raw.get("sem_massa") or False)
        quantity = max(1, int(raw.get("quantity") or 1))
        half_id = raw.get("half_with_product_id")
        observation = (raw.get("observation") or "").strip() or None

        if product.is_pizza:
            if not size:
                raise WebCartError(f"Selecione um tamanho para {product.name}.")
            flavors = [product]
            if half_id:
                second = products.get(int(half_id))
                if second is None or not second.is_active or not second.is_pizza:
                    raise WebCartError("Sabor da segunda metade indisponível.")
                flavors.append(second)
            try:
                validate_combination(flavors, size, crust, extras)
            except ValueError as e:
                raise WebCartError(str(e))

            if sem_massa:
                if flat_without is None:
                    raise WebCartError("Pizza sem massa não está habilitada.")
                price = flat_without
                crust = None
            elif flat_with is not None:
                price = flat_with
            elif len(flavors) == 1:
                price = next(
                    (float(s["price"]) for s in (flavors[0].sizes or []) if s["size"].lower() == size.lower()),
                    None,
                )
                if price is None:
                    raise WebCartError(f"Tamanho '{size}' indisponível para {product.name}.")
            else:  # half/half
                mode = (cfg.half_pizza_pricing if cfg else "max") or "max"
                try:
                    price = calculate_half_pizza_price(flavors[0], flavors[1], size, mode=mode)
                except ValueError as e:
                    raise WebCartError(str(e))

            price = round(
                price
                + crust_price(flavors[0], crust, size)
                + extras_price_total(flavors[0], extras, size),
                2,
            )
            description = build_pizza_description(flavors, size, crust, extras)
            if sem_massa:
                description += " (SEM MASSA)"
        else:
            # Non-pizza: pick the size the user chose, or first available.
            chosen_size = size
            sizes = product.sizes or []
            if not sizes:
                raise WebCartError(f"{product.name} sem preço cadastrado.")
            entry = None
            if chosen_size:
                entry = next(
                    (s for s in sizes if s.get("size", "").lower() == chosen_size.lower()),
                    None,
                )
            if entry is None:
                entry = sizes[0]
                chosen_size = entry["size"]
            try:
                price = float(entry["price"])
            except (TypeError, ValueError):
                raise WebCartError(f"{product.name}: preço inválido.")
            description = product.name + (f" ({chosen_size})" if chosen_size.lower() != "único" else "")

        lines.append({
            "product_id": product.id,
            "description": description,
            "unit_price": price,
            "quantity": quantity,
            "unit": "UN",
            "is_delivery_fee": False,
            "observation": observation,
            "_web_meta": {
                "product_id": product.id,
                "product_name": product.name,
                "size": size,
                "crust": crust,
                "extras": extras,
                "sem_massa": sem_massa,
                "half_with_product_id": int(half_id) if half_id else None,
                "is_pizza": product.is_pizza,
                "image_url": (product.image_urls or [None])[0] or product.image_url,
            },
        })
    return lines


def totals(lines: list[dict], delivery_fee: float = 0.0) -> dict:
    subtotal = sum(float(l["unit_price"]) * int(l.get("quantity", 1)) for l in lines)
    return {
        "subtotal": round(subtotal, 2),
        "delivery_fee": round(float(delivery_fee or 0), 2),
        "total": round(subtotal + float(delivery_fee or 0), 2),
    }

"""
Menu service — pricing + pizza description logic used by both the admin API
and the bot AI engine.
"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


def _size_price(product: Product, size: str) -> Optional[float]:
    for entry in product.sizes or []:
        if entry.get("size", "").lower() == size.lower():
            return float(entry["price"])
    return None


def calculate_half_pizza_price(
    p1: Product, p2: Product, size: str, mode: str = "max"
) -> float:
    """
    Price a meio-a-meio pizza.

    mode:
      - 'max' (default, BR standard) — more expensive half sets the price
      - 'average' — arithmetic mean of the two halves (rounded to cents)
      - 'first' — price of the first flavor only (some old pizzarias do this)

    The mode is read from BotConfig at order time, so this can change without
    a code redeploy once the client confirms which rule applies.
    """
    a = _size_price(p1, size)
    b = _size_price(p2, size)
    if a is None or b is None:
        raise ValueError(f"Size '{size}' not available for both flavors")

    if mode == "average":
        return round((a + b) / 2, 2)
    if mode == "first":
        return a
    return max(a, b)


def build_pizza_description(
    flavors: List[Product],
    size: str,
    crust: Optional[str] = None,
    extras: Optional[List[str]] = None,
) -> str:
    """
    Consolidated description for Datacaixa — e.g.
    "Pizza Grande 1/2 Calabresa + 1/2 Portuguesa Borda Catupiry Extra Queijo"
    """
    if not flavors:
        raise ValueError("flavors must not be empty")
    size_label = size.capitalize()
    if len(flavors) == 1:
        parts = [f"Pizza {size_label} {flavors[0].name}"]
    elif len(flavors) == 2:
        parts = [f"Pizza {size_label} 1/2 {flavors[0].name} + 1/2 {flavors[1].name}"]
    else:
        n = len(flavors)
        labels = [f"1/{n} {f.name}" for f in flavors]
        parts = [f"Pizza {size_label} " + " + ".join(labels)]
    if crust and crust.lower() != "sem borda":
        parts.append(f"Borda {crust}")
    if extras:
        parts.extend(extras)
    return " ".join(parts)


async def get_menu_for_bot(db: AsyncSession) -> str:
    """Render the active menu as a compact text block for the GPT system prompt."""
    from app.models.category import Category

    cats_result = await db.execute(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.display_order, Category.id)
    )
    categories = cats_result.scalars().all()

    prods_result = await db.execute(select(Product).where(Product.is_active.is_(True)))
    products = prods_result.scalars().all()

    by_cat: dict[int, list[Product]] = {}
    for p in products:
        by_cat.setdefault(p.category_id, []).append(p)

    lines: list[str] = []
    for cat in categories:
        items = by_cat.get(cat.id, [])
        if not items:
            continue
        lines.append(f"\n## {cat.name}")
        for p in items:
            sizes = ", ".join(
                f"{s['size']} R$ {float(s['price']):.2f}".replace(".", ",")
                for s in (p.sizes or [])
            )
            lines.append(f"- {p.name}{' — ' + sizes if sizes else ''}")
            if p.description:
                lines.append(f"    ({p.description})")
            if p.is_pizza and p.allows_half:
                lines.append("    [permite meia-a-meia]")
    return "\n".join(lines).strip()


def validate_combination(
    flavors: List[Product],
    size: str,
    crust: Optional[str],
    extras: Optional[List[str]],
) -> None:
    """Raises ValueError if the combination is invalid."""
    if not flavors:
        raise ValueError("Pelo menos um sabor é obrigatório")
    base = flavors[0]
    if len(flavors) > 1 and not base.allows_half:
        raise ValueError(f"{base.name} não permite meia-a-meia")
    for p in flavors:
        if _size_price(p, size) is None:
            raise ValueError(f"Tamanho '{size}' indisponível para {p.name}")
    if crust and crust.lower() != "sem borda" and crust not in (base.available_crusts or []):
        raise ValueError(f"Borda '{crust}' indisponível para {base.name}")
    if extras:
        allowed = set(base.available_extras or [])
        for e in extras:
            if e not in allowed:
                raise ValueError(f"Adicional '{e}' indisponível")

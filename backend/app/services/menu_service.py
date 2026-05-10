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


def _size_allows_half(product: Product, size: str) -> bool:
    """
    Per-size meia-a-meia rule with fallback to the product-level flag.

    Some operators only let "grande" do half-and-half; brotinho/pequena/média must
    be 1-flavor. Each size dict can carry its own allows_half; rows that
    predate the 0008 migration fall back to Product.allows_half.
    """
    for entry in product.sizes or []:
        if entry.get("size", "").lower() == size.lower():
            v = entry.get("allows_half")
            if v is None:
                return bool(product.allows_half)
            return bool(v)
    return bool(product.allows_half)


def _option_name(entry) -> str:
    """available_extras / available_crusts may hold legacy plain strings."""
    if isinstance(entry, dict):
        return str(entry.get("name", ""))
    return str(entry)


def _option_price_for_size(entry, size: str) -> float:
    """
    Resolve a single option's price for the chosen size. Handles three
    historical shapes transparently:
      - {name, prices: {size: price}}  (post-0010 — the real one)
      - {name, price: float}           (0007..0009 flat shape)
      - "Catupiry"                     (pre-0007 plain strings)
    Missing size in the prices map → 0 (free).
    """
    if not isinstance(entry, dict):
        return 0.0
    prices = entry.get("prices")
    if isinstance(prices, dict):
        v = prices.get(size) if size else None
        if v is None and size:
            # case-insensitive fallback
            for k, vv in prices.items():
                if str(k).lower() == size.lower():
                    v = vv
                    break
        try:
            return float(v or 0)
        except (TypeError, ValueError):
            return 0.0
    # legacy flat
    try:
        return float(entry.get("price") or 0)
    except (TypeError, ValueError):
        return 0.0


def extras_price_total(
    product: Product, chosen: Optional[List[str]], size: str
) -> float:
    """Sum the price of each chosen extra at the given size."""
    if not chosen:
        return 0.0
    catalog = {_option_name(e).lower(): e for e in (product.available_extras or [])}
    total = 0.0
    for name in chosen:
        entry = catalog.get(name.lower())
        if entry is None:
            continue
        total += _option_price_for_size(entry, size)
    return round(total, 2)


def crust_price(product: Product, chosen: Optional[str], size: str) -> float:
    """Look up the crust's price for the given size."""
    if not chosen:
        return 0.0
    if chosen.strip().lower() == "sem borda":
        return 0.0
    for c in (product.available_crusts or []):
        if _option_name(c).lower() == chosen.lower():
            return round(_option_price_for_size(c, size), 2)
    return 0.0


def _option_render_for_bot(entry, sizes: List[str]) -> str:
    """Render '<name>' or '<name> (<size> R$ X, ...)' depending on prices."""
    name = _option_name(entry).strip()
    if not name:
        return ""
    prices = entry.get("prices") if isinstance(entry, dict) else None
    if not prices:
        # legacy / no per-size prices set → free
        return name
    # Trim to the sizes the product actually has, in declared order
    parts = []
    for s in sizes:
        v = prices.get(s)
        if v is None:
            for k, vv in prices.items():
                if str(k).lower() == s.lower():
                    v = vv
                    break
        if v is None or float(v) == 0:
            continue
        parts.append(
            f"{s} +R$ {float(v):.2f}".replace(".", ",")
        )
    if not parts:
        return name
    return f"{name} ({', '.join(parts)})"


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


def _options_signature(options) -> tuple:
    """Hashable representation of an option list, ignoring iteration order."""
    sig = []
    for o in options or []:
        name = _option_name(o).strip().lower()
        if not name:
            continue
        prices = o.get("prices") if isinstance(o, dict) else None
        if isinstance(prices, dict):
            price_sig = tuple(sorted((str(k).lower(), float(v or 0)) for k, v in prices.items()))
        else:
            price_sig = ()
        sig.append((name, price_sig))
    sig.sort()
    return tuple(sig)


def _render_option_block(options, size_names: List[str]) -> str:
    """One-line render of [{name,prices}] used by both the shared block and
    per-pizza overrides."""
    parts = [_option_render_for_bot(o, size_names) for o in options or []]
    parts = [x for x in parts if x]
    return ", ".join(parts)


async def get_pizza_size_names(db: AsyncSession) -> List[str]:
    """Distinct size labels across the active pizzas, in the order they appear
    on the most-recently-edited product. Used by the bot prompt so the
    'Tamanho (...)' example reflects what the operator actually configured —
    e.g. just "Brotinho / Grande" for a two-size pizzaria, not the generic
    "P / M / G / GG" that confuses customers.
    """
    res = await db.execute(
        select(Product)
        .where(Product.is_active.is_(True))
        .where(Product.is_pizza.is_(True))
    )
    products = res.scalars().all()
    seen: list[str] = []
    seen_lower: set[str] = set()
    for p in products:
        for s in (p.sizes or []):
            name = (s.get("size") if isinstance(s, dict) else None) or ""
            name = name.strip()
            if not name or name.lower() in seen_lower:
                continue
            seen.append(name)
            seen_lower.add(name.lower())
    return seen


async def get_menu_for_bot(db: AsyncSession) -> str:
    """Render the active menu as a compact text block for the GPT system prompt.

    Bordas and adicionais lists are normally identical across every pizza on a
    pizzaria's menu, so emitting them per-product (which is what we used to do)
    blew the per-request token budget — for 95 active pizzas with 41 extras
    each, the menu alone reached ~56k tokens. This rewrite finds the most
    common signature for crusts + extras across all pizzas, prints it ONCE in
    a shared block, and only emits per-pizza lists when a product deviates
    from the default. Same information, ~5x smaller in the typical case.
    """
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

    # Identify the dominant crust/extra signature among pizzas. If a clear
    # majority shares one, we emit it once at the top and skip per-pizza
    # repetition. Non-pizza products are excluded from the analysis since
    # they typically don't carry crusts/extras at all.
    pizzas = [p for p in products if p.is_pizza]
    crust_default_sig = ()
    extra_default_sig = ()
    crust_default_render = ""
    extra_default_render = ""
    crust_default_size_names: List[str] = []
    extra_default_size_names: List[str] = []
    if pizzas:
        from collections import Counter

        crust_sigs = Counter(_options_signature(p.available_crusts) for p in pizzas)
        extra_sigs = Counter(_options_signature(p.available_extras) for p in pizzas)
        if crust_sigs:
            crust_default_sig, crust_count = crust_sigs.most_common(1)[0]
            # Only treat as default if it covers a majority — avoids hiding
            # information when sets vary widely.
            if crust_count >= max(2, len(pizzas) // 2):
                # Pick a real product matching this sig to render from (so the
                # original price-map shape and order are preserved).
                ref = next(p for p in pizzas if _options_signature(p.available_crusts) == crust_default_sig)
                crust_default_size_names = [
                    s["size"] for s in (ref.sizes or []) if isinstance(s, dict) and s.get("size")
                ]
                crust_default_render = _render_option_block(ref.available_crusts, crust_default_size_names)
            else:
                crust_default_sig = ()
        if extra_sigs:
            extra_default_sig, extra_count = extra_sigs.most_common(1)[0]
            if extra_count >= max(2, len(pizzas) // 2):
                ref = next(p for p in pizzas if _options_signature(p.available_extras) == extra_default_sig)
                extra_default_size_names = [
                    s["size"] for s in (ref.sizes or []) if isinstance(s, dict) and s.get("size")
                ]
                extra_default_render = _render_option_block(ref.available_extras, extra_default_size_names)
            else:
                extra_default_sig = ()

    lines: list[str] = []

    # Shared bordas/adicionais block — emitted once, applies to every pizza
    # unless the per-product line says otherwise.
    if crust_default_render or extra_default_render:
        lines.append("## Bordas e adicionais (padrão de TODAS as pizzas, salvo indicação contrária)")
        if crust_default_render:
            lines.append(f"BORDAS: {crust_default_render}")
        if extra_default_render:
            lines.append(f"ADICIONAIS: {extra_default_render}")
        lines.append("")

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
            if p.is_pizza:
                half_sizes = [
                    s["size"]
                    for s in (p.sizes or [])
                    if _size_allows_half(p, s.get("size", ""))
                ]
                if half_sizes:
                    lines.append(
                        f"    [meia-a-meia: {', '.join(half_sizes)}]"
                    )
            size_names = [
                s["size"] for s in (p.sizes or []) if isinstance(s, dict) and s.get("size")
            ]
            # Bordas: render inline only if this pizza's set differs from the
            # shared default. Same logic for adicionais.
            if p.available_crusts:
                p_crust_sig = _options_signature(p.available_crusts)
                if p_crust_sig != crust_default_sig:
                    rendered = _render_option_block(p.available_crusts, size_names)
                    if rendered:
                        lines.append("    [bordas próprias: " + rendered + "]")
            if p.available_extras:
                p_extra_sig = _options_signature(p.available_extras)
                if p_extra_sig != extra_default_sig:
                    rendered = _render_option_block(p.available_extras, size_names)
                    if rendered:
                        lines.append("    [adicionais próprios: " + rendered + "]")
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
    if len(flavors) > 1:
        # Per-size rule: brotinho may be 1-flavor only even when the pizza
        # supports half on grande. Reject early with a size-specific message.
        if not _size_allows_half(base, size):
            raise ValueError(
                f"Tamanho '{size}' não permite meia-a-meia em {base.name}"
            )
    for p in flavors:
        if _size_price(p, size) is None:
            raise ValueError(f"Tamanho '{size}' indisponível para {p.name}")
    if crust and crust.lower() != "sem borda":
        allowed_crusts = {_option_name(c).lower() for c in (base.available_crusts or [])}
        if crust.lower() not in allowed_crusts:
            raise ValueError(f"Borda '{crust}' indisponível para {base.name}")
    if extras:
        allowed = {_option_name(e).lower() for e in (base.available_extras or [])}
        for e in extras:
            if e.lower() not in allowed:
                raise ValueError(f"Adicional '{e}' indisponível")

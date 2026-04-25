"""
Datacaixa .txt generator — formats a pipe-delimited UTF-8 file per Datacaixa's
spec (confirmed with Gabriel, Datacaixa support).

Layout:
  PEDIDO|customer_name|cpf|seller|observation|
  ITEM|code|desc|price|qty|UN|NCM|total|CEST|CFOP|IBPT|CSOSN|origem|code|
  ITEM|...
  PGTO|payment_code|total|

- Decimal separator: comma (49,90)
- Encoding: UTF-8
- Pipe: |
- Delivery fee: its own ITEM line
- Observation field holds: address, phone, neighborhood, any mods

Counter is atomic via Redis INCR so concurrent orders don't collide.
"""
from typing import Iterable

import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.bot_config import BotConfig
from app.models.order import Order, PAYMENT_CODE_MAP
from app.models.product import Product


FILE_COUNTER_KEY = "datacaixa:file_counter"


def _brl(value: float) -> str:
    return f"{float(value):.2f}".replace(".", ",")


def _clean(s: str | None) -> str:
    """Remove pipes and newlines that would break the format."""
    if s is None:
        return ""
    return str(s).replace("|", "/").replace("\r", " ").replace("\n", " ").strip()


async def _next_file_number(redis_client: redis.Redis) -> int:
    return int(await redis_client.incr(FILE_COUNTER_KEY))


async def next_filename() -> str:
    client = redis.from_url(settings.redis_url, decode_responses=True)
    n = await _next_file_number(client)
    return f"ped_{n:08d}.txt"


async def _load_product_tax(db: AsyncSession, product_ids: Iterable[int]) -> dict[int, Product]:
    ids = [i for i in product_ids if i]
    if not ids:
        return {}
    res = await db.execute(select(Product).where(Product.id.in_(ids)))
    return {p.id: p for p in res.scalars().all()}


async def generate_order_file(db: AsyncSession, order_id: int) -> str:
    """
    Build the .txt content for an order. Does NOT increment the filename counter —
    the bridge picks up the order and the filename is decided server-side via
    `next_filename` at transmission time.
    """
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one()

    customer_name = _clean(order.customer.name) if order.customer else ""
    cpf = _clean(order.customer.cpf) if order.customer and order.customer.cpf else ""

    obs_bits = []
    if order.delivery_address:
        obs_bits.append(order.delivery_address)
    if order.delivery_neighborhood:
        obs_bits.append(order.delivery_neighborhood)
    obs_bits.append(order.customer_phone)
    if order.observation:
        obs_bits.append(order.observation)
    observation = _clean(" | ".join(obs_bits))

    lines: list[str] = []
    lines.append(f"PEDIDO|{customer_name}|{cpf}||{observation}|")

    products = await _load_product_tax(db, [i.product_id for i in order.items if i.product_id])

    # BotConfig holds tenant-wide tax fallback values (default_ncm, default_cfop, ...)
    # used when a product's own fields are blank. This protects against running with
    # half-seeded products until the contadora certifies real codes per item.
    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()

    def fb(prod_val: str | None, cfg_val: str | None, hardcoded: str) -> str:
        """Pick first non-empty: product-level → BotConfig default → hardcoded fallback."""
        for v in (prod_val, cfg_val, hardcoded):
            cleaned = _clean(v)
            if cleaned:
                return cleaned
        return ""

    # Sort: real items first (by id), delivery fee last — canonical Datacaixa order
    sorted_items = sorted(
        order.items,
        key=lambda i: (1 if i.is_delivery_fee else 0, i.id),
    )

    for item in sorted_items:
        desc = _clean(item.description)
        unit_price = _brl(item.unit_price)
        qty = item.quantity
        unit = item.unit or "UN"
        total = _brl(float(item.unit_price) * qty)

        if item.is_delivery_fee:
            # Delivery fee uses a neutral profile — Datacaixa accepts service CFOP 5949.
            code = "TAXA"
            ncm = "00000000"
            cest = ""
            cfop = "5949"
            ibpt = ""
            csosn = fb(None, cfg.default_csosn if cfg else None, "102")
            origin = fb(None, cfg.default_origin_code if cfg else None, "0")
            ibpt_code = ""
        else:
            p = products.get(item.product_id) if item.product_id else None
            code = _clean(p.datacaixa_code) if p and p.datacaixa_code else (str(item.product_id or ""))
            # 3-tier fallback: product field → BotConfig default → hardcoded last-resort.
            ncm = fb(p.ncm if p else None, cfg.default_ncm if cfg else None, "")
            cest = fb(p.cest if p else None, cfg.default_cest if cfg else None, "")
            cfop = fb(p.cfop if p else None, cfg.default_cfop if cfg else None, "5102")
            ibpt = ""
            csosn = fb(p.csosn if p else None, cfg.default_csosn if cfg else None, "102")
            origin = fb(p.origin_code if p else None, cfg.default_origin_code if cfg else None, "0")
            ibpt_code = fb(p.ibpt_code if p else None, cfg.default_ibpt_code if cfg else None, "")

        lines.append(
            f"ITEM|{code}|{desc}|{unit_price}|{qty}|{unit}|{ncm}|{total}|"
            f"{cest}|{cfop}|{ibpt}|{csosn}|{origin}|{ibpt_code}|"
        )

    # Payment
    payment_code = PAYMENT_CODE_MAP.get(order.payment_method, "99")
    lines.append(f"PGTO|{payment_code}|{_brl(order.total)}|")

    # Datacaixa expects trailing newline
    return "\n".join(lines) + "\n"

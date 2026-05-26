"""
Datacaixa .txt generator — Modelo Unificado layout.

Spec + example (canonical, fetched live):
  https://www.datacaixa.com.br/wp-content/uploads/2022/07/layout_pedido_unificado.txt
  https://www.datacaixa.com.br/wp-content/uploads/2022/07/exemplo_pedido_unificado.txt

This installation uses Modelo Unificado (identified by BANCO.FDB on the
Datacaixa status bar; DATACAIXA.FDB would mean Modelo Normal). The two
layouts are NOT interchangeable — the Unified line has 24 ITEM fields
vs Normal's 14, plus a much richer PEDIDO header with structured address.

Layout:
  PEDIDO|NOME|TIPO_DOC|CNPJ_CPF|TELEFONE|CEP|ENDERECO|NUMERO|COMPLEMENTO|BAIRRO|CIDADE|ESTADO|VENDEDOR|ENTREGADOR|TIPO_PEDIDO|OBSERVACAO|NUMERO_MESA|NUMERO_COMANDA|DATA_HORA|DATA_HORA_ENTREGA|ORIGEM|
  ITEM|COD_ITEM_PDV|COD_BARRAS|DESCRICAO|PRECO_CUSTO|PRECO_VENDA|QUANT|UNID|NCM|CEST|CFOP|ORIGEM_MERC|CST_CSOSN|CST_ICMS|ICMS|REDUCAO_ICMS|CST_PIS|PIS|CST_COFINS|COFINS|IMP_FEDERAL|IMP_ESTADUAL|IMP_MUNICIPAL|FONTE|GRUPO|
  PGTO|COD_FORMAPGTO_PDV|VALOR|VALOR_TROCO|PGTO_ONLINE|OBSERVACAO|

- Decimal separator: comma (49,90)
- Encoding: UTF-8 (LF line endings)
- Pipe: |
- Delivery fee: its own ITEM line with COD_ITEM_PDV=TAXA, CFOP=5949
- ICMS/PIS/COFINS detail fields left empty — Datacaixa fills them
  from the product registry on its side when needed; the operator's
  contadora can calibrate per-product later
- IMP_FEDERAL/ESTADUAL/MUNICIPAL default to 0 (Lei da Transparência
  informational percentages; not required for NFC-e issuance)
- FONTE is the literal "IBPT"
- ORIGEM is the literal "INTEGRACAO" (matches Datacaixa's own sample)
- VENDEDOR set to "BOT" so daily reports can attribute volume to the
  bot vs walk-in
- TIPO_PEDIDO: "PEDIDO" for everything (Delivery / Retirada is encoded
  by whether ENDERECO is filled)

Update history:
- 2026-05-22 (morning): tried Modelo Normal layout after support
  confirmed the file format. Still failed because this PDV is BANCO.FDB
  = Modelo Unificado, not Normal.
- 2026-05-22 (now): switched to Modelo Unificado after fetching the
  canonical spec + example from datacaixa.com.br/wp-content/uploads/2022/07/.

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


_PIZZARIA_CITY = "São José do Rio Preto"
_PIZZARIA_UF = "SP"


def _split_street_number(addr: str | None) -> tuple[str, str]:
    """Parse 'Rua Atilio Lobanco, 277' → ('Rua Atilio Lobanco', '277').

    Datacaixa's Unified layout expects ENDERECO and NUMERO as separate
    fields. Our cart stores them as a single free-text string. Best-effort
    split on the last ', ' followed by a number; falls back to the whole
    string as ENDERECO with empty NUMERO when the split can't be made
    cleanly (which Datacaixa accepts — empty number is valid for
    apartments/condomínios without a number).
    """
    if not addr:
        return "", ""
    import re
    s = addr.strip()
    m = re.match(r"^(.+?),\s*(\d+\w?)(?:\s*[-,].*)?$", s)
    if m:
        return _clean(m.group(1)), _clean(m.group(2))
    # Sometimes the address is just "Rua X 277" (no comma) — try that too
    m = re.match(r"^(.+?)\s+(\d+\w?)$", s)
    if m:
        return _clean(m.group(1)), _clean(m.group(2))
    return _clean(s), ""


def _fmt_phone_br(raw: str | None) -> str:
    """Format E.164-ish digits as Brazilian (DD)9XXXX-XXXX.

    Datacaixa's example shows '(11)98080-1010'. Our DB stores
    '5517991289777' — strip leading country code, format the rest.
    """
    if not raw:
        return ""
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    if digits.startswith("55") and len(digits) > 11:
        digits = digits[2:]
    if len(digits) == 11:
        return f"({digits[:2]}){digits[2:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"({digits[:2]}){digits[2:6]}-{digits[6:]}"
    return digits  # unrecognized shape — pass through digits-only


def _fmt_dt_br(dt) -> str:
    """Datacaixa expects DD/MM/YYYY HH:MM in Brazilian local time."""
    if dt is None:
        return ""
    try:
        from zoneinfo import ZoneInfo
        local = dt.astimezone(ZoneInfo("America/Sao_Paulo"))
    except Exception:
        local = dt
    return local.strftime("%d/%m/%Y %H:%M")


async def generate_order_file(db: AsyncSession, order_id: int) -> str:
    """
    Build the .txt content for an order in Datacaixa's Modelo Unificado.
    Does NOT increment the filename counter — the bridge picks up the order
    and the filename is decided server-side via `next_filename` at
    transmission time.
    """
    order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one()

    customer_name = _clean(order.customer.name) if order.customer else ""
    cpf_raw = order.customer.cpf if order.customer else None
    cpf = _clean(cpf_raw or "")
    tipo_doc = "CPF" if cpf else ""

    phone_fmt = _fmt_phone_br(order.customer_phone)

    endereco, numero = _split_street_number(order.delivery_address)
    bairro = _clean(order.delivery_neighborhood) or ""
    complemento = ""  # not separately tracked; complement leaks into observation
    cep = ""  # not stored; Datacaixa accepts empty
    observacao = _clean(order.observation) if order.observation else ""

    tipo_pedido = "PEDIDO"  # Datacaixa accepts; encodes delivery vs retirada by ENDERECO presence
    data_hora = _fmt_dt_br(order.created_at)
    data_hora_entrega = _fmt_dt_br(order.scheduled_for) if order.scheduled_for else ""

    lines: list[str] = []
    # VENDEDOR = "BOT" so daily reports attribute volume cleanly. ORIGEM = "INTEGRACAO"
    # matches Datacaixa's own example for third-party-system inputs.
    lines.append(
        f"PEDIDO|{customer_name}|{tipo_doc}|{cpf}|{phone_fmt}|{cep}|"
        f"{endereco}|{numero}|{complemento}|{bairro}|"
        f"{_PIZZARIA_CITY}|{_PIZZARIA_UF}|BOT||{tipo_pedido}|{observacao}|"
        f"||{data_hora}|{data_hora_entrega}|INTEGRACAO|"
    )

    products = await _load_product_tax(db, [i.product_id for i in order.items if i.product_id])

    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()

    def fb(prod_val: str | None, cfg_val: str | None, hardcoded: str) -> str:
        for v in (prod_val, cfg_val, hardcoded):
            cleaned = _clean(v)
            if cleaned:
                return cleaned
        return ""

    sorted_items = sorted(
        order.items,
        key=lambda i: (1 if i.is_delivery_fee else 0, i.id),
    )

    for item in sorted_items:
        desc = _clean(item.description)
        preco_venda = _brl(item.unit_price)
        quant = item.quantity
        unid = item.unit or "UN"
        preco_custo = ""  # not tracked; Datacaixa accepts empty

        if item.is_delivery_fee:
            cod_item = "TAXA"
            cod_barras = ""
            ncm = "00000000"
            cest = ""
            cfop = "5949"
            origem_merc = fb(None, cfg.default_origin_code if cfg else None, "0")
            csosn = fb(None, cfg.default_csosn if cfg else None, "102")
            grupo = "Taxa de Entrega"
        else:
            p = products.get(item.product_id) if item.product_id else None
            cod_item = _clean(p.datacaixa_code) if p and p.datacaixa_code else (str(item.product_id or ""))
            cod_barras = ""
            ncm = fb(p.ncm if p else None, cfg.default_ncm if cfg else None, "")
            cest = fb(p.cest if p else None, cfg.default_cest if cfg else None, "")
            cfop = fb(p.cfop if p else None, cfg.default_cfop if cfg else None, "5102")
            origem_merc = fb(p.origin_code if p else None, cfg.default_origin_code if cfg else None, "0")
            csosn = fb(p.csosn if p else None, cfg.default_csosn if cfg else None, "102")
            grupo = ""

        # ICMS / PIS / COFINS detail fields stay empty — Datacaixa fills them
        # from its own product registry on import. IMP_FEDERAL/ESTADUAL/MUNICIPAL
        # default to 0 (Lei da Transparência informational).
        cst_icms = ""
        icms = ""
        reducao_icms = ""
        cst_pis = ""
        pis = ""
        cst_cofins = ""
        cofins = ""
        imp_federal = "0"
        imp_estadual = "0"
        imp_municipal = "0"
        fonte = "IBPT"

        lines.append(
            f"ITEM|{cod_item}|{cod_barras}|{desc}|{preco_custo}|{preco_venda}|"
            f"{quant}|{unid}|{ncm}|{cest}|{cfop}|{origem_merc}|{csosn}|"
            f"{cst_icms}|{icms}|{reducao_icms}|{cst_pis}|{pis}|{cst_cofins}|{cofins}|"
            f"{imp_federal}|{imp_estadual}|{imp_municipal}|{fonte}|{grupo}|"
        )

    # Payment — single line. We don't persist change_for as a separate
    # column on Order; the bot stuffs "Troco para R$ X,XX" into the order
    # observation, which is already carried over in the PEDIDO header's
    # OBSERVACAO field. So VALOR_TROCO here stays "0,00" and the motoboy
    # reads the troco hint from the printed ticket's observation line.
    # PGTO_ONLINE = S only when the payment is already settled (PIX); cash
    # and cartão-na-entrega are N.
    payment_code = PAYMENT_CODE_MAP.get(order.payment_method, "99")
    pgto_online = "S" if str(getattr(order.payment_method, "value", order.payment_method)).lower() == "pix" else "N"
    lines.append(
        f"PGTO|{payment_code}|{_brl(order.total)}|0,00|{pgto_online}||"
    )

    return "\n".join(lines) + "\n"

"""
AI conversation engine — GPT-4o with function calling.

The engine gets a turn from WhatsApp, renders the full context, calls OpenAI,
executes any tool calls (add_to_cart, set_delivery_address, etc.), and returns
a plain-text reply to send back.
"""
import base64
import json
import logging
from datetime import timezone
from pathlib import Path
from typing import Any, Optional

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.bot_config import BotConfig
from app.models.conversation_message import ConversationMessage, MessageRole
from app.models.product import Product
from app.services import conversation_state as state_svc
from app.services import customer_service
from app.services import delivery as delivery_svc
from app.services import handoff as handoff_svc
from app.services import order_builder
from app.services.menu_service import get_menu_for_bot

log = logging.getLogger(__name__)

_client: Optional[AsyncOpenAI] = None


def _openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


# ---- Tool schema for GPT function calling ----

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "add_pizza_to_cart",
            "description": "Adiciona uma pizza ao carrinho (inteira ou meia-a-meia).",
            "parameters": {
                "type": "object",
                "required": ["flavor_ids", "size"],
                "properties": {
                    "flavor_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "IDs de sabores (1 para pizza inteira, 2 para meia-a-meia)",
                    },
                    "size": {"type": "string", "description": "pequena | média | grande | gigante"},
                    "crust": {"type": "string", "description": "Borda (opcional)"},
                    "extras": {"type": "array", "items": {"type": "string"}, "description": "Adicionais"},
                    "quantity": {"type": "integer", "default": 1},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_simple_product_to_cart",
            "description": "Adiciona uma bebida, acompanhamento ou outro item ao carrinho.",
            "parameters": {
                "type": "object",
                "required": ["product_id"],
                "properties": {
                    "product_id": {"type": "integer"},
                    "quantity": {"type": "integer", "default": 1},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_from_cart",
            "description": "Remove um item do carrinho pelo índice (1-based como mostrado ao cliente).",
            "parameters": {
                "type": "object",
                "required": ["index"],
                "properties": {"index": {"type": "integer"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_delivery_address",
            "description": "Registra endereço de entrega. Deve extrair bairro para cálculo de taxa.",
            "parameters": {
                "type": "object",
                "required": ["street", "number", "neighborhood"],
                "properties": {
                    "street": {"type": "string"},
                    "number": {"type": "string"},
                    "neighborhood": {"type": "string"},
                    "complement": {"type": "string"},
                    "reference": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_pickup",
            "description": "Cliente vai retirar no balcão — sem entrega.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_payment_method",
            "description": "Define forma de pagamento.",
            "parameters": {
                "type": "object",
                "required": ["method"],
                "properties": {
                    "method": {
                        "type": "string",
                        "enum": ["pix", "credit", "debit", "cash", "pickup"],
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "confirm_order",
            "description": "Cliente confirmou o pedido — finaliza e emite número.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "repeat_last_order",
            "description": "Repete o último pedido entregue do cliente.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_human_handoff",
            "description": "Transfere a conversa para um atendente humano.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_customer_name",
            "description": "Registra o nome do cliente quando ele se apresentar.",
            "parameters": {
                "type": "object",
                "required": ["name"],
                "properties": {"name": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ask_clarification",
            "description": (
                "Use quando a mensagem do cliente for ambígua e você precisar de mais "
                "informação antes de agir (ex: sabor não claro, tamanho não dito). "
                "Registra a pergunta para futura análise."
            ),
            "parameters": {
                "type": "object",
                "required": ["topic", "question"],
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Tema da dúvida — ex: flavor, size, address, payment",
                    },
                    "question": {
                        "type": "string",
                        "description": "Pergunta exata que será feita ao cliente",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_change_for",
            "description": (
                "Registra o valor de troco que o cliente vai precisar quando ele paga em "
                "dinheiro. amount=0 significa que paga exato (sem troco). Chame ASSIM QUE "
                "o cliente responder à pergunta sobre troco — antes de confirmar o pedido."
            ),
            "parameters": {
                "type": "object",
                "required": ["amount"],
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "Valor da nota com que o cliente vai pagar (R$). 0 = paga exato.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_menu_image",
            "description": (
                "Envia a imagem do cardápio pro cliente pelo WhatsApp. Use quando ele pedir "
                "pra ver o cardápio, opções, sabores, ou perguntar 'tem foto?'. Categorias: "
                "'salgada' (pizzas salgadas), 'doce' (pizzas doces), 'sorvete' (sorvetes). "
                "Se a imagem não estiver cadastrada, devolve um aviso pra você seguir em texto."
            ),
            "parameters": {
                "type": "object",
                "required": ["category"],
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["salgada", "doce", "sorvete", "bebida"],
                        "description": "Categoria do cardápio a enviar",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_location_pin",
            "description": (
                "Marca a conversa como aguardando o pin de localização do WhatsApp. "
                "Chame quando o endereço dado pelo cliente for claramente zona rural (sítio, "
                "fazenda, estrada, rodovia, km). Depois de chamar, peça pro cliente mandar "
                "a localização atual pelo WhatsApp (📎 → Localização → Localização atual)."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


async def _get_bot_config(db: AsyncSession) -> BotConfig:
    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    if cfg is None:
        cfg = BotConfig(id=1)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


# --- Daily OpenAI token budget guardrail ---
# Counter lives in Redis, key resets daily. Cheap and async-safe.

def _budget_key() -> str:
    from datetime import datetime, timezone
    return f"openai:tokens:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"


async def _daily_tokens_exceeded(budget: int) -> bool:
    if budget <= 0:
        return False
    import redis.asyncio as redis
    client = redis.from_url(settings.redis_url, decode_responses=True)
    used = int(await client.get(_budget_key()) or 0)
    return used >= budget


async def _add_token_usage(tokens: int) -> None:
    if tokens <= 0:
        return
    import redis.asyncio as redis
    client = redis.from_url(settings.redis_url, decode_responses=True)
    key = _budget_key()
    await client.incrby(key, tokens)
    # Auto-expire after 36h so the counter rolls cleanly even on UTC boundaries
    await client.expire(key, 36 * 3600)


# ---------------------------------------------------------------------------
# Token / abuse barriers
#
# Three layers, all rejecting BEFORE any OpenAI call so they cost nothing:
#   A — input size cap per message
#   B — per-call token budget (estimated; defends the per-minute org limit)
#   C — per-phone hourly message cap (defends the daily budget from spam)
#
# Every barrier returns a friendly Portuguese message to the customer. Nothing
# technical (no "rate limit", "tokens", "API") ever leaks to WhatsApp.
# ---------------------------------------------------------------------------

# Hard caps. Conservative on purpose — operator can loosen later if traffic
# patterns warrant. The TPM cap is well below the org's 30k TPM ceiling so a
# burst of two near-simultaneous messages doesn't both pass and then 429.
MAX_INBOUND_CHARS = 1500       # ~375 tokens; longer = ask user to split
TPM_SAFE_LIMIT_TOKENS = 25_000 # below the 30k TPM org cap, with margin
PER_PHONE_HOURLY_CAP = 30      # > a real order with chit-chat, < spam


def _estimate_messages_tokens(messages: list[dict]) -> int:
    """Conservative token approximation for a chat-completions payload.

    Real tokenization needs tiktoken; we don't add the dependency just for
    a safety check. Char/4 + small per-message overhead is a known-good rule
    of thumb that errs on the side of refusing borderline requests, which is
    exactly what this gate is for.
    """
    total = 0
    for m in messages:
        content = m.get("content") or ""
        if isinstance(content, list):
            # Some payloads use the content-parts shape
            content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
        total += len(str(content)) // 4
        total += 4  # role + structural overhead per message
    return total


async def _phone_rate_exceeded(phone: str, cap: int = PER_PHONE_HOURLY_CAP) -> bool:
    """Sliding 1-hour window of messages from a single phone, in Redis.

    Counts BEFORE recording the current message, so the cap is read as
    "more than {cap} messages already in the last hour" — passing it makes
    the bot hand off to a human instead of continuing to burn GPT calls.
    """
    if cap <= 0:
        return False
    import time
    import secrets as _secrets
    import redis.asyncio as redis

    client = redis.from_url(settings.redis_url, decode_responses=True)
    key = f"rate:msgs:{phone}"
    now = int(time.time())
    window = 3600  # 1h
    cutoff = now - window
    try:
        # Drop entries older than the window
        await client.zremrangebyscore(key, 0, cutoff)
        count = await client.zcard(key)
        if count >= cap:
            return True
        # Record this message and refresh TTL
        # (timestamp + nonce keeps members unique)
        member = f"{now}:{_secrets.token_hex(4)}"
        await client.zadd(key, {member: now})
        await client.expire(key, window * 2)
    except Exception:
        # On Redis failure, fail open — better to risk one extra GPT call than
        # to silently refuse paying customers. The daily budget still caps total.
        log.exception("phone rate limit check failed (failing open)")
        return False
    return False


async def _persist_message(
    db: AsyncSession,
    *,
    phone: str,
    customer_id: int | None,
    role: MessageRole,
    content: str,
    is_audio: bool = False,
    media_url: Optional[str] = None,
    media_type: Optional[str] = None,
) -> None:
    db.add(
        ConversationMessage(
            phone=phone,
            customer_id=customer_id,
            role=role,
            content=content,
            is_audio=is_audio,
            media_url=media_url,
            media_type=media_type,
        )
    )
    await db.commit()


def _local_now():
    """Bot operates in São Paulo time, regardless of server TZ."""
    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime
        return datetime.now(ZoneInfo("America/Sao_Paulo"))
    except Exception:
        from datetime import datetime
        return datetime.utcnow()


def _next_opening_at(cfg, now_local):
    """Return the next datetime the pizzaria will be open, looking up to 7 days
    ahead. Hour granularity matches BotConfig (working_hours_start/end ints)."""
    from datetime import datetime, time, timedelta

    closed_days = set(cfg.closed_weekdays or [])
    h_start = int(cfg.working_hours_start or 0)
    h_end = int(cfg.working_hours_end or 24)
    if h_start >= h_end:
        return None  # malformed config; let caller decide

    # Today before opening?
    if (
        now_local.weekday() not in closed_days
        and now_local.hour < h_start
    ):
        return now_local.replace(hour=h_start, minute=0, second=0, microsecond=0)

    # Walk forward day by day.
    candidate = now_local + timedelta(days=1)
    for _ in range(7):
        if candidate.weekday() not in closed_days:
            return candidate.replace(hour=h_start, minute=0, second=0, microsecond=0)
        candidate += timedelta(days=1)
    return None


def _is_open_now(cfg, now_local) -> bool:
    closed_today = now_local.weekday() in (cfg.closed_weekdays or [])
    h_start = int(cfg.working_hours_start or 0)
    h_end = int(cfg.working_hours_end or 24)
    in_hours = h_start <= now_local.hour < h_end
    return not closed_today and in_hours


# Words that strongly suggest a rural address. We err on the side of false
# positives — asking for a location pin in a borderline case is a tiny ask of
# the customer; failing to ask in a real rural case means a lost delivery.
_RURAL_KEYWORDS = (
    "fazenda", "sítio", "sitio", "chácara", "chacara",
    "estrada", "rodovia", "br-", "br ", "sp-", "sp ",
    "zona rural", "área rural", "area rural", "rural",
    "kilômetro", "kilometro", "quilômetro", "quilometro",
    " km ", "km ", "assentamento", "linha ",
)


def _is_rural_address(addr_text: str) -> bool:
    if not addr_text:
        return False
    low = f" {addr_text.lower()} "
    return any(k in low for k in _RURAL_KEYWORDS)


async def _build_system_prompt(db: AsyncSession, state: dict) -> str:
    cfg = await _get_bot_config(db)
    menu_text = await get_menu_for_bot(db)
    zones_text = await delivery_svc.get_all_zones_formatted(db)

    # Cart snapshot
    cart = state.get("cart", {"items": []})
    items = cart.get("items", [])
    if items:
        cart_lines = []
        for i, it in enumerate(items, 1):
            total = float(it["unit_price"]) * int(it.get("quantity", 1))
            cart_lines.append(f"  {i}. {it['quantity']}× {it['description']} — R$ {total:.2f}".replace(".", ","))
        cart_snapshot = "\n".join(cart_lines)
    else:
        cart_snapshot = "  (vazio)"

    addr = cart.get("delivery_address")
    payment = cart.get("payment_method")

    cpf_rule = (
        "- Pergunte se o cliente quer CPF na nota antes de finalizar."
        if cfg.ask_cpf else ""
    )
    repeat_rule = (
        "- Se o cliente é recorrente, ofereça repetir o último pedido (use repeat_last_order)."
        if cfg.enable_repeat_last_order else ""
    )

    pix_block = ""
    if cfg.pix_key:
        holder = f" — {cfg.pix_holder}" if cfg.pix_holder else ""
        digits_only = "".join(ch for ch in cfg.pix_key if ch.isdigit())
        if "@" in cfg.pix_key:
            key_type = "e-mail"
        elif len(digits_only) == 14 and digits_only == cfg.pix_key:
            key_type = "CNPJ"
        elif len(digits_only) == 11 and digits_only == cfg.pix_key:
            key_type = "CPF"
        elif cfg.pix_key.startswith("+") or (digits_only.startswith("55") and len(digits_only) >= 12):
            key_type = "telefone"
        else:
            key_type = "chave aleatória"
        pix_block = (
            f"\nDADOS DO PIX (compartilhe SOMENTE quando o cliente escolher pagar com PIX):\n"
            f"  tipo: {key_type}\n"
            f"  chave: {cfg.pix_key}{holder}\n"
        )

    DOW_LABELS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
    closed = cfg.closed_weekdays or []
    closed_block = ""
    if closed:
        closed_names = ", ".join(DOW_LABELS[d] for d in closed if 0 <= d <= 6)
        closed_block = f"\nFECHADO: {closed_names}."

    # Open/closed state at THIS moment determines whether the bot can confirm
    # an order immediately or has to schedule it for the next opening.
    now_local = _local_now()
    is_open = _is_open_now(cfg, now_local)
    open_state_block = ""
    if not is_open:
        next_open = _next_opening_at(cfg, now_local)
        if next_open:
            day_label = DOW_LABELS[next_open.weekday()]
            same_day = next_open.date() == now_local.date()
            when = (
                f"hoje às {next_open.hour}h"
                if same_day
                else f"{day_label} às {next_open.hour}h"
            )
        else:
            when = "no próximo expediente"
        open_state_block = (
            f"\n\nESTADO ATUAL: ESTAMOS FECHADOS AGORA. Reabrimos {when}."
            "\nVocê PODE seguir atendendo normalmente: monte o pedido, pegue endereço, "
            "forma de pagamento e confirme. Quando o cliente confirmar (confirm_order), o "
            "sistema vai AGENDAR o pedido para sair quando abrirmos. "
            "ANTES de finalizar, deixe claro pro cliente: \"Anoto seu pedido e ele entra "
            "na fila pra ser preparado quando abrirmos " + when + "\". "
            "Pergunte se está OK esperar até lá. Se ele preferir não esperar, agradeça e "
            "convide a voltar quando abrirmos. Não invente outro horário; abrimos exatamente "
            f"{when}."
        )

    bot_name = cfg.bot_name or "Bia"

    # Half-pizza pricing rule must match what order_builder.calculate_half_pizza_price
    # actually applies. Hardcoding "MAIS CARO" here would mislead the customer when
    # cfg.half_pizza_pricing is changed to 'average' or 'first'.
    half_pizza_rule = {
        "max": "cobre o sabor MAIS CARO entre os dois (padrão BR)",
        "average": "cobre a MÉDIA dos dois sabores",
        "first": "cobre o preço do PRIMEIRO sabor escolhido",
    }.get(cfg.half_pizza_pricing or "max", "cobre o sabor mais caro entre os dois")

    return f"""Você é {bot_name}, atendente da pizzaria. Fale como uma pessoa de verdade:
calorosa, natural, informal (use "você", "beleza", "fica tranquilo"). NUNCA soe
robótica nem use listas numeradas de menu. Responda sempre em português brasileiro
coloquial. Quando se apresentar, diga "Aqui é a {bot_name}".

NUNCA, em hipótese alguma, diga ou sugira que você é bot, robô, IA, sistema,
assistente virtual, atendente virtual, ou qualquer variação. Se o cliente
perguntar diretamente "você é robô?" ou "isso é um bot?", responda como uma
atendente humana responderia (ex.: "Aqui é a {bot_name}, sou eu mesma 😊"),
sem mentir explicitamente sobre ser pessoa, mas também sem confirmar que é
automação. Se a pergunta insistir, ofereça transferir para outra pessoa
chamando request_human_handoff.

ANÁLISE ANTES DE RESPONDER:
- Leia a mensagem do cliente com atenção e identifique TUDO que ele está pedindo
  (pode ter mais de uma pergunta numa mesma mensagem).
- Se houver qualquer ambiguidade — sabor, tamanho, quantidade, endereço,
  pagamento — use ask_clarification antes de agir. Não chute.
- Não responda mecanicamente nem repita perguntas que o cliente já respondeu.
- Use o histórico de conversa e o estado do carrinho para contextualizar.

CUMPRIMENTO PADRÃO (use só na primeira interação): {cfg.greeting}
HORÁRIO: {cfg.working_hours_start}h às {cfg.working_hours_end}h.{closed_block}{open_state_block}
LIMITE DE ITENS POR PEDIDO: {cfg.max_items_per_order}

REGRAS IMPORTANTES:
- NÃO envie o cardápio completo. Pergunte o que o cliente quer; só sugira se ele pedir.
- Confirme sabores, tamanho, borda e adicionais antes de adicionar ao carrinho.
- Para pizza meio-a-meio: pergunte os dois sabores e {half_pizza_rule}.
- Use as funções disponíveis — NÃO invente preços ou IDs.
- Ao perguntar endereço, peça rua, número, bairro e referência.
- Depois do endereço, informe a taxa e o tempo estimado.
- Antes de confirmar, mostre o resumo completo e peça confirmação explícita.
- Se o cliente xingar, reclamar muito, ou pedir falar com outra pessoa, chame request_human_handoff.
- Se o bairro não for atendido, avise que não entregamos lá e ofereça retirada.

ADICIONAIS GRÁTIS (regra obrigatória após cada pizza adicionada):
- Logo depois de adicionar uma pizza ao carrinho com SUCESSO, ofereça ESPONTANEAMENTE
  os adicionais que estão GRÁTIS para aquela pizza (no cardápio acima eles aparecem
  sem nenhum "(brotinho +R$ X)" entre parênteses — preço zero por padrão).
- Cite no máximo 3 dos mais comuns (cebola, requeijão, orégano extra), em uma única
  frase amigável e curta. Exemplo: "Quer cebola ou requeijão junto? São de cortesia 😊".
- NÃO ofereça os adicionais PAGOS nessa hora — esses só se o cliente perguntar.
- Se o cliente disser que não quer nenhum, siga normalmente para borda/endereço/etc.

PAGAMENTO EM DINHEIRO (regra obrigatória):
- Quando o cliente escolher dinheiro como forma de pagamento, ANTES de confirmar
  o pedido pergunte: "Vai precisar de troco pra quanto?". Se o cliente responder
  um valor (ex.: "100"), chame set_change_for(amount=100). Se o cliente disser
  "não preciso de troco" ou "vou pagar exato", chame set_change_for(amount=0).
- Sem essa pergunta o motoboy chega sem o troco e dá problema.

ENDEREÇO EM ZONA RURAL (regra obrigatória):
- Se o endereço dado pelo cliente claramente é zona rural (sítio, fazenda, estrada,
  rodovia, "km", "zona rural", "área rural"), o número de rua não ajuda o motoboy.
  O sistema detecta isso automaticamente e seta needs_location_pin=true no carrinho.
- Quando needs_location_pin=true e o carrinho ainda NÃO tem delivery_lat/lng,
  peça ao cliente: "Pra zona rural a gente precisa do ponto exato. Manda sua
  localização aqui pelo próprio WhatsApp clicando no clipe 📎 → Localização →
  Enviar localização atual.".
- A localização chega como uma mensagem especial do WhatsApp e o sistema grava
  delivery_lat/lng no carrinho automaticamente. Quando esses campos aparecerem,
  agradeça brevemente ("Show, recebi! 📍") e siga normalmente para forma de pagamento.
- Se o cliente insistir só em texto sem mandar o pin, aceite mas avise que a entrega
  pode demorar mais porque o motoboy vai procurar pela referência.

CARDÁPIO COM IMAGEM (quando o cliente pedir):
- Se o cliente perguntar "tem cardápio?", "manda o cardápio", "quero ver as pizzas",
  "quais sabores de sorvete", "qual o cardápio", chame send_menu_image com a categoria
  apropriada ("salgada", "doce" ou "sorvete").
- A imagem é enviada AUTOMATICAMENTE pelo WhatsApp; sua resposta de texto é apenas
  uma frase curta tipo "Manda aí, ó: 👇" antes ou "Esses são nossos sabores 🍕"
  depois — não precisa repetir o cardápio em texto.
- Se a categoria solicitada não tiver imagem cadastrada, recue para o fluxo de texto
  normal (sugerir 3-4 opções e perguntar o que o cliente quer).
{cpf_rule}
{repeat_rule}
{pix_block}
{cfg.extra_system_prompt or ''}

ESTADO ATUAL: {state.get('state', 'greeting')}
CARRINHO:
{cart_snapshot}
ENDEREÇO: {addr or '—'}
PAGAMENTO: {payment or '—'}
TROCO PARA: {('R$ ' + format(float(cart.get('change_for') or 0), '.2f').replace('.', ',')) if cart.get('change_for') else '—'}
LOCALIZAÇÃO ESPERADA (zona rural): {'sim' if cart.get('needs_location_pin') else 'não'}
LOCALIZAÇÃO RECEBIDA: {('lat=' + str(cart.get('delivery_lat')) + ', lng=' + str(cart.get('delivery_lng'))) if cart.get('delivery_lat') is not None else '—'}

CARDÁPIO (ativo):
{menu_text}

BAIRROS ATENDIDOS:
{zones_text}

FORMAS DE PAGAMENTO: PIX (17), Crédito na entrega (03), Débito na entrega (04), Dinheiro (01), Retirada (90)
"""


async def _execute_tool_call(
    db: AsyncSession,
    phone: str,
    state: dict,
    name: str,
    args: dict,
) -> str:
    """Execute a tool call, mutate state, return a string result to feed back to the model."""
    cart = state.setdefault("cart", {"items": []})

    try:
        if name == "add_pizza_to_cart":
            item = await order_builder.add_pizza(
                db,
                cart,
                flavor_ids=args["flavor_ids"],
                size=args["size"],
                crust=args.get("crust"),
                extras=args.get("extras"),
                quantity=args.get("quantity", 1),
            )
            state["state"] = "building_order"
            return f"OK — adicionado: {item['description']} R$ {item['unit_price']:.2f}"

        if name == "add_simple_product_to_cart":
            item = await order_builder.add_simple_product(
                db, cart, product_id=args["product_id"], quantity=args.get("quantity", 1)
            )
            state["state"] = "building_order"
            return f"OK — adicionado: {item['description']} R$ {item['unit_price']:.2f}"

        if name == "remove_from_cart":
            order_builder.remove_item(cart, args["index"] - 1)
            return "OK — item removido"

        if name == "set_delivery_address":
            addr = f"{args['street']}, {args['number']}"
            if args.get("complement"):
                addr += f" ({args['complement']})"
            zone = await delivery_svc.calculate_fee(db, args["neighborhood"])
            if not zone:
                return (
                    f"bairro '{args['neighborhood']}' não encontrado ou fora da área. "
                    "Diga ao cliente que não atendemos esse bairro e ofereça retirada."
                )
            cart["delivery_address"] = addr
            cart["delivery_neighborhood"] = zone["neighborhood"]
            cart["delivery_fee"] = zone["fee"]
            if args.get("reference"):
                cart["observation"] = (cart.get("observation") or "") + f" Ref: {args['reference']}"
            state["state"] = "collecting_payment"

            # If the address text smells rural, instruct GPT to also ask for
            # the WhatsApp location pin BEFORE moving on to payment. The pin
            # arrives as a special message handled by the webhook, which calls
            # set_delivery_location automatically.
            full_addr_text = " ".join(
                str(args.get(k, "") or "")
                for k in ("street", "neighborhood", "complement", "reference")
            )
            if _is_rural_address(full_addr_text):
                cart["needs_location_pin"] = True
                return (
                    f"OK — endereço registrado (zona rural detectada). Taxa "
                    f"R$ {zone['fee']:.2f}, ~{zone['estimated_minutes']}min. "
                    "ATENÇÃO: peça pro cliente mandar a LOCALIZAÇÃO ATUAL pelo "
                    "WhatsApp (📎 → Localização → Localização atual) antes de "
                    "perguntar o pagamento. Use request_location_pin pra marcar."
                )
            return (
                f"OK — endereço registrado. Taxa de entrega R$ {zone['fee']:.2f}, "
                f"tempo estimado ~{zone['estimated_minutes']}min. Agora pergunte forma de pagamento."
            )

        if name == "set_pickup":
            cart["delivery_address"] = None
            cart["delivery_neighborhood"] = None
            cart["delivery_fee"] = 0
            cart["payment_method"] = "pickup"
            state["state"] = "confirming"
            return "OK — retirada no balcão. Peça confirmação do pedido."

        if name == "set_payment_method":
            cart["payment_method"] = args["method"]
            state["state"] = "confirming"
            if args["method"] == "cash":
                # Nudge GPT to ask about change BEFORE letting it confirm.
                return (
                    "OK — pagamento: dinheiro. ANTES de confirmar, pergunte ao cliente "
                    "'precisa de troco pra quanto?' e quando ele responder chame "
                    "set_change_for. Só DEPOIS mostre o resumo e peça confirmação."
                )
            return f"OK — pagamento: {args['method']}. Mostre o resumo e peça confirmação."

        if name == "confirm_order":
            customer_name = state.get("customer_name")
            # If we're outside operating hours, hold the order until the
            # next opening so the bridge doesn't push it to Datacaixa during
            # closed time. The bot was already told in the system prompt to
            # warn the customer; we just stamp the time here.
            cfg = await _get_bot_config(db)
            now_local = _local_now()
            scheduled_for = None
            if not _is_open_now(cfg, now_local):
                next_open = _next_opening_at(cfg, now_local)
                if next_open is not None:
                    # Persist as UTC for consistency with other timestamps.
                    scheduled_for = next_open.astimezone(timezone.utc)
            result = await order_builder.finalize(
                db,
                phone=phone,
                cart=cart,
                customer_name=customer_name,
                scheduled_for=scheduled_for,
            )
            state["state"] = "completed"
            state["cart"] = {"items": []}
            if scheduled_for:
                from zoneinfo import ZoneInfo
                local_open = scheduled_for.astimezone(ZoneInfo("America/Sao_Paulo"))
                DOW = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
                same_day = local_open.date() == now_local.date()
                when = (
                    f"hoje às {local_open.hour}h"
                    if same_day
                    else f"{DOW[local_open.weekday()]} às {local_open.hour}h"
                )
                return (
                    f"OK — pedido #{result['order_number']:03d} AGENDADO para {when}, "
                    f"total R$ {result['total']:.2f}. Avise o cliente que vai ser preparado "
                    f"quando abrirmos e se despeça."
                )
            return (
                f"OK — pedido #{result['order_number']:03d} confirmado, "
                f"total R$ {result['total']:.2f}. Avise o cliente e se despeça."
            )

        if name == "repeat_last_order":
            customer_id = state.get("customer_id")
            if not customer_id:
                return "cliente ainda não está cadastrado"
            ctx = await customer_service.get_returning_customer_context(db, customer_id)
            if not ctx:
                return "sem pedido anterior"
            cart["items"] = [
                {**it, "is_delivery_fee": False, "unit": "UN"}
                for it in ctx["items"]
            ]
            if ctx.get("delivery_address"):
                cart["delivery_address"] = ctx["delivery_address"]
                cart["delivery_neighborhood"] = ctx.get("delivery_neighborhood")
                zone = await delivery_svc.calculate_fee(db, ctx.get("delivery_neighborhood") or "")
                if zone:
                    cart["delivery_fee"] = zone["fee"]
            cart["payment_method"] = ctx.get("payment_method")
            state["state"] = "confirming"
            return (
                "OK — último pedido restaurado. Mostre o resumo e pergunte se confirma ou quer mudar algo."
            )

        if name == "request_human_handoff":
            await handoff_svc.trigger_handoff(phone, args.get("reason", "ai_triggered"))
            return "OK — transferido para atendente humano."

        if name == "set_customer_name":
            state["customer_name"] = args["name"]
            return f"OK — nome registrado: {args['name']}"

        if name == "ask_clarification":
            return (
                f"OK — registrada dúvida sobre {args.get('topic', '?')}. "
                f"Faça a pergunta ao cliente: {args.get('question', '')}"
            )

        if name == "set_change_for":
            try:
                amount = float(args.get("amount") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            cart["change_for"] = round(max(0.0, amount), 2)
            if amount > 0:
                return (
                    f"OK — registrado: troco para R$ {amount:.2f}. Agora mostre o "
                    "resumo completo do pedido e peça confirmação."
                )
            return (
                "OK — registrado: cliente paga exato (sem troco). Mostre o resumo "
                "e peça confirmação."
            )

        if name == "send_menu_image":
            cfg = await _get_bot_config(db)
            menu_images = cfg.menu_images or {}
            category = (args.get("category") or "").strip().lower()
            url = menu_images.get(category)
            if not url:
                return (
                    f"INDISPONÍVEL: não há imagem cadastrada para a categoria "
                    f"'{category}'. Liste as opções em texto pro cliente, oferecendo "
                    "3-4 sugestões e perguntando o que ele quer."
                )
            try:
                # Stored URL is /media/products/<file>. Evolution needs an
                # absolute, publicly reachable URL OR raw base64. We don't
                # assume the backend is reachable from Evolution's host, so
                # read the file off disk and ship base64.
                media_payload: str
                if url.startswith("/media/"):
                    media_root = Path(__file__).resolve().parents[2] / "media"
                    rel = url[len("/media/"):].lstrip("/")
                    file_path = (media_root / rel).resolve()
                    if not str(file_path).startswith(str(media_root.resolve())):
                        raise ValueError("invalid menu image path")
                    if not file_path.is_file():
                        raise FileNotFoundError(f"menu image missing on disk: {url}")
                    media_payload = base64.b64encode(file_path.read_bytes()).decode("ascii")
                else:
                    # Already-absolute URL stored by some other flow — pass through.
                    media_payload = url
                from app.services.whatsapp import client as wa
                await wa.send_media(
                    phone=phone,
                    media_base64_or_url=media_payload,
                    media_type="image",
                )
                return (
                    f"OK — imagem do cardápio '{category}' enviada pelo WhatsApp. "
                    "Mande SÓ uma frase curta pro cliente (ex: 'Manda aí, ó 👇' "
                    "ou 'Esses são nossos sabores 🍕'); não repita o cardápio em texto."
                )
            except Exception as e:
                log.exception("send_menu_image failed")
                return (
                    f"FALHA: não consegui enviar a imagem ({e}). Continue em texto: "
                    "liste 3-4 sugestões da categoria e pergunte o que o cliente quer."
                )

        if name == "request_location_pin":
            cart["needs_location_pin"] = True
            return (
                "OK — marcado que aguardamos localização. Peça pro cliente: "
                "'Manda sua localização atual aqui pelo WhatsApp clicando no clipe "
                "📎 → Localização → Enviar localização atual'. Quando ela chegar, o "
                "sistema chama set_delivery_location automaticamente — você só "
                "confirma com o cliente que recebeu."
            )

        return f"ferramenta desconhecida: {name}"

    except ValueError as e:
        # ValueError from order_builder/menu_service signals a *user-input*
        # problem (size doesn't allow meia-a-meia, unknown extra, etc.) —
        # not a system fault. Hand it to the model as a clear instruction so
        # it composes a polite reply instead of a stack trace. The "INVÁLIDO:"
        # prefix is invisible to the customer; the model strips it.
        log.info("tool %s rejected: %s", name, e)
        return (
            f"INVÁLIDO: {e}. "
            "Diga ao cliente em português, de forma educada, qual o problema "
            "e ofereça uma alternativa quando possível (ex: outro tamanho, "
            "1 sabor só, outra borda)."
        )
    except Exception as e:
        log.exception("tool %s failed", name)
        return f"erro: {e}"


async def process_incoming(
    db: AsyncSession,
    *,
    phone: str,
    text: str,
    is_audio: bool = False,
    media_url: Optional[str] = None,
    media_type: Optional[str] = None,
) -> Optional[str]:
    """
    Main entry — process a single incoming message and return a reply string (or None if
    in human-takeover mode).

    media_url / media_type carry the inbound attachment (an image or the
    original voice note) so the admin chat viewer can render it. They are
    only attached to the persisted MessageRole.user row; the AI itself
    only sees the transcribed/synthesised `text`.
    """
    state = await state_svc.get_state(phone)

    if state.get("state") == "human_takeover":
        # Still record inbound so admin can see it
        await _persist_message(
            db, phone=phone, customer_id=state.get("customer_id"),
            role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
            media_url=media_url, media_type=media_type,
        )
        return None

    # Lazy ensure customer row + pull returning-customer context
    customer = await customer_service.find_or_create_by_phone(db, phone)
    state["customer_id"] = customer.id
    if customer.name and not state.get("customer_name"):
        state["customer_name"] = customer.name

    # ---------- Barrier A: input size cap ----------
    # Reject (politely) if a single message — text or transcribed audio —
    # is so large that just relaying it could blow the per-call token budget.
    # Costs nothing because we never reach OpenAI.
    if text and len(text) > MAX_INBOUND_CHARS:
        log.info(
            "barrier-A: input too long (%d chars) for %s — refusing politely",
            len(text), phone,
        )
        if is_audio:
            polite = (
                "Seu áudio ficou bem comprido 😅 Manda ele em pedaços menores, "
                "de até um minutinho, que assim eu te entendo direitinho!"
            )
        else:
            polite = (
                "Foi muita coisa de uma vez 😊 Me manda em partes menores que "
                "assim eu consigo te ajudar bem!"
            )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
        )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=polite,
        )
        try:
            from app.services.websocket import manager
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "user", "content": text, "is_audio": is_audio},
            )
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "assistant", "content": polite, "is_audio": False},
            )
        except Exception:
            pass
        return polite

    cfg = await _get_bot_config(db)

    # Off-hours behaviour is now SOFT: the bot still goes through GPT and the
    # full ordering flow, but the system prompt tells it to schedule rather
    # than confirm immediately, and confirm_order stamps scheduled_for so the
    # bridge holds the order until the next opening time.

    # LGPD: send the privacy notice once per phone, before anything else.
    # This is the FIRST message the bot ever sends to a new customer.
    if cfg.privacy_notice and not customer.privacy_notice_sent:
        customer.privacy_notice_sent = True
        await db.commit()
        # Persist + broadcast as if the bot replied
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
        )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=cfg.privacy_notice,
        )
        try:
            from app.services.websocket import manager
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "assistant", "content": cfg.privacy_notice, "is_audio": False},
            )
        except Exception:
            pass
        return cfg.privacy_notice

    # ---------- Barrier C: per-phone hourly cap ----------
    # A single number flooding the bot cannot, by itself, drain the global
    # daily budget. Once it crosses the hourly cap we hand off to a human
    # and let the operator decide whether to engage or block.
    if await _phone_rate_exceeded(phone):
        log.warning("barrier-C: phone %s exceeded hourly cap — handoff", phone)
        try:
            await handoff_svc.trigger_handoff(phone, reason="rate_per_phone")
        except Exception:
            log.exception("handoff failed in barrier-C")
        polite = (
            "Já trocamos várias mensagens, hein! 😊 "
            "Vou pedir pra um colega aqui te dar mais atenção. Já já alguém fala com você."
        )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
        )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=polite,
        )
        try:
            from app.services.websocket import manager
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "user", "content": text, "is_audio": is_audio},
            )
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "assistant", "content": polite, "is_audio": False},
            )
        except Exception:
            pass
        return polite

    # Token-budget guardrail — short-circuit to handoff before paying for another GPT-4o call
    if cfg.daily_token_budget and await _daily_tokens_exceeded(cfg.daily_token_budget):
        log.warning("daily token budget exceeded — auto-handoff for %s", phone)
        # Note: handoff_svc is already module-level. A local re-import here
        # used to shadow it as a local variable, which broke Barrier C above
        # (UnboundLocalError before the line ran).
        await handoff_svc.trigger_handoff(phone, reason="token_budget_exceeded")
        return (
            "Oi! A casa tá cheia hoje 😊 Já já um colega te responde por aqui."
        )

    context = state.get("context_messages", [])
    system_prompt = await _build_system_prompt(db, state)

    audio_hint = " (cliente enviou áudio)" if is_audio else ""
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    messages.extend(context[-12:])
    messages.append({"role": "user", "content": f"{text}{audio_hint}"})

    # ---------- Barrier B: per-call TPM estimate ----------
    # Refuse the OpenAI call if the estimated payload alone would already
    # eat most of the org's per-minute token allowance. Better to ask the
    # customer to wait a moment than to consume budget on a 429.
    estimated_in = _estimate_messages_tokens(messages)
    estimated_total = estimated_in + 700  # max_tokens reserved for the reply
    if estimated_total > TPM_SAFE_LIMIT_TOKENS:
        log.warning(
            "barrier-B: payload ~%d tokens > %d safe limit for %s",
            estimated_total, TPM_SAFE_LIMIT_TOKENS, phone,
        )
        polite = (
            "Tô com muito atendimento simultâneo agora 🙏 "
            "Me dá um minutinho que já te respondo direitinho!"
        )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
        )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=polite,
        )
        try:
            from app.services.websocket import manager
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "user", "content": text, "is_audio": is_audio},
            )
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "assistant", "content": polite, "is_audio": False},
            )
        except Exception:
            pass
        return polite

    try:
        response = await _openai().chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=TOOLS,
            temperature=0.5,
            max_tokens=700,
        )
    except Exception:
        log.exception("OpenAI call failed")
        return "Ih, tive um probleminha aqui. Pode repetir?"

    if response.usage:
        await _add_token_usage(response.usage.total_tokens or 0)

    msg = response.choices[0].message
    tool_msgs: list[dict[str, Any]] = []

    for call in (msg.tool_calls or []):
        try:
            args = json.loads(call.function.arguments or "{}")
        except Exception:
            args = {}
        result = await _execute_tool_call(db, phone, state, call.function.name, args)
        tool_msgs.append(
            {
                "role": "tool",
                "tool_call_id": call.id,
                "content": result,
            }
        )

    # If there were tool calls, ask GPT for the user-facing reply using the tool results
    if tool_msgs:
        followup = [
            {"role": "system", "content": system_prompt},
            *context[-12:],
            {"role": "user", "content": f"{text}{audio_hint}"},
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": c.id,
                        "type": "function",
                        "function": {"name": c.function.name, "arguments": c.function.arguments},
                    }
                    for c in msg.tool_calls
                ],
            },
            *tool_msgs,
        ]
        try:
            response2 = await _openai().chat.completions.create(
                model="gpt-4o",
                messages=followup,
                temperature=0.5,
                max_tokens=700,
            )
            if response2.usage:
                await _add_token_usage(response2.usage.total_tokens or 0)
            reply = response2.choices[0].message.content or ""
        except Exception:
            log.exception("OpenAI follow-up call failed")
            reply = "Ok! " + (msg.content or "")
    else:
        reply = msg.content or ""

    # Persist context + state
    context.append({"role": "user", "content": text})
    context.append({"role": "assistant", "content": reply})
    state["context_messages"] = context[-20:]
    await state_svc.set_state(phone, state)

    # Persistent chat history (DB)
    await _persist_message(
        db, phone=phone, customer_id=state.get("customer_id"),
        role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
    )
    if reply:
        await _persist_message(
            db, phone=phone, customer_id=state.get("customer_id"),
            role=MessageRole.assistant, content=reply,
        )

    # Broadcast for the live conversation viewer
    try:
        from app.services.websocket import manager
        await manager.broadcast(
            "chat_message",
            {"phone": phone, "role": "user", "content": text, "is_audio": is_audio},
        )
        if reply:
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "assistant", "content": reply, "is_audio": False},
            )
    except Exception:
        pass

    return reply.strip() or None

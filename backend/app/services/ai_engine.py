"""
AI conversation engine — GPT-4o with function calling.

The engine gets a turn from WhatsApp, renders the full context, calls OpenAI,
executes any tool calls (add_to_cart, set_delivery_address, etc.), and returns
a plain-text reply to send back.
"""
import json
import logging
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


async def _persist_message(
    db: AsyncSession,
    *,
    phone: str,
    customer_id: int | None,
    role: MessageRole,
    content: str,
    is_audio: bool = False,
) -> None:
    db.add(
        ConversationMessage(
            phone=phone,
            customer_id=customer_id,
            role=role,
            content=content,
            is_audio=is_audio,
        )
    )
    await db.commit()


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
        closed_block = f"\nFECHADO: {closed_names}. Nesses dias responda: \"{cfg.off_hours_message}\""

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
HORÁRIO: {cfg.working_hours_start}h às {cfg.working_hours_end}h. Fora desse horário responda: "{cfg.off_hours_message}"{closed_block}
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
{cpf_rule}
{repeat_rule}
{pix_block}
{cfg.extra_system_prompt or ''}

ESTADO ATUAL: {state.get('state', 'greeting')}
CARRINHO:
{cart_snapshot}
ENDEREÇO: {addr or '—'}
PAGAMENTO: {payment or '—'}

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
            return f"OK — pagamento: {args['method']}. Mostre o resumo e peça confirmação."

        if name == "confirm_order":
            customer_name = state.get("customer_name")
            result = await order_builder.finalize(db, phone=phone, cart=cart, customer_name=customer_name)
            state["state"] = "completed"
            state["cart"] = {"items": []}
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
) -> Optional[str]:
    """
    Main entry — process a single incoming message and return a reply string (or None if
    in human-takeover mode).
    """
    state = await state_svc.get_state(phone)

    if state.get("state") == "human_takeover":
        # Still record inbound so admin can see it
        await _persist_message(
            db, phone=phone, customer_id=state.get("customer_id"),
            role=MessageRole.user, content=text, is_audio=is_audio,
        )
        return None

    # Lazy ensure customer row + pull returning-customer context
    customer = await customer_service.find_or_create_by_phone(db, phone)
    state["customer_id"] = customer.id
    if customer.name and not state.get("customer_name"):
        state["customer_name"] = customer.name

    cfg = await _get_bot_config(db)

    # Hard off-hours / closed-day gate — short-circuits BEFORE any GPT call.
    # Saves OpenAI tokens and responds instantly when the pizzaria is closed.
    # Compares in São Paulo local time (the relevant zone for Marcio).
    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime
        now_local = datetime.now(ZoneInfo("America/Sao_Paulo"))
    except Exception:
        from datetime import datetime
        now_local = datetime.utcnow()

    closed_today = (now_local.weekday() in (cfg.closed_weekdays or []))
    h_start = int(cfg.working_hours_start or 0)
    h_end = int(cfg.working_hours_end or 24)
    out_of_hours = not (h_start <= now_local.hour < h_end)

    if closed_today or out_of_hours:
        msg = cfg.off_hours_message or "Estamos fechados no momento."
        # Persist + broadcast as a normal turn so the admin sees it
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.user, content=text, is_audio=is_audio,
        )
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=msg,
        )
        try:
            from app.services.websocket import manager
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "assistant", "content": msg, "is_audio": False},
            )
        except Exception:
            pass
        return msg

    # LGPD: send the privacy notice once per phone, before anything else.
    # This is the FIRST message the bot ever sends to a new customer.
    if cfg.privacy_notice and not customer.privacy_notice_sent:
        customer.privacy_notice_sent = True
        await db.commit()
        # Persist + broadcast as if the bot replied
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.user, content=text, is_audio=is_audio,
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

    # Token-budget guardrail — short-circuit to handoff before paying for another GPT-4o call
    if cfg.daily_token_budget and await _daily_tokens_exceeded(cfg.daily_token_budget):
        log.warning("daily token budget exceeded — auto-handoff for %s", phone)
        from app.services import handoff as handoff_svc
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

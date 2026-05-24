"""
AI conversation engine — GPT-4o with function calling.

The engine gets a turn from WhatsApp, renders the full context, calls OpenAI,
executes any tool calls (add_to_cart, set_delivery_address, etc.), and returns
a plain-text reply to send back.
"""
import json
import logging
import random
import re
import time
from datetime import timezone
from pathlib import Path
from typing import Any, Optional

import redis.asyncio as _redis
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
from app.services.notifications import is_admin_phone as _is_admin_phone
from app.services.menu_service import get_menu_for_bot, get_pizza_size_names

log = logging.getLogger(__name__)

_client: Optional[AsyncOpenAI] = None

# Chat model used for both the tool-decision turn and the synthesis turn.
# gpt-4o-mini is 3-5x faster and ~15x cheaper than gpt-4o; the bot's
# tasks (greeting, menu Q&A, order assembly via tools) sit comfortably
# inside mini's capability envelope. Switched 2026-05-20 after a real
# exchange showed a 70-second reply latency dominated by the gpt-4o
# round trip. Bump back to "gpt-4o" if reply quality regresses.
CHAT_MODEL = "gpt-4o-mini"


def _openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


# Redis cache for the static parts of the system prompt — menu, delivery
# zones, pizza size names. All three are pure DB-derived strings that
# change at most a few times per day; rebuilding them on every customer
# message wastes ~1-2s of DB time and bloats the LLM prompt with
# variation that does not exist. 60s TTL is short enough that menu edits
# in the admin panel propagate quickly without explicit invalidation.
_redis_client: Optional[_redis.Redis] = None
_MENU_BUNDLE_KEY = "ai_engine:menu_bundle:v1"
_MENU_BUNDLE_TTL_SECONDS = 60


def _get_redis() -> _redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = _redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


# Temporary "all customer messages get redirected to the other number"
# mode. Active while settings.bot_redirect_enabled is true. Customers
# can bypass by prefixing their message with the literal word "bot"
# (case-insensitive, optional separator) — operator's testing escape
# hatch so the bot can still be exercised end-to-end while real
# customer traffic is parked.
_BOT_REDIRECT_MESSAGE = (
    "Olá! 🍕 Aqui é da Pizzaria Planalto. Esse canal está em ajustes no "
    "momento — pra fazer seu pedido, fala com a gente direto no "
    "+55 17 3237-1112 que te respondemos rapidinho. Obrigado pela paciência! 😊"
)
_BOT_KEYWORD_RE = re.compile(
    r"^\s*bot\b[\s:,.!?\-]*(.*)$",
    re.IGNORECASE | re.DOTALL,
)


# Pure greeting messages — single short phrase, no question, no context.
# When a fresh conversation starts with one of these AND the pizzaria is
# open, the LLM almost always replies with the same boilerplate Bia
# greeting. Skip the round trip and answer instantly. Anything more
# substantial than a greeting still goes through the LLM.
_GREETING_RE = re.compile(
    r"^\s*(ol[áa]+|oi+|oie+|oi[êe]+|opa+|salve|al[ôo]+|hey+|hi+|hello+|"
    r"bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem\??|tudo\s*certo\??)"
    r"[\s.!?😊🙂🍕]*$",
    re.IGNORECASE,
)

# Greeting templates the fast-path picks from. Rules to keep them
# customer-friendly:
#   1. Identify the pizzaria by name on the first contact (NEW pool).
#      A cold "Como posso te ajudar?" reads like a generic chatbot;
#      "Aqui é da Pizzaria Planalto" sets context immediately.
#   2. Offer at least one concrete next step — see the menu, place an
#      order, repeat the previous one. Open-ended "pode mandar o que
#      quiser" left customers stuck not knowing how to start.
#   3. Use the Bia persona warmly; emoji 😊 + 🍕 reinforces the pizza
#      context visually.
# If you need to add a variant, keep the same shape so the random
# choice doesn't surface a tonally jarring outlier.
_GREETINGS_NEW = (
    "Olá! 🍕 Aqui é a Bia, da Pizzaria Planalto. Quer dar uma olhada no cardápio ou já sabe o que vai pedir? 😊",
    "Oi! 😊 Sou a Bia, da Pizzaria Planalto. Posso te ajudar a montar o pedido — quer ver o cardápio ou já vai mandando? 🍕",
    "Olá! 🍕 Pizzaria Planalto na escuta, aqui é a Bia. Bora pedir uma pizza? Posso te mandar o cardápio se quiser 😊",
)

_GREETINGS_RETURNING = (
    "Oi, {name}! 😊 Que bom te ver de novo na Pizzaria Planalto. Quer repetir o último pedido ou ver o cardápio? 🍕",
    "Olá, {name}! 🍕 Saudades por aqui! Posso te mandar o cardápio ou já anoto o pedido?",
    "E aí, {name}! 😊 Aqui é a Bia da Pizzaria Planalto. Bora pedir uma pizza hoje? Quer ver o cardápio antes? 🍕",
)


def _try_greeting_fast_path(
    text: str, state: dict, customer_name: Optional[str], is_open: bool
) -> Optional[str]:
    """Return a fixed greeting reply if this turn qualifies for the fast-path.

    Conditions: the message itself is a plain greeting AND the conversation
    is truly fresh (empty cart, no prior turns, default state) AND the
    pizzaria is currently open. Anything else falls through to the LLM so
    context-aware logic (closed-hours message, mid-order resume, returning-
    customer suggestion, etc.) stays intact.
    """
    if not is_open:
        return None
    if not text or not _GREETING_RE.match(text):
        return None
    cart = state.get("cart") or {}
    if cart.get("items"):
        return None
    if state.get("context_messages"):
        return None
    if state.get("state") not in (None, "", "greeting"):
        return None
    pool = _GREETINGS_RETURNING if customer_name else _GREETINGS_NEW
    template = random.choice(pool)
    return template.format(name=customer_name) if customer_name else template


async def _get_menu_bundle_cached(db: AsyncSession) -> tuple[str, str, str]:
    """Return (menu_text, zones_text, sizes_label), cached in Redis."""
    rc = _get_redis()
    raw = await rc.get(_MENU_BUNDLE_KEY)
    if raw:
        try:
            data = json.loads(raw)
            return data["menu"], data["zones"], data["sizes_label"]
        except Exception:
            pass
    menu_text = await get_menu_for_bot(db)
    zones_text = await delivery_svc.get_all_zones_formatted(db)
    size_names = await get_pizza_size_names(db)
    sizes_label = " / ".join(size_names) if size_names else "tamanho"
    try:
        await rc.set(
            _MENU_BUNDLE_KEY,
            json.dumps({"menu": menu_text, "zones": zones_text, "sizes_label": sizes_label}),
            ex=_MENU_BUNDLE_TTL_SECONDS,
        )
    except Exception:
        log.exception("menu bundle cache write failed (non-fatal)")
    return menu_text, zones_text, sizes_label


# ---- Tool schema for GPT function calling ----

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "add_pizza_to_cart",
            "description": (
                "Adiciona uma pizza ao carrinho (inteira ou meia-a-meia). "
                "REGRA DURA: BROTINHO é sempre 1 SABOR. Se o cliente pedir "
                "brotinho meio-a-meio, NÃO chame esta função — chame "
                "ask_clarification e explique que brotinho é individual "
                "(só 1 sabor) e ofereça: (a) escolher 1 sabor só pro "
                "brotinho ou (b) fazer meio-a-meio numa pizza Grande."
            ),
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
                    "crust": {"type": "string", "description": "Borda (opcional). Ignorada se sem_massa=true."},
                    "extras": {"type": "array", "items": {"type": "string"}, "description": "Adicionais"},
                    "quantity": {"type": "integer", "default": 1},
                    "sem_massa": {
                        "type": "boolean",
                        "default": False,
                        "description": (
                            "Variante low-carb / sem massa. Quando true e a pizzaria oferece, "
                            "o sistema cobra o preço de 'pizza sem massa' (mais barato) e "
                            "ignora qualquer borda escolhida (não tem massa pra rechear)."
                        ),
                    },
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
            "description": (
                "Registra o endereço completo de entrega DO CLIENTE. "
                "REGRA DURA: só chame esta função quando o cliente já tiver "
                "fornecido EXPLICITAMENTE o NOME DA RUA e o NÚMERO DA CASA. "
                "NUNCA invente um número. NUNCA chute uma rua. NUNCA chame "
                "esta função com só o bairro — sem rua + número o sistema "
                "não consegue calcular a taxa real e o pedido sai com fee "
                "errado. Se o cliente só mandou o bairro, use "
                "ask_clarification para pedir a rua + número + um ponto de "
                "referência (algo perto da casa) ANTES de chamar set_delivery_"
                "address. 'sem número', 's/n' e variações NÃO são números "
                "válidos — peça o número da casa de novo se o cliente disser "
                "isso."
            ),
            "parameters": {
                "type": "object",
                "required": ["street", "number", "neighborhood"],
                "properties": {
                    "street": {
                        "type": "string",
                        "description": "Nome da rua/avenida. Ex: 'Rua das Flores'.",
                    },
                    "number": {
                        "type": "string",
                        "description": (
                            "Número da casa, apenas dígitos (com letra opcional "
                            "tipo '12B'). NUNCA 'sem número', 's/n', 'SN' ou "
                            "zero. Se o cliente não souber, use ask_clarification."
                        ),
                    },
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
                "OBRIGATÓRIO chamar SEMPRE que o cliente sinalizar que quer ver o cardápio, "
                "menu, sabores, opções, as pizzas, OU as bordas — em qualquer idioma e "
                "qualquer fraseado, direto ou indireto. Exemplos de gatilhos: 'manda o "
                "cardápio', 'tem menu?', 'quais sabores?', 'que pizzas vocês têm?', 'vamos "
                "começar pelo menu', 'show me menu', 'me mostra as opções', 'queria ver "
                "as pizzas', 'quais bordas vocês têm?', 'tem borda recheada?', 'quanto "
                "custa a borda?'. ESCOLHA DA CATEGORIA: se o cliente pedir o cardápio "
                "GENERICAMENTE (sem distinguir salgada vs doce), use 'pizzas' — o backend "
                "envia AS DUAS imagens (salgadas + doces) em sequência num único turno. "
                "Use 'salgada' ou 'doce' apenas quando o cliente DEIXAR CLARO que quer só "
                "uma (ex.: 'tem pizza doce?', 'manda as salgadas'). Esta função envia a "
                "imagem REAL pelo WhatsApp; NUNCA escreva 'vou te mandar o cardápio' sem "
                "chamar esta função no mesmo turno — o cliente não receberia a imagem. "
                "Categorias: 'pizzas' (manda salgadas + doces juntas), 'salgada' (só pizzas "
                "salgadas), 'doce' (só pizzas doces), 'sorvete' (sorvetes), 'bebida' "
                "(bebidas), 'borda' (sabores e preços de borda recheada)."
            ),
            "parameters": {
                "type": "object",
                "required": ["category"],
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["pizzas", "salgada", "doce", "sorvete", "bebida", "borda"],
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


async def _send_one_menu_image(
    *,
    db: AsyncSession,
    state: dict,
    phone: str,
    category: str,
    url: str,
) -> None:
    """Send a single category's menu image over WhatsApp + persist the row.

    Extracted from the inline tool handler so the new 'pizzas' pseudo-
    category can fire this twice (salgada + doce) in a single tool call.

    Raises on any send / file-read failure; caller decides whether to
    abort the whole batch or just log and continue with the next sub-
    category. Cache-miss + Meta's 30-day media_id eviction are handled
    transparently here — caller doesn't need to know.
    """
    from app.services.whatsapp import client as wa
    import mimetypes
    rc = _get_redis()
    cache_key = f"menu_image_media_id:{category}"
    cached_id: Optional[str] = None
    try:
        cached_id = await rc.get(cache_key)
    except Exception:
        pass
    if cached_id:
        send_result = await wa.send_media(
            phone=phone,
            media_type="image",
            cached_media_id=cached_id,
        )
        if isinstance(send_result, dict) and send_result.get("error"):
            log.info("cached menu media_id stale, re-uploading: %s", cached_id)
            cached_id = None
    if not cached_id:
        if url.startswith("/media/"):
            media_root = Path(__file__).resolve().parents[2] / "media"
            rel = url[len("/media/"):].lstrip("/")
            file_path = (media_root / rel).resolve()
            if not str(file_path).startswith(str(media_root.resolve())):
                raise ValueError("invalid menu image path")
            if not file_path.is_file():
                raise FileNotFoundError(f"menu image missing on disk: {url}")
            media_bytes = file_path.read_bytes()
            mime = mimetypes.guess_type(str(file_path))[0] or "image/jpeg"
            fname = file_path.name
        else:
            raise ValueError(
                "menu image URL is not a local /media path; Meta "
                "Cloud API needs raw bytes or a public link"
            )
        send_result = await wa.send_media(
            phone=phone,
            data=media_bytes,
            media_type="image",
            mime_type=mime,
            filename=fname,
        )
        new_id = send_result.get("media_id") if isinstance(send_result, dict) else None
        if new_id:
            try:
                # 25-day TTL — Meta caches 30 days, give a 5-day buffer.
                await rc.set(cache_key, new_id, ex=25 * 24 * 3600)
            except Exception:
                log.exception("menu media_id cache write failed (non-fatal)")
    await _persist_message(
        db,
        phone=phone,
        customer_id=state.get("customer_id"),
        role=MessageRole.assistant,
        content=f"[CARDÁPIO {category.upper()}]",
        media_url=url,
        media_type="image",
    )


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

    # Push to any connected admin WebSocket so the Conversas panel
    # repaints without an F5. Same event shape conversations.py already
    # broadcasts when an operator sends a manual reply — useChatStream
    # on the frontend filters by phone and invalidates the chat query.
    # Failures here MUST NOT bubble up: the message is already persisted,
    # a missing live update is a UX regression, not a data one.
    try:
        from app.services.websocket import manager
        await manager.broadcast(
            "chat_message",
            {
                "phone": phone,
                "role": role.value if hasattr(role, "value") else str(role),
                "content": content,
                "is_audio": is_audio,
                "media_url": media_url,
                "media_type": media_type,
            },
        )
    except Exception:
        log.exception("broadcast on _persist_message failed (non-fatal)")


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
    menu_text, zones_text, sizes_label = await _get_menu_bundle_cached(db)

    # Cart snapshot — itemised lines + the deterministic subtotal / fee /
    # total. GPT must mirror these numbers; recomputing is forbidden in
    # the directives below. Without the totals here, GPT used to guess
    # and ended up showing R$ 105 in the resumo, then R$ 125 at confirm
    # — undermining customer trust.
    cart = state.get("cart", {"items": []})
    items = cart.get("items", [])
    if items:
        cart_lines = []
        for i, it in enumerate(items, 1):
            line_total = float(it["unit_price"]) * int(it.get("quantity", 1))
            cart_lines.append(
                f"  {i}. {it['quantity']}× {it['description']} — R$ {line_total:.2f}".replace(".", ",")
            )
        subtotal, fee, total = order_builder.cart_totals(cart)
        cart_lines.append("")
        cart_lines.append(f"  Subtotal: R$ {subtotal:.2f}".replace(".", ","))
        if fee:
            cart_lines.append(f"  Taxa de entrega: R$ {fee:.2f}".replace(".", ","))
        else:
            cart_lines.append("  Taxa de entrega: — (retirada ou ainda sem endereço)")
        cart_lines.append(f"  TOTAL FECHADO: R$ {total:.2f}".replace(".", ","))
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

    # Flat pizza pricing block — only injected when the operator opted in via
    # bot_config. When set, it OVERRIDES the half-pizza rule and the per-size
    # pricing in the menu (the menu sizes are still shown for reference).
    flat_with = cfg.pizza_flat_price_with_crust
    flat_without = cfg.pizza_flat_price_without_crust
    flat_price_block = ""
    if flat_with is not None:
        with_str = f"R$ {float(flat_with):.2f}".replace(".", ",")
        without_str = (
            f"R$ {float(flat_without):.2f}".replace(".", ",")
            if flat_without is not None else None
        )
        sem_massa_block = (
            f"\n- Pizza SEM MASSA (low-carb / sem a massa, só os ingredientes "
            f"em cima): {without_str}. Quando o cliente pedir 'sem massa', "
            f"'sem a massa', 'no carb' ou similar, chame add_pizza_to_cart "
            f"com sem_massa=true. Borda recheada NÃO se aplica nesse caso."
            if without_str else
            "\n- 'Sem massa' não está habilitado nesta pizzaria — se o cliente "
            "pedir, avise educadamente que só temos pizza com massa."
        )
        flat_price_block = (
            "\n\nPREÇO FECHADO DE PIZZA (regra OBRIGATÓRIA — IGNORE preços por "
            f"tamanho do cardápio):\n"
            f"- TODA pizza COM MASSA custa {with_str}, seja sabor único ou "
            f"meio-a-meio, em qualquer tamanho. NÃO faça conta de meio-a-meio, "
            f"NÃO use o preço por tamanho do cardápio para a pizza."
            f"{sem_massa_block}\n"
            f"- A borda recheada paga e adicionais pagos AINDA somam por cima "
            f"do preço fechado (o sistema calcula automaticamente).\n"
            f"- A taxa de entrega é separada e aparece no resumo como linha "
            f"própria.\n"
            f"- PROIBIDO perguntar 'qual metade é mais cara?' ou 'qual sabor "
            f"é mais caro?' — com preço fechado a metade nunca é mais cara, "
            f"toda combinação custa {with_str}. A pergunta confunde o cliente "
            f"e revela bug. Apenas confirme os dois sabores e adicione."
        )

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

BROTINHO É SEMPRE 1 SABOR (regra dura — não falhe nessa):
- BROTINHO é uma pizza individual pequena. NÃO existe brotinho meio-a-meio.
- Se o cliente pedir "brotinho meio a meio" ou "brotinho metade X metade Y",
  NÃO chame add_pizza_to_cart com dois flavor_ids. Chame ask_clarification
  e explique gentilmente: "O brotinho é uma pizza individual, fica com 1
  sabor só — qual dos dois você prefere pro brotinho? Ou prefere fazer
  meio-a-meio numa pizza Grande, que aí dá certo?".
- Mesmo se o cliente insistir, MANTENHA a regra. O sistema também recusa
  no backend, então tentar mesmo assim só gera erro e atrasa o pedido.

OFERECER CORTESIAS APÓS PIZZA (regra dura — não esqueça):
- TODA vez que add_pizza_to_cart retornar OK (pizza acabou de entrar no
  carrinho), na MESMA mensagem em que confirma a pizza, OFEREÇA cebola
  e requeijão como cortesia. Exemplo: "Anotado! 🍕 Quer com cebola e
  requeijão? Vai por cortesia, sem custo extra."
- Se o cliente aceitar, chame add_pizza_to_cart de novo com as cortesias
  em extras, OU use uma função de update se houver. Se não houver,
  remova a pizza antes e re-adicione com os extras.
- Se o cliente recusar, prossiga normal (oferecer borda, bebida, etc.).
- Não ofereça as cortesias mais de uma vez por pizza. Se já perguntou
  uma vez e cliente respondeu, NÃO repita.

PIZZA MEIO-A-MEIO — REGRA DURA (não falhe nessa):
- Meio-a-meio é UMA pizza com DOIS sabores. Chame add_pizza_to_cart
  UMA ÚNICA VEZ com flavor_ids=[id_sabor1, id_sabor2] e size=tamanho
  pedido. NÃO chame duas vezes (uma para cada sabor) — isso adiciona
  DUAS pizzas inteiras ao carrinho e cobra dobrado, bug grave que já
  gerou reclamação real.
- Se você já tinha adicionado os dois sabores como pizzas separadas
  (chamadas duplas) e o cliente CORRIGIR ("é meio a meio, uma pizza
  só", "não, é meio-a-meio", "uma pizza só, metade X metade Y"),
  você DEVE: (1) chamar remove_from_cart para cada uma das pizzas
  inteiras erradas e (2) chamar add_pizza_to_cart UMA vez com
  flavor_ids=[id1, id2]. NUNCA deixe os itens duplicados no carrinho
  pensando que vai "compensar no resumo" — o resumo mostra o que está
  no carrinho de verdade, e o cliente é cobrado pelo que está lá.
- Se o cliente disser "metade X, metade Y" desde o início (sem ter
  adicionado nada antes), chame add_pizza_to_cart UMA vez com
  flavor_ids=[id_X, id_Y]. Não pergunte qual sabor "vem primeiro" ou
  qual é "mais importante" — a ordem em flavor_ids não tem efeito
  prático no preço quando há preço fechado.{flat_price_block}
- Use as funções disponíveis — NÃO invente preços ou IDs.
- IDs DE PRODUTO (regra dura): cada item do CARDÁPIO acima começa com
  `[id:N]`. Esse N é o ÚNICO valor válido para flavor_ids / product_id.
  NUNCA invente, NUNCA chute, NUNCA reaproveite IDs de outros produtos.
  Se o cliente pedir "Frango com Cheddar", procure literalmente
  "Frango com Cheddar" no cardápio acima e use o `[id:N]` que está ANTES
  do nome dele. Errar o ID faz o sistema cobrar uma pizza errada — bug
  grave que já gerou reclamação real (pedido com sabor trocado e cobrança
  duplicada). Se você não achar o sabor exato no cardápio, chame
  ask_clarification em vez de chutar um ID parecido.
- ENDEREÇO DE ENTREGA — REGRA DURA. Você PRECISA dos 3 dados: NOME DA
  RUA, NÚMERO DA CASA, BAIRRO (referência é opcional, sempre vale a
  pena pedir). Se o cliente mandar só o bairro (ex: "Eldorado") OU só
  o nome da rua sem número OU disser "sem número / s/n", você NÃO
  chama set_delivery_address — chama ask_clarification e pergunta o
  que está faltando. Exemplos:
    Cliente: "É no bairro Eldorado" → você pergunta: "Beleza! Pra
       calcular certinho, me passa a rua e o número da casa? E se
       tiver um ponto de referência (algo perto), me conta também 😊"
    Cliente: "Rua das Flores, sem número" → você pergunta: "Preciso do
       número da casa pra fazer a entrega chegar certa — qual é?"
  NUNCA invente uma rua ou um número pra satisfazer o sistema.
  Chamar set_delivery_address sem rua + número faz o cálculo de taxa
  sair errado (já aconteceu — bug real que o operador reclamou).

- NUNCA decida "não entregamos nesse bairro" DE CABEÇA. A única forma
  válida de afirmar que um endereço está fora da área é depois de você
  ter chamado set_delivery_address com rua + número + bairro reais e
  o sistema ter respondido com out_of_zone ou "não encontrado". Memória
  da conversa NÃO conta — mesmo que você tenha dito antes que não
  atendemos um bairro, se o cliente mandar o endereço de novo (mesmo
  que pareça igual), CHAME set_delivery_address de novo e deixe o
  sistema decidir. As faixas de entrega são por DISTÂNCIA em km, não
  por nome de bairro — você não tem como saber a distância sem
  chamar a função. Se o cliente reclama dizendo "mas você disse que
  não entrega aqui", peça o endereço completo (rua + número) de novo
  e chame set_delivery_address — pode ser que da última vez tenha
  faltado o número e por isso o cálculo deu errado.
- Depois que set_delivery_address aceitar o endereço completo, o sistema
  retorna a taxa real e o tempo estimado — repita pro cliente.
- ORDEM DAS PERGUNTAS (não inverta): primeiro confirme o(s) item(ns) e
  adicione ao carrinho, DEPOIS peça o endereço completo (rua + número
  + bairro + referência), DEPOIS pergunte a forma de pagamento.
  SÓ pergunte sobre TROCO depois que o cliente já confirmou DINHEIRO.
  NÃO pergunte "precisa de troco?" antes do cliente escolher dinheiro
  — isso confunde e o sistema também vai bloquear a chamada.
- Antes de confirmar, mostre o resumo completo e peça confirmação explícita.
- Se o cliente xingar, reclamar muito, ou pedir falar com outra pessoa, chame request_human_handoff.
- Se o bairro não for atendido, avise que não entregamos lá e ofereça retirada.

RESUMO E TOTAL — REGRA ABSOLUTA (não quebre por nada):
- O bloco CARRINHO acima já traz os números EXATOS calculados pelo sistema
  (subtotal, taxa de entrega, TOTAL FECHADO). Use esses valores LITERALMENTE
  na sua resposta — nunca recalcule, nunca arredonde, nunca invente.

- O TOTAL FECHADO NÃO PODE MUDAR entre o resumo e a confirmação. Se você
  mostrou R$ 105,00 no resumo, o cliente vai confirmar pra fechar em
  R$ 105,00. Cobrar valor diferente depois quebra a confiança e o cliente
  cancela. Se algo mudar de fato (cliente pediu mais um item, mudou
  borda, mudou endereço), monte um NOVO resumo e peça nova confirmação
  ANTES de chamar confirm_order.

- Quando esclarecimentos não mudam o pedido (ex: cliente disse "cartão"
  e você precisa saber se é crédito ou débito), apenas chame
  set_payment_method com o valor correto e responda CONFIRMANDO o mesmo
  total já mostrado, sem recalcular nem mostrar resumo de novo. Exemplo:
  "Show, cartão de crédito anotado. Total continua R$ 105,00, posso
  confirmar?".

- O resumo final que você manda pro cliente DEVE ser detalhado, item por
  item, com preço unitário e total da linha, depois subtotal, taxa de
  entrega (separada), e TOTAL no final em destaque. Nunca mostre só o
  total acumulado.

  Modelo do resumo (adapte o tom mas mantenha a estrutura):

      Tá quase saindo, dá uma conferida 😊

      • 1× Pizza Grande meia Calabresa Super / meia Chocolate
        com cebola e requeijão (cortesia), borda de cheddar — R$ 84,00
      • 1× Coca-Cola 2L — R$ 14,00

      Subtotal: R$ 98,00
      Taxa de entrega (Eldorado): R$ 7,00
      *Total: R$ 105,00*

      Endereço: Av Tanabi, 3690 — Eldorado (casa de esquina com Av Valentin Gentil)
      Pagamento: cartão na entrega

      Posso confirmar?

  Se faltar algum dado (endereço, pagamento), pergunte ANTES de mostrar
  o resumo final — o resumo só sai quando o pedido está pronto pra fechar.

  REGRA OBRIGATÓRIA antes de QUALQUER resumo: o bloco CARRINHO logo acima
  DEVE ter pelo menos um item. Se está vazio, você ESQUECEU de chamar
  add_pizza_to_cart — chame agora com os dados que o cliente já passou,
  SEM pedir desculpa. NUNCA escreva "Vou te passar o resumo", "1× Pizza...",
  "Total: R$..." ou "Posso confirmar?" antes do CARRINHO ter conteúdo real.
  Resumos descritos a partir da memória da conversa SÃO BUGS — eles fazem
  o cliente confirmar um pedido que não existe.

- Cobrar a borda recheada / adicional pago: o sistema já adiciona o
  preço dela ao item no momento do add_pizza_to_cart. NUNCA some um
  valor "extra de borda" por fora — o TOTAL FECHADO já contempla.

- Cobrar entrega: o sistema seta cart.delivery_fee quando o endereço é
  registrado em set_delivery_address. Use o número do bloco CARRINHO
  acima (Taxa de entrega), não invente nem some por fora.

ATENDIMENTO RÁPIDO (regra de ouro — minimize perguntas, maximize captura):
- O cliente está com fome e com pressa. SEMPRE que possível, capture várias
  informações em uma só pergunta e extraia várias informações de uma só
  resposta. NÃO faça uma pergunta por vez quando dá pra perguntar tudo junto.

- TURNO INICIAL (logo depois de "{cfg.greeting}", quando o cliente ainda
  não disse o que quer):
  Faça UMA pergunta consolidada listando o que precisamos pra montar o pedido.
  Curta, amigável, em uma mensagem só. Exemplo:

      "Pra adiantar seu pedido, me conta tudo numa mensagem só? 🍕
       • Sabor (ou meio-a-meio)
       • Tamanho ({sizes_label})
       • Entrega ou retirada? Se entrega, qual bairro?
       • Forma de pagamento (PIX, cartão, dinheiro)
       Se preferir, posso te sugerir as mais pedidas."

  Adapte o tom à situação (recorrente, fora de horário, etc.) — não cole o
  exemplo literal. Se o cliente já mandou parte das informações no primeiro
  turno, NÃO pergunte de novo o que ele já respondeu.

- EXTRAÇÃO MULTI-FATO: quando o cliente mandar uma mensagem com várias
  informações ("uma calabresa grande pra retirada, pago com pix"), extraia
  TODAS de uma vez:
    * sabor + tamanho → add_pizza_to_cart
    * "retirada"/"buscar" → set_pickup
    * bairro/endereço → set_delivery_address
    * "pix"/"cartão"/"dinheiro" → set_payment_method
  Depois disso, na MESMA resposta, peça SOMENTE o que ainda falta — nada
  mais. Se está tudo preenchido, vá direto pro resumo + confirmação.

- INTERPRETAÇÃO INTELIGENTE: se o cliente disser algo curto e ambíguo
  ("queria uma pizza", "manda uma calabresa"), assuma o caminho mais comum
  e PROPONHA explicitamente em vez de bombardear com 4 perguntas separadas.
  Exemplo: "Beleza! Calabresa grande sai por R$ XX, ou prefere média?
  E é pra entrega ou retirada?" — duas decisões, uma frase.

- SUGESTÕES PROATIVAS (só uma vez por pedido, sem insistir):
  Quando o cliente adicionar a primeira pizza com sucesso, sugira UMA das:
    * uma bebida (ex.: "Quer uma Coca 2L pra acompanhar? 🥤")
    * uma sobremesa (ex.: "Topa uma pizza doce pra fechar? 🍫")
    * borda recheada (ex.: "Borda recheada de catupiry vai bem com essa")
  Escolha a mais natural pro contexto. Se o cliente recusar, NÃO ofereça de novo.

- PIZZA POPULAR / RECOMENDAÇÃO: se o cliente pedir sugestão ou estiver
  indeciso, indique 2-3 opções rápidas em uma frase ("As mais pedidas hoje
  são Calabresa, Portuguesa e Frango com Catupiry") em vez de listar tudo.

- ECONOMIA DE TURNOS: nunca termine uma resposta com uma única pergunta
  pequena se ainda faltam várias coisas — agrupe. Ex.: em vez de só "Qual
  o tamanho?", diga "Tamanho? E é pra entrega ou retirada?".

- NÃO FAÇA RESUMO LONGO REPETINDO O QUE JÁ FOI DITO. Confirme só o que
  agregou valor (ex.: "Beleza, anotei: calabresa G, retirada, PIX. Pode
  confirmar?"). Frases curtas, sem listas pesadas.

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

CARDÁPIO COM IMAGEM (REGRA DURA — não falhe nessa):
- SEMPRE que o cliente sinalizar que quer ver o cardápio / o menu / os sabores /
  as opções, você OBRIGATORIAMENTE precisa CHAMAR a função send_menu_image
  ANTES de mandar qualquer texto. Não basta escrever "vou te mandar o cardápio",
  você TEM que executar a tool — escrever a frase sem chamar a tool faz o
  cliente NÃO receber a imagem e quebra a confiança.

- Disparadores (lista NÃO exaustiva — interprete pelo sentido, não literalmente):
    * "manda o cardápio", "manda o menu", "envia o menu", "manda as opções"
    * "tem cardápio?", "qual o cardápio?", "que sabores tem?", "quais sabores?"
    * "quero ver as pizzas", "quero ver o menu", "vamos começar pelo menu",
      "começa pelo menu", "começar pelo cardápio"
    * "show me menu", "send menu", "menu por favor" (cliente pode escrever em
      qualquer língua — interprete o sentido)
    * Qualquer frase que peça PRA VER as opções, mesmo indireta (ex.: "o que
      vocês têm?", "me mostra os sabores")
    * BORDAS: "quais bordas vocês têm?", "tem borda recheada?", "qual o sabor
      da borda?", "quanto custa a borda?", "borda doce também?", "manda os
      sabores de borda", "tem catupiry/cheddar/chocolate na borda?" —
      qualquer pergunta SOBRE A BORDA dispara send_menu_image(category="borda").

- COMO ESCOLHER A CATEGORIA:
    * cardápio em geral, "manda as pizzas", "quero ver o menu" SEM
      especificar salgada vs doce → category="pizzas" (o backend manda
      AUTOMATICAMENTE as duas imagens — salgadas + doces — em sequência).
    * cliente DEIXOU CLARO que quer só salgada ("tem alguma salgada
      diferente?", "manda as salgadas") → category="salgada"
    * cliente DEIXOU CLARO que quer só doce ("tem pizza doce?",
      "quero ver as doces") → category="doce"
    * sorvete → category="sorvete"
    * bebida → category="bebida"
    * borda recheada / sabores de borda → category="borda"
    * Quando ambíguo (e não é pergunta sobre borda/sorvete/bebida), use
      "pizzas" — manda as duas e cobre os dois interesses. Não pergunte.

- DEPOIS de chamar send_menu_image com sucesso, mande UMA frase curta no chat:
  "Manda aí, ó 👇" / "Esses são nossos sabores 🍕" / "Tá aí 👆" — NUNCA repita
  o cardápio em texto. NUNCA escreva "vou te mandar o cardápio" antes da tool;
  só escreva DEPOIS que a tool retornou OK.

- Se send_menu_image retornar INDISPONÍVEL (categoria sem imagem), aí sim
  recue para texto: liste 3-4 opções da categoria e pergunte o que o cliente
  quer. Não fale que enviaria imagem.

- Se send_menu_image retornar FALHA (erro técnico), peça desculpas e liste
  3-4 opções em texto; NÃO repita a tentativa.
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
            cart_size_before = len(cart.get("items", []))
            log.info(
                "add_pizza_to_cart phone=%s flavor_ids=%s size=%s crust=%s extras=%s qty=%s sem_massa=%s cart_size_before=%d",
                phone, args.get("flavor_ids"), args.get("size"), args.get("crust"),
                args.get("extras"), args.get("quantity", 1),
                bool(args.get("sem_massa", False)), cart_size_before,
            )

            # Defensive auto-correction for the silent-doubling bug. When
            # the LLM calls this with two flavor_ids (a meio-a-meio) and
            # the cart's existing non-delivery items are EXACTLY those
            # two flavors as separate single-flavor pizzas, drop them
            # before adding the meio-a-meio. Matches the exact pattern
            # that caused a R$ 110 charge for a R$ 55 pizza (two
            # add_pizza_to_cart calls for whole pizzas followed by the
            # customer saying "é meio a meio uma pizza só"). Conservative
            # match — only fires when the existing pizza items are
            # *exactly* the two flavors being meio-a-meio'd, with no
            # other items in flight.
            requested_flavor_ids = args.get("flavor_ids") or []
            if len(requested_flavor_ids) == 2 and cart.get("items"):
                non_delivery = [
                    it for it in cart["items"] if not it.get("is_delivery_fee")
                ]
                existing_pids = sorted(
                    it.get("product_id") for it in non_delivery
                    if it.get("product_id") is not None
                )
                requested_sorted = sorted(int(x) for x in requested_flavor_ids)
                if existing_pids == requested_sorted:
                    log.info(
                        "auto-removed %d stale single-flavor items for %s — "
                        "customer corrected to meio-a-meio %s",
                        len(non_delivery), phone, requested_sorted,
                    )
                    cart["items"] = [
                        it for it in cart["items"] if it.get("is_delivery_fee")
                    ]
                    cart_size_before = 0

            item = await order_builder.add_pizza(
                db,
                cart,
                flavor_ids=args["flavor_ids"],
                size=args["size"],
                crust=args.get("crust"),
                extras=args.get("extras"),
                quantity=args.get("quantity", 1),
                sem_massa=bool(args.get("sem_massa", False)),
            )
            state["state"] = "building_order"
            base = f"OK — adicionado: {item['description']} R$ {item['unit_price']:.2f}"
            # Catch the silent-doubling bug: when the cart already had items,
            # remind the model to verify intent and remove duplicates. The
            # last incident had GPT calling add_pizza_to_cart twice with the
            # same wrong flavor_ids, charging the customer R$ 120 for one
            # pizza instead of R$ 60.
            if cart_size_before > 0:
                base += (
                    f" — ATENÇÃO: o carrinho agora tem {cart_size_before + 1} item(ns). "
                    "Se você queria CORRIGIR o item anterior (não adicionar um novo), "
                    "chame remove_from_cart(index=...) AGORA pra tirar o duplicado, "
                    "ANTES de mostrar qualquer resumo. Confira o bloco CARRINHO no "
                    "próximo turno antes de falar com o cliente."
                )
            return base

        if name == "add_simple_product_to_cart":
            cart_size_before = len(cart.get("items", []))
            log.info(
                "add_simple_product_to_cart phone=%s product_id=%s qty=%s cart_size_before=%d",
                phone, args.get("product_id"), args.get("quantity", 1), cart_size_before,
            )
            item = await order_builder.add_simple_product(
                db, cart, product_id=args["product_id"], quantity=args.get("quantity", 1)
            )
            state["state"] = "building_order"
            base = f"OK — adicionado: {item['description']} R$ {item['unit_price']:.2f}"
            if cart_size_before > 0:
                base += (
                    f" — ATENÇÃO: carrinho com {cart_size_before + 1} item(ns). "
                    "Se foi correção, chame remove_from_cart antes de mostrar resumo."
                )
            return base

        if name == "remove_from_cart":
            order_builder.remove_item(cart, args["index"] - 1)
            return "OK — item removido"

        if name == "set_delivery_address":
            # Refuse garbage inputs at the boundary. The LLM has been
            # known to call this tool with placeholder street/number
            # values (or with just the neighborhood and "sem número")
            # to satisfy the required-field schema — Google then
            # geocodes the neighborhood centroid and we charge whatever
            # band that centroid happens to fall in. Validate every
            # field aggressively here so the only way through is real
            # data the customer actually provided.
            street_raw = (args.get("street") or "").strip()
            number_raw = (args.get("number") or "").strip()
            neighborhood_raw = (args.get("neighborhood") or "").strip()
            if len(street_raw) < 3 or street_raw.lower() in {
                "sem rua", "n/a", "sem", "nao sei", "não sei",
            }:
                return (
                    "BLOQUEADO: nome da rua ausente ou inválido "
                    f"('{street_raw}'). Use ask_clarification para "
                    "pedir o NOME COMPLETO da rua antes de tentar de novo. "
                    "NÃO invente."
                )
            digits = "".join(ch for ch in number_raw if ch.isdigit())
            if (
                not number_raw
                or not digits
                or digits == "0"
                or number_raw.lower() in {"sn", "s/n", "s n", "sem numero", "sem número", "n/a"}
            ):
                return (
                    "BLOQUEADO: número da casa ausente ou inválido "
                    f"('{number_raw}'). Use ask_clarification para "
                    "pedir o NÚMERO DA CASA antes de tentar de novo. "
                    "'sem número' / 's/n' não são aceitos — peça o número "
                    "literal."
                )
            if len(neighborhood_raw) < 2:
                return (
                    "BLOQUEADO: bairro ausente. Use ask_clarification "
                    "para pedir o nome do bairro."
                )
            addr = f"{street_raw}, {number_raw}"
            if args.get("complement"):
                addr += f" ({args['complement']})"
            # Route through resolve_delivery_fee — when bot_config has
            # delivery_by_distance=true and pizzaria_lat/lng set, this
            # geocodes the address (Nominatim, cached) and looks up the
            # km band; otherwise falls back to neighbourhood-name match.
            #
            # If the cart already has GPS coords (customer sent a WhatsApp
            # location pin earlier in this conversation), pass them
            # through so we skip Nominatim's address→coord step entirely
            # — the pin is accurate to ~5m, Nominatim only to ~50m. The
            # Google Distance Matrix call inside resolve_delivery_fee
            # then computes road distance from these precise coords.
            zone = await delivery_svc.resolve_delivery_fee(
                db,
                street=args.get("street"),
                number=args.get("number"),
                neighborhood=args.get("neighborhood"),
                customer_lat=cart.get("delivery_lat"),
                customer_lng=cart.get("delivery_lng"),
            )
            if not zone:
                return (
                    f"bairro '{args['neighborhood']}' não encontrado ou fora da área. "
                    "Diga ao cliente que não atendemos esse bairro e ofereça retirada."
                )
            if zone.get("out_of_zone"):
                return (
                    f"endereço fora da área de entrega "
                    f"(distância calculada: {zone.get('distance_km')}km, "
                    "além da última faixa cadastrada). Diga ao cliente "
                    "que não conseguimos entregar tão longe e ofereça retirada."
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
            # Hard guard against the silent-summary bug: if the LLM has been
            # describing the order in text without ever calling
            # add_pizza_to_cart, the cart is empty here. Refuse to send the
            # "Mostre o resumo" instruction and force a recovery first.
            if not cart.get("items"):
                return (
                    "ERRO — o CARRINHO está VAZIO mas você está prestes a "
                    "pedir confirmação. Você esqueceu de chamar add_pizza_to_cart. "
                    "Olhe o histórico da conversa, identifique sabor + tamanho + "
                    "borda + adicionais que o cliente já confirmou e CHAME "
                    "add_pizza_to_cart agora com esses dados. NÃO peça desculpa, "
                    "NÃO peça pro cliente repetir — apenas adicione e siga adiante."
                )
            if args["method"] == "cash":
                # Nudge GPT to ask about change BEFORE letting it confirm.
                return (
                    "OK — pagamento: dinheiro. ANTES de confirmar, pergunte ao cliente "
                    "'precisa de troco pra quanto?' e quando ele responder chame "
                    "set_change_for. Só DEPOIS mostre o resumo e peça confirmação."
                )
            return f"OK — pagamento: {args['method']}. Mostre o resumo e peça confirmação."

        if name == "confirm_order":
            # Same guard: if the LLM tries to confirm without items in the
            # cart, don't bubble a vague "Carrinho vazio" up. Tell the LLM
            # exactly what to do — re-extract from history + add_pizza_to_cart,
            # not apologize-and-restart.
            if not cart.get("items"):
                log.warning("confirm_order with empty cart for %s — forcing recovery", phone)
                return (
                    "ERRO — você chamou confirm_order com o CARRINHO VAZIO. "
                    "Isso significa que você esqueceu de chamar add_pizza_to_cart "
                    "(e/ou add_simple_product_to_cart) em algum momento anterior. "
                    "RECUPERE AGORA: olhe o histórico da conversa, identifique "
                    "TODOS os itens que o cliente já confirmou (sabor + tamanho + "
                    "borda + adicionais), chame add_pizza_to_cart pra cada um, e "
                    "depois chame confirm_order DE NOVO. NÃO peça desculpa, NÃO "
                    "fale 'houve um probleminha', NÃO peça pro cliente repetir."
                )
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
            # Precondition gate: troco only makes sense when the customer
            # has already picked cash as payment. The LLM has been calling
            # this tool before the bill was shown — producing the bizarre
            # "precisa de troco?" question at the top of the conversation.
            # Refuse with a corrective instruction instead of silently
            # accepting.
            pm = cart.get("payment_method")
            if pm != "cash":
                return (
                    "BLOQUEADO: set_change_for só pode ser chamado depois "
                    f"que o cliente já escolheu DINHEIRO como pagamento "
                    f"(atualmente: {pm or 'nenhuma forma definida'}). "
                    "Volte ao fluxo: monte o pedido, depois pergunte "
                    "endereço, depois pergunte forma de pagamento. Se o "
                    "cliente escolher dinheiro, AÍ pergunte sobre troco."
                )
            if not cart.get("items"):
                return (
                    "BLOQUEADO: set_change_for chamado com o carrinho vazio. "
                    "Antes de troco, adicione os itens com add_pizza_to_cart "
                    "e defina o endereço."
                )
            try:
                amount = float(args.get("amount") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            amount = round(max(0.0, amount), 2)
            _sub, _fee, total = order_builder.cart_totals(cart)
            total = round(float(total), 2)
            fmt_total = f"R$ {total:.2f}".replace(".", ",")

            # Shortfall: customer's cash is positive but less than the
            # total. That's NOT troco — it's dinheiro insuficiente.
            # The 0.01 cushion absorbs float rounding noise (R$ 119,99
            # vs 120,00 is exact, not short).
            if amount > 0 and amount < total - 0.01:
                shortfall = round(total - amount, 2)
                fmt_amount = f"R$ {amount:.2f}".replace(".", ",")
                fmt_short = f"R$ {shortfall:.2f}".replace(".", ",")
                return (
                    f"BLOQUEADO: o cliente disse que vai pagar com {fmt_amount} "
                    f"em dinheiro, mas o total do pedido é {fmt_total} — "
                    f"faltam {fmt_short}. Isso NÃO é troco, é dinheiro "
                    "INSUFICIENTE. Avise o cliente com tom amigável que "
                    f"o valor está abaixo do total e pergunte: (a) se ele "
                    "quer pagar com uma nota maior em dinheiro (e o "
                    "motoboy leva o troco) ou (b) completar a diferença "
                    "com PIX/cartão na entrega. NÃO chame confirm_order "
                    "enquanto isso não estiver resolvido."
                )

            # Exact payment: customer named an amount within rounding
            # distance of the total. No change needed — record as 0 so
            # the motoboy ticket reads "paga exato" rather than the
            # confusing "troco de R$ 0,00".
            if amount > 0 and amount <= total + 0.01:
                cart["change_for"] = 0.0
                return (
                    f"OK — registrado: cliente paga o valor exato ({fmt_total} "
                    "sem troco). Mostre o resumo e peça confirmação."
                )

            cart["change_for"] = amount
            if amount > 0:
                change = round(amount - total, 2)
                fmt_amount = f"R$ {amount:.2f}".replace(".", ",")
                fmt_change = f"R$ {change:.2f}".replace(".", ",")
                return (
                    f"OK — registrado: cliente vai pagar com {fmt_amount} "
                    f"em dinheiro, troco de {fmt_change}. Agora mostre o "
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

            # Pseudo-category "pizzas" expands to BOTH the salgada and the
            # doce images sent back-to-back. The LLM uses this when the
            # customer asked for the menu generically (no "doce" /
            # "salgada" word) — covers both interests in one shot instead
            # of asking the customer "salgada or doce?" first.
            if category == "pizzas":
                bundle = [
                    ("salgada", menu_images.get("salgada")),
                    ("doce", menu_images.get("doce")),
                ]
                available = [(c, u) for c, u in bundle if u]
                if not available:
                    return (
                        "INDISPONÍVEL: nenhuma imagem de pizza (salgada/doce) "
                        "cadastrada. Liste as opções em texto pro cliente — "
                        "3-4 sugestões salgadas + 1-2 doces — e pergunte o "
                        "que ele quer."
                    )
                sent_categories: list[str] = []
                last_url: Optional[str] = None
                last_err: Optional[str] = None
                for sub_cat, sub_url in available:
                    try:
                        await _send_one_menu_image(
                            db=db, state=state, phone=phone,
                            category=sub_cat, url=sub_url,
                        )
                        sent_categories.append(sub_cat)
                        last_url = sub_url
                    except Exception as sub_err:
                        log.exception("send_menu_image(pizzas) sub-send failed: %s", sub_cat)
                        last_err = str(sub_err)
                if not sent_categories:
                    return (
                        f"FALHA: não consegui enviar nenhuma imagem ({last_err}). "
                        "Continue em texto: liste 3-4 sabores salgados e 1-2 "
                        "doces e pergunte o que o cliente quer."
                    )
                state["_last_bot_media"] = {"url": last_url, "type": "image"}
                if len(sent_categories) == 2:
                    return (
                        "OK — enviei as DUAS imagens (pizzas salgadas + doces) "
                        "pelo WhatsApp. Mande UMA frase curta no chat tipo "
                        "'Esses são nossos sabores 🍕👆 Manda aí o que quer!' "
                        "ou 'Tá aí 👆 — qual te chamou atenção?'. NÃO repita "
                        "o cardápio em texto."
                    )
                only = sent_categories[0]
                return (
                    f"OK — enviei só a imagem de pizzas {only} (a outra "
                    f"categoria não tem imagem cadastrada). Mande UMA frase "
                    "curta tipo 'Tá aí 👆' e ofereça as outras opções em "
                    "texto se fizer sentido."
                )

            url = menu_images.get(category)
            if not url:
                return (
                    f"INDISPONÍVEL: não há imagem cadastrada para a categoria "
                    f"'{category}'. Liste as opções em texto pro cliente, oferecendo "
                    "3-4 sugestões e perguntando o que ele quer."
                )
            try:
                await _send_one_menu_image(
                    db=db, state=state, phone=phone,
                    category=category, url=url,
                )
                state["_last_bot_media"] = {"url": url, "type": "image"}
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
    push_name: Optional[str] = None,
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

    # Admin phone guard — when the pizzaria owner / operator (whose number
    # is in ADMIN_PHONES) WhatsApps the bot, never treat them as a customer.
    # Otherwise the bot would greet them with the ordering flow and try to
    # build a cart for them, which is confusing at best and creates fake
    # orders at worst (the owner's number IS sometimes used for testing).
    # We still persist the message so the chat viewer shows it; the bot just
    # doesn't reply. The admin can then read the chat in /admin/conversations,
    # use the bot simulator at /admin/settings/bot for test ordering, or
    # reply manually from the panel.
    if _is_admin_phone(phone):
        log.info("admin phone %s sent inbound — skipping bot processing", phone)
        await _persist_message(
            db, phone=phone, customer_id=state.get("customer_id"),
            role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
        )
        return None

    if state.get("state") == "human_takeover":
        # Still record inbound so admin can see it
        await _persist_message(
            db, phone=phone, customer_id=state.get("customer_id"),
            role=MessageRole.user, content=text, is_audio=is_audio,
            media_url=media_url, media_type=media_type,
        )
        return None

    # Lazy ensure customer row + pull returning-customer context
    customer = await customer_service.find_or_create_by_phone(
        db, phone, push_name=push_name,
    )
    state["customer_id"] = customer.id
    if customer.name and not state.get("customer_name"):
        state["customer_name"] = customer.name

    # Persist + broadcast the inbound message IMMEDIATELY so the admin
    # Conversas page shows the customer's text without waiting for the
    # bot's full LLM round-trip (which can take 5-10s and was visibly
    # lagging the admin UI). Every early-return path below now only
    # needs to persist its assistant reply — _persist_message also
    # broadcasts via the live websocket, so the admin viewer repaints
    # the moment the row hits the DB.
    await _persist_message(
        db, phone=phone, customer_id=customer.id,
        role=MessageRole.user, content=text, is_audio=is_audio,
        media_url=media_url, media_type=media_type,
    )

    # ---------- Redirect mode ----------
    # While settings.bot_redirect_enabled is true, real customer traffic
    # gets a fixed "talk to us at the other number" reply and the LLM is
    # bypassed entirely. Per-phone testing escape hatch: the first message
    # starting with "bot" sets state["test_mode"] = True and is processed
    # normally; every subsequent message from that phone bypasses the
    # redirect for the rest of the conversation (until state TTL expires
    # at 30 min idle). Requiring "bot" on every single message was the
    # original behavior — bad UX, fixed 2026-05-21 after testing showed
    # it was unusable.
    if settings.bot_redirect_enabled and not state.get("test_mode"):
        m = _BOT_KEYWORD_RE.match(text or "")
        if m:
            stripped = (m.group(1) or "").strip()
            # Plain "bot" with no payload → treat as "oi" so the greeting
            # fast-path can fire and the tester gets an instant response.
            text = stripped or "oi"
            state["test_mode"] = True
            # Persist the flag immediately — if the LLM call below errors
            # out, we still want the next message from this tester to
            # bypass the redirect.
            await state_svc.set_state(phone, state)
        else:
            # User message was already persisted+broadcast above.
            await _persist_message(
                db, phone=phone, customer_id=customer.id,
                role=MessageRole.assistant, content=_BOT_REDIRECT_MESSAGE,
            )
            log.info("redirect mode: replied to %s with redirect message", phone)
            return _BOT_REDIRECT_MESSAGE

    # ---------- Greeting fast-path ----------
    # Most first messages are a single word "Ola" / "Oi" / "Bom dia" and the
    # LLM always answers with a near-identical Bia greeting. Skip the 5-9s
    # OpenAI round trip for that one case. Only fires when the conversation
    # is truly fresh and the pizzaria is open; otherwise we fall through so
    # closed-hours / mid-order / handoff logic keeps working as before.
    _cfg_for_greeting = await _get_bot_config(db)
    if _is_open_now(_cfg_for_greeting, _local_now()):
        fast_reply = _try_greeting_fast_path(
            text, state, state.get("customer_name"), is_open=True,
        )
        if fast_reply:
            state["context_messages"] = [
                {"role": "user", "content": text},
                {"role": "assistant", "content": fast_reply},
            ]
            await state_svc.set_state(phone, state)
            # User message was already persisted+broadcast above.
            await _persist_message(
                db, phone=phone, customer_id=customer.id,
                role=MessageRole.assistant, content=fast_reply,
            )
            try:
                from app.services.websocket import manager
                await manager.broadcast(
                    "chat_message",
                    {"phone": phone, "role": "assistant", "content": fast_reply, "is_audio": False},
                )
            except Exception:
                pass
            log.info("greeting fast-path fired for %s — saved an LLM call", phone)
            return fast_reply

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
        # User message was already persisted+broadcast above.
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=polite,
        )
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
        # User message was already persisted+broadcast above.
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=cfg.privacy_notice,
        )
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
        # User message was already persisted+broadcast above.
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=polite,
        )
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

    # Phase-level timing for latency forensics. Each tN is monotonic
    # perf_counter time relative to t_start; we log a single structured
    # line at the end so a slow reply can be triaged in one grep.
    t_start = time.perf_counter()
    system_prompt = await _build_system_prompt(db, state)
    t_prompt = time.perf_counter()

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
        # User message was already persisted+broadcast above.
        await _persist_message(
            db, phone=phone, customer_id=customer.id,
            role=MessageRole.assistant, content=polite,
        )
        try:
            from app.services.websocket import manager
            await manager.broadcast(
                "chat_message",
                {"phone": phone, "role": "assistant", "content": polite, "is_audio": False},
            )
        except Exception:
            pass
        return polite

    try:
        response = await _openai().chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            tools=TOOLS,
            temperature=0.5,
            max_tokens=700,
        )
    except Exception:
        log.exception("OpenAI call failed")
        return "Ih, tive um probleminha aqui. Pode repetir?"
    t_llm1 = time.perf_counter()

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
    t_tools = time.perf_counter()

    # If there were tool calls, ask GPT for the user-facing reply using the tool results.
    # Shortcut: when the *only* tool fired was send_menu_image, we already know
    # the desired follow-up is a one-liner pointing at the image just sent.
    # Skip the synthesis LLM call entirely — saves ~2s per menu request and the
    # caption is fully predictable anyway.
    skipped_llm2 = False
    only_menu_image = (
        len(msg.tool_calls or []) == 1
        and msg.tool_calls[0].function.name == "send_menu_image"
        and isinstance(tool_msgs[0].get("content"), str)
        and tool_msgs[0]["content"].startswith("OK")
    ) if tool_msgs else False

    if only_menu_image:
        reply = random.choice((
            "Esses são nossos sabores 🍕 Manda aí, o que você quer?",
            "Aqui ó 👇 Pode escolher e me dizer qual te interessa 😊",
            "Esses são os sabores que temos hoje 🍕 Qual vai ser?",
        ))
        skipped_llm2 = True
    elif tool_msgs:
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
                model=CHAT_MODEL,
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
    t_llm2 = time.perf_counter()
    if skipped_llm2:
        log.info("llm2 skipped — send_menu_image fast caption used for %s", phone)

    log.info(
        "process_incoming timing phone=%s prompt=%.2fs llm1=%.2fs tools=%.2fs llm2=%.2fs total=%.2fs n_tools=%d",
        phone,
        t_prompt - t_start,
        t_llm1 - t_prompt,
        t_tools - t_llm1,
        t_llm2 - t_tools,
        t_llm2 - t_start,
        len(tool_msgs),
    )

    # Persist context + state
    context.append({"role": "user", "content": text})
    context.append({"role": "assistant", "content": reply})
    state["context_messages"] = context[-20:]
    await state_svc.set_state(phone, state)

    # Persistent chat history (DB). The inbound user row was already
    # persisted+broadcast at the top of process_incoming so the admin
    # UI updated immediately; here we just record the bot's reply.
    if reply:
        await _persist_message(
            db, phone=phone, customer_id=state.get("customer_id"),
            role=MessageRole.assistant, content=reply,
        )

    return reply.strip() or None

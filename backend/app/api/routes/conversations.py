"""Conversation viewer API for the admin panel."""
import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import redis.asyncio as redis
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.conversation_message import ConversationMessage, MessageRole
from app.models.customer import Customer
from app.services import conversation_state as state_svc
from app.services import handoff as handoff_svc
from app.services.chat_media import save_chat_media
from app.services.whatsapp import client as wa_client

# Cap operator-uploaded media. Images come from the panel's file picker
# (or PWA camera capture); audio comes from a 30-60 s MediaRecorder blob.
MAX_MEDIA_BYTES = 16 * 1024 * 1024  # 16 MB

router = APIRouter(dependencies=[Depends(get_current_user)])


class ActiveConversation(BaseModel):
    phone: str
    state: str
    cart_items: int
    customer_name: Optional[str] = None
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None
    is_human_takeover: bool


class ConversationMessageOut(BaseModel):
    id: int
    role: str
    content: str
    is_audio: bool
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    created_at: datetime
    # Meta delivery status for outbound messages, populated by the webhook
    # status handler. One of: 'sent', 'delivered', 'read', 'failed', or
    # None for inbound rows and outbound rows that never finished sending.
    delivery_status: Optional[str] = None


class SendMessagePayload(BaseModel):
    content: str


class StaleConversation(BaseModel):
    phone: str
    state: str
    customer_name: Optional[str] = None
    cart_items: int
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    idle_minutes: float
    cancellation_reason: Optional[str] = None
    handoff_reason: Optional[str] = None
    nudged_at: Optional[str] = None


@router.get("/stale", response_model=List[StaleConversation])
async def list_stale(
    since_minutes: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Cold/abandoned conversations the operator should look at.

    Returns conversations whose last persisted message is older than
    `since_minutes` AND state is mid-order (building_order, collecting_*,
    confirming, human_takeover). Surfaces:

      - phone + last preview + idle minutes
      - cart_items count (so operator knows whether there was a real
        order in flight)
      - cancellation_reason / handoff_reason from Redis state when the
        conversation was already auto-escalated by the bot
      - nudged_at to indicate the scheduler already pinged this one

    Powers the "Conversas Frias" admin view — operator scans the list
    each shift and rescues any with cart items > 0 by calling the
    customer directly on (17) 3237-1112 / WhatsApp Business.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=since_minutes)
    rc = state_svc._client()
    out: list[StaleConversation] = []
    mid_states = {
        "building_order", "collecting_address", "collecting_payment",
        "confirming", "human_takeover",
    }
    seen_phones: set[str] = set()
    async for key in rc.scan_iter(match="conv:*", count=200):
        phone = key.split(":", 1)[1] if isinstance(key, str) else key.decode().split(":", 1)[1]
        if phone in seen_phones:
            continue
        seen_phones.add(phone)
        try:
            state = await state_svc.get_state(phone)
        except Exception:
            continue
        if state.get("state") not in mid_states:
            continue
        # Fetch last message
        last = (
            await db.execute(
                select(ConversationMessage)
                .where(ConversationMessage.phone == phone)
                .order_by(ConversationMessage.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if last is None or last.created_at > cutoff:
            continue

        cust = (
            await db.execute(
                select(Customer.name).where(Customer.phone == phone)
            )
        ).scalar_one_or_none()
        idle_min = (datetime.now(timezone.utc) - last.created_at).total_seconds() / 60.0
        cart = state.get("cart") or {}
        items = [i for i in (cart.get("items") or []) if not i.get("is_delivery_fee")]
        out.append(StaleConversation(
            phone=phone,
            state=str(state.get("state") or ""),
            customer_name=cust,
            cart_items=len(items),
            last_message_at=last.created_at,
            last_message_preview=(last.content or "")[:140],
            idle_minutes=round(idle_min, 1),
            cancellation_reason=state.get("cancellation_reason"),
            handoff_reason=state.get("handoff_reason"),
            nudged_at=state.get("_nudged_at"),
        ))
    # Sort by most idle first — operator's highest-leverage rescues
    out.sort(key=lambda r: r.idle_minutes, reverse=True)
    return out


@router.get("/active", response_model=List[ActiveConversation])
async def list_active(db: AsyncSession = Depends(get_db)):
    """List ongoing conversations from Redis (TTL'd) + DB-backed name."""
    client = redis.from_url(settings.redis_url, decode_responses=True)
    keys = []
    cursor = 0
    while True:
        cursor, batch = await client.scan(cursor, match="conv:*", count=200)
        keys.extend(batch)
        if cursor == 0:
            break

    out: list[ActiveConversation] = []
    if not keys:
        return out

    raw_states = await client.mget(keys)
    phones = [k.removeprefix("conv:") for k in keys]

    customer_rows = await db.execute(
        select(Customer.phone, Customer.name).where(Customer.phone.in_(phones))
    )
    name_by_phone = {p: n for p, n in customer_rows.all()}

    last_msg_rows = await db.execute(
        select(
            ConversationMessage.phone,
            func.max(ConversationMessage.created_at).label("last"),
        )
        .where(ConversationMessage.phone.in_(phones))
        .group_by(ConversationMessage.phone)
    )
    last_by_phone = {p: t for p, t in last_msg_rows.all()}

    for phone, raw in zip(phones, raw_states):
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        cart = data.get("cart") or {}
        out.append(
            ActiveConversation(
                phone=phone,
                state=data.get("state", "greeting"),
                cart_items=len((cart.get("items") or [])),
                customer_name=name_by_phone.get(phone),
                last_message_at=last_by_phone.get(phone),
                is_human_takeover=data.get("state") == "human_takeover",
            )
        )

    out.sort(key=lambda c: c.last_message_at or datetime.fromtimestamp(0, tz=timezone.utc), reverse=True)
    return out


@router.get("/{phone}/messages", response_model=List[ConversationMessageOut])
async def list_messages(
    phone: str,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.phone == phone)
        .order_by(ConversationMessage.created_at.asc())
        .limit(limit)
    )
    rows = res.scalars().all()
    return [
        ConversationMessageOut(
            id=r.id,
            role=r.role.value,
            content=r.content,
            is_audio=r.is_audio,
            media_url=r.media_url,
            media_type=r.media_type,
            created_at=r.created_at,
            delivery_status=r.delivery_status,
        )
        for r in rows
    ]


@router.post("/{phone}/takeover")
async def takeover(phone: str):
    # Admin clicked "take over" in the panel — they're about to type
    # themselves, so skip the auto "atendente vai responder" message and
    # the WhatsApp ping to ADMIN_PHONES (they ARE the admin).
    await handoff_svc.trigger_handoff(
        phone,
        reason="admin_takeover",
        notify_customer=False,
        notify_admins=False,
    )
    return {"ok": True}


@router.post("/{phone}/release")
async def release(phone: str):
    await handoff_svc.release_handoff(phone)
    return {"ok": True}


@router.post("/{phone}/send")
async def send_admin_message(
    phone: str,
    payload: SendMessagePayload,
    db: AsyncSession = Depends(get_db),
):
    text = payload.content.strip()
    if not text:
        raise HTTPException(400, "empty message")

    try:
        send_result = await wa_client.send_text(phone, text)
    except Exception as e:
        raise HTTPException(502, f"failed to send: {e}")

    # Capture wamid + initial 'sent' status on the admin message row so
    # the chat viewer can render delivery check marks for operator-typed
    # replies the same way it does for bot replies.
    wamid = None
    if isinstance(send_result, dict):
        wamid = (((send_result.get("messages") or [{}]))[0] or {}).get("id")
    db.add(
        ConversationMessage(
            phone=phone, role=MessageRole.admin, content=text, is_audio=False,
            wa_message_id=wamid,
            delivery_status="sent" if wamid else None,
        )
    )
    await db.commit()

    from app.services.websocket import manager
    await manager.broadcast(
        "chat_message",
        {
            "phone": phone, "role": "admin", "content": text,
            "is_audio": False, "media_url": None, "media_type": None,
        },
    )
    return {"ok": True}


@router.post("/{phone}/send-media")
async def send_admin_media(
    phone: str,
    file: UploadFile = File(...),
    media_type: str = Form(...),
    caption: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Operator sends an image or voice note in a chat. Saves the file under
    /media/chats/, ships it via the WhatsApp Cloud API (send_media for
    images, send_audio for voice notes), and persists a MessageRole.admin
    row referencing the URL so the chat viewer can render it for both
    this admin and any other connected operator over the WebSocket broadcast.
    """
    if media_type not in ("image", "audio"):
        raise HTTPException(400, "media_type must be image or audio")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "empty upload")
    if len(raw) > MAX_MEDIA_BYTES:
        raise HTTPException(400, f"file too large (max {MAX_MEDIA_BYTES // (1024*1024)} MB)")

    public_url, _ = save_chat_media(
        raw,
        media_type=media_type,
        content_type=file.content_type,
        filename=file.filename,
    )

    try:
        if media_type == "audio":
            await wa_client.send_audio(
                phone, raw, mime_type=file.content_type or "audio/ogg",
            )
        else:
            await wa_client.send_media(
                phone,
                raw,
                media_type="image",
                mime_type=file.content_type or "image/jpeg",
                caption=caption or None,
                filename=file.filename or "image.jpg",
            )
    except Exception as e:
        # The file is already on disk; don't leak it if WhatsApp delivery failed —
        # the operator will retry, and orphaned bytes are cheap to clean periodically.
        raise HTTPException(502, f"failed to send to whatsapp: {e}")

    text_content = caption.strip() if caption and caption.strip() else (
        "[ÁUDIO ENVIADO]" if media_type == "audio" else "[IMAGEM ENVIADA]"
    )
    db.add(
        ConversationMessage(
            phone=phone,
            role=MessageRole.admin,
            content=text_content,
            is_audio=(media_type == "audio"),
            media_url=public_url,
            media_type=media_type,
        )
    )
    await db.commit()

    from app.services.websocket import manager
    await manager.broadcast(
        "chat_message",
        {
            "phone": phone,
            "role": "admin",
            "content": text_content,
            "is_audio": media_type == "audio",
            "media_url": public_url,
            "media_type": media_type,
        },
    )
    return {"ok": True, "media_url": public_url}


@router.get("/recent-phones")
async def recent_phones(limit: int = 30, db: AsyncSession = Depends(get_db)):
    """Distinct phones with persisted history, with the captured pushName.

    The archived list in the conversations panel renders these — without the
    customer_name field it falls back to "Anônimo · #<lid-tail>" even when
    we already have the WhatsApp pushName saved on the customer row.
    """
    res = await db.execute(
        select(
            ConversationMessage.phone,
            func.max(ConversationMessage.created_at).label("last"),
        )
        .group_by(ConversationMessage.phone)
        .order_by(func.max(ConversationMessage.created_at).desc())
        .limit(limit)
    )
    rows = res.all()
    phones = [p for p, _ in rows]
    name_rows = await db.execute(
        select(Customer.phone, Customer.name).where(Customer.phone.in_(phones))
    )
    name_by_phone = {p: n for p, n in name_rows.all()}
    return [
        {"phone": p, "last": t.isoformat(), "customer_name": name_by_phone.get(p)}
        for p, t in rows
    ]

"""Conversation viewer API for the admin panel."""
import json
from datetime import datetime, timezone
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


class SendMessagePayload(BaseModel):
    content: str


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
        await wa_client.send_text(phone, text)
    except Exception as e:
        raise HTTPException(502, f"failed to send: {e}")

    db.add(
        ConversationMessage(
            phone=phone, role=MessageRole.admin, content=text, is_audio=False
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
    /media/chats/, ships it via Evolution (sendMedia for images, sendWhatsAppAudio
    for voice notes), and persists a MessageRole.admin row referencing the URL
    so the chat viewer can render it for both this admin and any other connected
    operator over the websocket broadcast.
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

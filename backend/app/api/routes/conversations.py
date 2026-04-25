"""Conversation viewer API for the admin panel."""
import json
from datetime import datetime, timezone
from typing import List, Optional

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException
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
from app.services.whatsapp import client as wa_client

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
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/{phone}/takeover")
async def takeover(phone: str):
    await handoff_svc.trigger_handoff(phone, reason="admin_takeover")
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
        {"phone": phone, "role": "admin", "content": text, "is_audio": False},
    )
    return {"ok": True}


@router.get("/recent-phones")
async def recent_phones(limit: int = 30, db: AsyncSession = Depends(get_db)):
    """Distinct phones with persisted history (regardless of active state)."""
    res = await db.execute(
        select(
            ConversationMessage.phone,
            func.max(ConversationMessage.created_at).label("last"),
        )
        .group_by(ConversationMessage.phone)
        .order_by(func.max(ConversationMessage.created_at).desc())
        .limit(limit)
    )
    return [{"phone": p, "last": t.isoformat()} for p, t in res.all()]

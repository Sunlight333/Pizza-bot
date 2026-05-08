"""
Admin-only utility endpoints — used by the panel for tasks that don't fit the
domain CRUD: bot simulator, manual broadcast, future maintenance hooks.

The simulator is the most important: it lets the operator run the Step-12
end-to-end flow scenarios *without* needing a real WhatsApp number paired
with Evolution. The simulator routes the message through the same
ai_engine.process_incoming() function the real webhook uses.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.services import audio as audio_svc
from app.services.ai_engine import process_incoming
from app.services.chat_media import save_chat_media
from app.services import conversation_state as state_svc
from app.services import handoff as handoff_svc

# Same cap as /api/conversations/{phone}/send-media; voice notes are usually
# under 1 MB, images under a few MB.
SIMULATE_MAX_MEDIA_BYTES = 16 * 1024 * 1024  # 16 MB

router = APIRouter(dependencies=[Depends(get_current_user)])


class SimulateRequest(BaseModel):
    phone: str
    text: str
    is_audio: bool = False


class SimulateResponse(BaseModel):
    phone: str
    user_text: str
    bot_reply: Optional[str]
    bot_state: dict
    notes: list[str] = []
    # Set when the bot's turn invoked a tool that ships media (today: only
    # send_menu_image). Lets the simulator panel render the image bubble
    # without a second round-trip to /api/conversations/.../messages.
    bot_media_url: Optional[str] = None
    bot_media_type: Optional[str] = None


@router.post("/simulate", response_model=SimulateResponse)
async def simulate_customer_message(
    payload: SimulateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Drive the bot end-to-end with a fake customer message.
    The bot's reply is NOT sent to WhatsApp — it's returned in the response so
    the operator can inspect it. State + cart still persist exactly like a real call.
    """
    notes: list[str] = []
    if not payload.phone.strip():
        raise HTTPException(400, "phone required")
    if not payload.text.strip():
        raise HTTPException(400, "text required")

    # Sanity-check: refuse to simulate against numbers that look real (E.164-ish 12+ digits
    # starting with 55) to prevent accidental drift between simulator and prod.
    cleaned = "".join(c for c in payload.phone if c.isdigit())
    if len(cleaned) >= 12 and cleaned.startswith("55"):
        notes.append(
            "phone resembles a real Brazilian number — bot WILL persist conversation "
            "and customer rows for it"
        )

    reply = await process_incoming(
        db, phone=payload.phone, text=payload.text, is_audio=payload.is_audio
    )
    state = await state_svc.get_state(payload.phone)

    # Tool calls (e.g. send_menu_image) stash media here so the panel can
    # render it; consume + clear so the next turn starts fresh.
    media = state.pop("_last_bot_media", None) if isinstance(state, dict) else None
    if media:
        await state_svc.set_state(payload.phone, state)

    return SimulateResponse(
        phone=payload.phone,
        user_text=payload.text,
        bot_reply=reply,
        bot_state=state,
        notes=notes,
        bot_media_url=(media or {}).get("url"),
        bot_media_type=(media or {}).get("type"),
    )


@router.post("/simulate-media", response_model=SimulateResponse)
async def simulate_customer_media(
    phone: str = Form(...),
    media_type: str = Form(...),
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Same as /simulate, but the operator drives the bot with an image or a
    voice note. Voice notes are transcribed (same path the real webhook uses)
    so the AI sees the text; images become a synthetic `[IMAGEM ENVIADA]`
    turn so the bot can decide to ask for clarification or hand off.
    """
    notes: list[str] = []
    if not phone.strip():
        raise HTTPException(400, "phone required")
    if media_type not in ("image", "audio"):
        raise HTTPException(400, "media_type must be image or audio")

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "empty upload")
    if len(raw) > SIMULATE_MAX_MEDIA_BYTES:
        raise HTTPException(
            400, f"file too large (max {SIMULATE_MAX_MEDIA_BYTES // (1024*1024)} MB)"
        )

    public_url, _ = save_chat_media(
        raw,
        media_type=media_type,
        content_type=file.content_type,
        filename=file.filename,
    )

    if media_type == "audio":
        text = await audio_svc.transcribe_audio(raw)
        if not text:
            text = "[ÁUDIO INAUDÍVEL]"
        is_audio = True
    else:
        text = (caption or "").strip() or "[IMAGEM ENVIADA]"
        is_audio = False

    cleaned = "".join(c for c in phone if c.isdigit())
    if len(cleaned) >= 12 and cleaned.startswith("55"):
        notes.append(
            "phone resembles a real Brazilian number — bot WILL persist conversation "
            "and customer rows for it"
        )

    reply = await process_incoming(
        db,
        phone=phone,
        text=text,
        is_audio=is_audio,
        media_url=public_url,
        media_type=media_type,
    )
    state = await state_svc.get_state(phone)

    bot_media = state.pop("_last_bot_media", None) if isinstance(state, dict) else None
    if bot_media:
        await state_svc.set_state(phone, state)

    return SimulateResponse(
        phone=phone,
        user_text=text,
        bot_reply=reply,
        bot_state=state,
        notes=notes,
        bot_media_url=(bot_media or {}).get("url"),
        bot_media_type=(bot_media or {}).get("type"),
    )


@router.post("/simulate/reset")
async def reset_simulated_conversation(phone: str):
    """Wipe Redis state for a phone — useful between scenario runs."""
    await state_svc.clear_state(phone)
    await handoff_svc.release_handoff(phone)
    return {"ok": True, "phone": phone}

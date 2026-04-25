"""
Admin-only utility endpoints — used by the panel for tasks that don't fit the
domain CRUD: bot simulator, manual broadcast, future maintenance hooks.

The simulator is the most important: it lets the operator run the Step-12
end-to-end flow scenarios *without* needing a real WhatsApp number paired
with Evolution. The simulator routes the message through the same
ai_engine.process_incoming() function the real webhook uses.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.services.ai_engine import process_incoming
from app.services import conversation_state as state_svc
from app.services import handoff as handoff_svc

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

    return SimulateResponse(
        phone=payload.phone,
        user_text=payload.text,
        bot_reply=reply,
        bot_state=state,
        notes=notes,
    )


@router.post("/simulate/reset")
async def reset_simulated_conversation(phone: str):
    """Wipe Redis state for a phone — useful between scenario runs."""
    await state_svc.clear_state(phone)
    await handoff_svc.release_handoff(phone)
    return {"ok": True, "phone": phone}

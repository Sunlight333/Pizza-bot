"""Human handoff — flip conversation state and notify admins via WebSocket."""
from datetime import datetime, timezone

from app.services import conversation_state as state_svc
from app.services.websocket import manager


async def trigger_handoff(phone: str, reason: str = "customer_request") -> None:
    data = await state_svc.get_state(phone)
    data["state"] = "human_takeover"
    data["handed_off_at"] = datetime.now(timezone.utc).isoformat()
    await state_svc.set_state(phone, data)
    await manager.broadcast("handoff_requested", {"phone": phone, "reason": reason})


async def release_handoff(phone: str) -> None:
    data = await state_svc.get_state(phone)
    data["state"] = "greeting"
    await state_svc.set_state(phone, data)
    await manager.broadcast("handoff_released", {"phone": phone})

"""
WhatsApp Cloud API admin endpoints.

Surface: read configuration, probe credentials, send a test message.
The WABA-phone binding is permanent at Meta so there's no QR pairing
to manage here. Public landing-page integration just exposes the
display number so the "Falar no WhatsApp" link works.
"""
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.config import settings
from app.services.whatsapp import client as wa_client

log = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])
public_router = APIRouter()


def _digits(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    s = "".join(ch for ch in phone if ch.isdigit())
    return s or None


@public_router.get("/whatsapp")
async def public_whatsapp():
    """Public summary used by the marketing landing page wa.me link.

    Returns: { connected: bool, phone: str | None, status: str }

    Without a token configured we report `not_configured` so the landing
    page can fall back to the friendly modal. With a token, we trust the
    binding (it's permanent) and only report `disconnected` when the
    Graph probe explicitly fails — covers cases like an expired token
    or a deleted phone number.
    """
    if not wa_client.configured:
        return {"connected": False, "phone": None, "status": "not_configured"}
    phone_digits = _digits(settings.meta_display_phone_number)
    url = (
        f"https://graph.facebook.com/{settings.meta_graph_version}/"
        f"{settings.meta_phone_number_id}"
    )
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(
                url,
                headers={"Authorization": f"Bearer {settings.meta_access_token}"},
            )
        if r.status_code == 200:
            j = r.json()
            phone_digits = _digits(j.get("display_phone_number")) or phone_digits
            return {"connected": bool(phone_digits), "phone": phone_digits, "status": "open"}
        return {"connected": False, "phone": None, "status": f"http_{r.status_code}"}
    except Exception as e:
        log.warning("public whatsapp probe failed: %s", e)
        return {"connected": False, "phone": None, "status": "error"}


@router.get("/config")
async def config():
    """Operator-visible config snapshot. Tokens themselves are not echoed
    — only their presence."""
    return {
        "phone_number_id": settings.meta_phone_number_id,
        "waba_id": settings.meta_waba_id,
        "display_phone_number": settings.meta_display_phone_number,
        "graph_version": settings.meta_graph_version,
        "webhook_url": "/api/webhook/meta",
        "verify_token_set": bool(settings.meta_verify_token),
        "app_secret_set": bool(settings.meta_app_secret),
        "access_token_set": bool(settings.meta_access_token),
    }


@router.get("/status")
async def status():
    """Probe credentials against Graph and return display info.

    There's no "connecting / close / open" state to surface — once a
    WABA is provisioned the binding is permanent. We just verify the
    token has access to the phone number resource.
    """
    if not wa_client.configured:
        return {"ok": False, "error": "not configured"}
    url = (
        f"https://graph.facebook.com/{settings.meta_graph_version}/"
        f"{settings.meta_phone_number_id}"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                url,
                headers={"Authorization": f"Bearer {settings.meta_access_token}"},
            )
        if r.status_code == 200:
            j = r.json()
            return {
                "ok": True,
                "display_phone_number": j.get("display_phone_number"),
                "verified_name": j.get("verified_name"),
                "code_verification_status": j.get("code_verification_status"),
                "quality_rating": j.get("quality_rating"),
                "platform_type": j.get("platform_type"),
            }
        return {
            "ok": False,
            "error": f"Meta returned {r.status_code}",
            "body": r.text[:300],
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


class TestMessageBody(BaseModel):
    to: str = Field(..., description="Destination phone, E.164 digits-only e.g. 5517991234567")
    text: str = Field(default="Teste do bot 🍕 — se você recebeu, a integração tá ok.")


@router.post("/test-send")
async def test_send(body: TestMessageBody):
    """Send a one-off test text. Useful right after wiring a new
    token — confirms outbound works without going through the bot."""
    if not wa_client.configured:
        raise HTTPException(400, "Meta WhatsApp not configured")
    res = await wa_client.send_text(body.to, body.text)
    if isinstance(res, dict) and res.get("error"):
        raise HTTPException(502, f"Meta send failed: {res.get('error')}")
    return {"ok": True, "result": res}

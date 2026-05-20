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


def _graph_error(body_text: str) -> dict:
    """Pull the OAuthException code/subcode/message out of a Graph error body.

    Meta's error envelope is `{"error": {"message": ..., "code": 190,
    "error_subcode": 463, "type": "OAuthException", ...}}`. Surfacing
    these to the caller turns an opaque "http_400" into something an
    operator can act on without SSH'ing to the box.
    """
    import json
    try:
        j = json.loads(body_text or "{}")
        err = j.get("error") or {}
        return {
            "code": err.get("code"),
            "subcode": err.get("error_subcode"),
            "type": err.get("type"),
            "message": err.get("message"),
        }
    except Exception:
        return {"code": None, "subcode": None, "type": None, "message": (body_text or "")[:200]}


@public_router.get("/whatsapp")
async def public_whatsapp():
    """Public summary used by the marketing landing page wa.me link.

    Returns: { connected: bool, phone: str | None, status: str,
               error?: {code, subcode, type, message} }

    Without a token configured we report `not_configured` so the landing
    page can fall back to the friendly modal. With a token, we trust the
    binding (it's permanent) and only report `disconnected` when the
    Graph probe explicitly fails. When that happens we now include the
    Graph error envelope so an operator can tell (#190 token bad) from
    (#100 phone-id wrong) without reading container logs.
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
        return {
            "connected": False,
            "phone": None,
            "status": f"http_{r.status_code}",
            "error": _graph_error(r.text),
        }
    except Exception as e:
        log.warning("public whatsapp probe failed: %s", e)
        return {"connected": False, "phone": None, "status": "error", "error": {"message": str(e)}}


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
            "graph_error": _graph_error(r.text),
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

"""
Evolution API admin endpoints — status, QR pairing, plus number management
(logout / delete & re-create) so the operator can swap to a different
WhatsApp number without touching docker compose.
"""
import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.config import settings
from app.services.whatsapp import client as wa_client

log = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

# Public, unauthenticated surface — used by the marketing landing page so it
# can route customers to the same WhatsApp number the bot is currently paired
# with, and fall back to a friendly modal when the number isn't connected.
public_router = APIRouter()


@public_router.get("/whatsapp")
async def public_whatsapp():
    """
    Minimal public summary of the WhatsApp connection state.

    Returns: { connected: bool, phone: str | None, status: str }

    `phone` is the digits-only number (e.g. "5517991289777"), suitable to
    drop into a `wa.me/<phone>` link. We only expose it when the instance
    is actually paired (`status == "open"`) — no PII leaks while the bot is
    disconnected. Cached for ~30s on the client; cheap on the server.
    """
    info = await wa_client.fetch_instance()
    if isinstance(info, dict) and "instance" in info:
        info = info["instance"]
    if not isinstance(info, dict):
        info = {}

    status = (info.get("connectionStatus") or info.get("status") or "unknown")
    status = str(status).lower()

    owner_jid = info.get("ownerJid") or info.get("owner")
    phone = info.get("number")
    if not phone and isinstance(owner_jid, str):
        phone = owner_jid.split("@")[0]
    if isinstance(phone, str):
        phone = "".join(ch for ch in phone if ch.isdigit()) or None

    connected = status == "open" and bool(phone)
    return {
        "connected": connected,
        "phone": phone if connected else None,
        "status": status,
    }


@router.get("/status")
async def status():
    """Just the connection state — light, polled every 15s by the panel."""
    return await wa_client.instance_status()


@router.get("/qr")
async def qr():
    """Fetch QR code base64 for pairing."""
    return await wa_client.fetch_qr()


@router.get("/config")
async def config():
    return {
        "url": settings.evolution_api_url,
        "instance": settings.evolution_instance_name,
        "webhook_url": "/api/webhook/evolution",
        "webhook_secret_set": bool(settings.evolution_webhook_secret),
    }


@router.get("/instance")
async def instance_info():
    """
    Full instance details — surfaces the paired number, profile name,
    owner JID, and connection status. Used to decide whether to show the
    "Disconnect" or "Pair" buttons in the panel.
    """
    info = await wa_client.fetch_instance()
    # Normalize shape regardless of which Evolution version is running.
    if isinstance(info, dict) and "instance" in info:
        info = info["instance"]
    if not isinstance(info, dict):
        return {}
    # Phone is sometimes nested under ownerJid or .number depending on version
    owner_jid = info.get("ownerJid") or info.get("owner")
    phone = info.get("number")
    if not phone and owner_jid:
        # ownerJid format: "5517991289777@s.whatsapp.net"
        phone = owner_jid.split("@")[0] if isinstance(owner_jid, str) else None

    return {
        "name": info.get("name") or info.get("instanceName"),
        "status": info.get("connectionStatus") or info.get("status"),
        "phone": phone,
        "owner_jid": owner_jid,
        "profile_name": info.get("profileName"),
        "profile_pic_url": info.get("profilePicUrl"),
        "integration": info.get("integration"),
        "created_at": info.get("createdAt"),
        "updated_at": info.get("updatedAt"),
    }


@router.post("/logout")
async def logout():
    """
    Disconnect the currently paired WhatsApp number. The Evolution instance
    row stays — after logout the operator can scan a fresh QR with a
    different phone (or the same one) via /qr.
    """
    result = await wa_client.logout_instance()
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(502, f"Evolution logout failed: {result['error']}")
    return {"ok": True, "result": result}


@router.post("/reset")
async def reset_instance():
    """
    Hard reset: delete the instance entirely (clears all session data) and
    recreate it fresh. Use this when:
      - logout doesn't fully clear a stuck session
      - switching to a completely new number and you want a clean slate
      - the integration is wedged from a stale Baileys state

    After this returns, /qr will produce a brand-new pairing code.
    """
    log.info("evolution.reset: deleting instance %s", settings.evolution_instance_name)
    deleted = await wa_client.delete_instance()
    if isinstance(deleted, dict) and deleted.get("error"):
        # If the instance didn't exist, that's still fine — just create it.
        log.warning("evolution.reset: delete returned %s, continuing", deleted["error"])

    # Give Evolution a beat to clear in-memory state before recreating
    await asyncio.sleep(1)

    created = await wa_client.create_instance()
    if isinstance(created, dict) and created.get("error"):
        raise HTTPException(502, f"Evolution recreate failed: {created['error']}")

    log.info("evolution.reset: instance recreated, QR ready on /qr")
    return {"ok": True, "deleted": deleted, "created": created}

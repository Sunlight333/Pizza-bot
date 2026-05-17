"""
Meta WhatsApp Cloud API webhook.

Two endpoints under one path:

GET  /api/webhook/meta — handshake. Meta calls this once when you save
     the webhook URL in App Dashboard → WhatsApp → Configuration. Echo
     back `hub.challenge` if `hub.verify_token` matches our config.

POST /api/webhook/meta — incoming events. The body is HMAC-SHA256
     signed with the App Secret in the X-Hub-Signature-256 header.
     We verify, parse Meta's envelope (object → entry[] → changes[] →
     value.messages[]), normalize each message, and dispatch to the
     bot pipeline. Always returns 200 fast — Meta retries aggressively
     on non-2xx and that turns into duplicate orders.

Notes:
- Cloud API gives us digits-only E.164 in `wa_id` and `from`. Group /
  broadcast traffic doesn't reach this endpoint at all.
- Audio + image arrive as media_id only; we fetch bytes via the
  WhatsApp client.
- Statuses (delivered/read/failed) arrive too — we currently log and
  drop them; future work could wire delivery receipts to admin UI.
"""
import hashlib
import hmac
import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.config import settings
from app.database import AsyncSessionLocal
from app.middleware.rate_limit import limiter
from app.services import audio as audio_svc
from app.services.ai_engine import process_incoming
from app.services.whatsapp import client as wa_client

log = logging.getLogger(__name__)
router = APIRouter()


# ---------- payload normalization ----------

def _extract_message_envelope(event: dict) -> list[tuple[dict, dict]]:
    """Walk Meta's nested envelope; yield (value, message) tuples.

    `value` is the inner object that holds `metadata`, `contacts`, and
    `messages`. We pair each individual message with its parent value so
    contact name / wa_id are accessible during normalization.
    """
    out: list[tuple[dict, dict]] = []
    for entry in event.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            for msg in value.get("messages") or []:
                out.append((value, msg))
    return out


def _push_name(value: dict, wa_id: str) -> Optional[str]:
    for c in value.get("contacts") or []:
        if c.get("wa_id") == wa_id:
            name = ((c.get("profile") or {}).get("name") or "").strip()
            return name or None
    return None


def _verify_signature(raw_body: bytes, header_signature: Optional[str]) -> bool:
    """HMAC-SHA256 of the raw body against META_APP_SECRET.

    Meta's signature is `sha256=<hex>`. Without the secret configured we
    skip verification (dev mode), but in prod always set
    META_APP_SECRET — without it anyone who guesses your webhook URL can
    inject fake messages.
    """
    secret = settings.meta_app_secret
    if not secret:
        return True
    if not header_signature:
        return False
    sent = header_signature.split("=", 1)[-1].strip()
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sent.lower(), expected.lower())


# ---------- per-message processing ----------

async def _process_one(value: dict, msg: dict) -> None:
    """Normalize one Meta message and dispatch to the bot pipeline."""
    msg_id = msg.get("id")
    msg_type = msg.get("type")
    phone = msg.get("from")  # already digits-only E.164
    if not phone:
        log.info("webhook: drop message with no `from`")
        return

    log.info("webhook: msg id=%s type=%s from=%s", msg_id, msg_type, phone)

    # Mark read immediately — anti-bot signal + better customer UX.
    if msg_id:
        await wa_client.mark_as_read(msg_id)

    text: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    is_audio = False

    if msg_type == "text":
        text = ((msg.get("text") or {}).get("body") or "").strip() or None

    elif msg_type == "audio":
        # Meta voice notes are ogg/opus; transcribe via the existing
        # audio service. Save the original blob for the admin viewer.
        is_audio = True
        media_id = (msg.get("audio") or {}).get("id")
        audio_bytes = await wa_client.download_media(media_id) if media_id else None
        if audio_bytes:
            try:
                from app.services.chat_media import save_chat_media
                media_url, _ = save_chat_media(
                    audio_bytes,
                    media_type="audio",
                    content_type="audio/ogg",
                    filename=f"{media_id}.ogg",
                )
                media_type = "audio"
            except Exception as e:
                log.warning("save inbound audio failed: %s", e)
            text = await audio_svc.transcribe_audio(audio_bytes)
        if not text:
            await wa_client.send_text(
                phone,
                "Desculpa, não consegui entender o áudio. Pode escrever ou mandar de novo?",
            )
            return

    elif msg_type == "image":
        # Bot doesn't do vision; we save the image so the operator sees
        # it, then route through the bot's normal text flow with caption
        # (or a synthetic [IMAGEM ENVIADA] tag) so it can decide whether
        # to reply or hand off.
        img = msg.get("image") or {}
        media_id = img.get("id")
        img_bytes = await wa_client.download_media(media_id) if media_id else None
        if img_bytes:
            try:
                from app.services.chat_media import save_chat_media
                media_url, _ = save_chat_media(
                    img_bytes,
                    media_type="image",
                    content_type=img.get("mime_type") or "image/jpeg",
                    filename=f"{media_id}.jpg",
                )
                media_type = "image"
            except Exception as e:
                log.warning("save inbound image failed: %s", e)
        caption = (img.get("caption") or "").strip() or None
        text = caption or "[IMAGEM ENVIADA]"

    elif msg_type == "location":
        loc = msg.get("location") or {}
        try:
            lat = float(loc.get("latitude"))
            lng = float(loc.get("longitude"))
        except (TypeError, ValueError):
            log.info("webhook: location missing coords — drop")
            return
        from app.services import conversation_state as state_svc
        state = await state_svc.get_state(phone)
        cart = state.setdefault("cart", {"items": []})
        cart["delivery_lat"] = lat
        cart["delivery_lng"] = lng
        cart["needs_location_pin"] = False
        await state_svc.set_state(phone, state)
        synthetic = f"[LOCALIZAÇÃO COMPARTILHADA: lat={lat}, lng={lng}]"
        async with AsyncSessionLocal() as db:
            reply = await process_incoming(db, phone=phone, text=synthetic)
        if reply:
            await wa_client.send_text(phone, reply)
        return

    elif msg_type == "interactive":
        # Reply from a list/button message. The bot doesn't currently
        # send interactive messages, but we handle inbound replies in case
        # an admin sends one from the panel in the future.
        inter = msg.get("interactive") or {}
        if "button_reply" in inter:
            text = (inter["button_reply"] or {}).get("title")
        elif "list_reply" in inter:
            text = (inter["list_reply"] or {}).get("title")

    else:
        log.info("webhook: unsupported msg type=%s — drop", msg_type)
        return

    if not text:
        return

    push_name = _push_name(value, phone)
    async with AsyncSessionLocal() as db:
        reply = await process_incoming(
            db,
            phone=phone,
            text=text,
            is_audio=is_audio,
            media_url=media_url,
            media_type=media_type,
            push_name=push_name,
        )
    if reply:
        await wa_client.send_text(phone, reply)


async def _handle_safely(event: dict) -> None:
    try:
        for value, msg in _extract_message_envelope(event):
            try:
                await _process_one(value, msg)
            except Exception:
                log.exception("webhook _process_one failed for msg %s", msg.get("id"))
        # Statuses (delivered / read / failed) — log and skip for now.
        for entry in event.get("entry") or []:
            for change in entry.get("changes") or []:
                statuses = (change.get("value") or {}).get("statuses") or []
                for s in statuses:
                    log.info(
                        "webhook status: id=%s status=%s recipient=%s",
                        s.get("id"), s.get("status"), s.get("recipient_id"),
                    )
    except Exception:
        log.exception("webhook _handle_safely failed")


# ---------- HTTP routes ----------

@router.get("/meta", response_class=PlainTextResponse)
async def meta_verify(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
):
    """Meta webhook handshake. Echo `hub.challenge` if token matches."""
    expected = settings.meta_verify_token
    if (
        hub_mode == "subscribe"
        and expected
        and hub_verify_token == expected
        and hub_challenge is not None
    ):
        log.info("webhook: meta verify OK")
        return hub_challenge
    log.warning(
        "webhook: meta verify failed (mode=%s token_match=%s)",
        hub_mode, hub_verify_token == expected,
    )
    raise HTTPException(status_code=403, detail="verification failed")


@router.post("/meta")
@limiter.limit("200/minute")
async def meta_webhook(request: Request, bg: BackgroundTasks):
    raw = await request.body()
    sig = request.headers.get("x-hub-signature-256")
    if not _verify_signature(raw, sig):
        log.warning("webhook: meta signature mismatch")
        raise HTTPException(status_code=401, detail="invalid signature")

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return {"ok": False, "reason": "invalid-json"}

    if body.get("object") != "whatsapp_business_account":
        log.info("webhook: ignoring non-WABA event object=%s", body.get("object"))
        return {"ok": True}

    log.info(
        "webhook: meta event accepted entries=%d",
        len(body.get("entry") or []),
    )
    bg.add_task(_handle_safely, body)
    return {"ok": True}

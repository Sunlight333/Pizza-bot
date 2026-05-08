"""
Evolution API webhook — receives WhatsApp events and routes to the bot.
Responds 200 immediately and processes async.
Optional HMAC verification when EVOLUTION_WEBHOOK_SECRET is set.
"""
import hashlib
import hmac
import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.config import settings
from app.database import AsyncSessionLocal
from app.middleware.rate_limit import limiter
from app.services import audio as audio_svc
from app.services.ai_engine import process_incoming
from app.services.whatsapp import client as wa_client

log = logging.getLogger(__name__)
router = APIRouter()


def _extract_phone(data: dict) -> Optional[str]:
    """Extract the customer's phone number from a webhook event.

    WhatsApp's privacy protocol now sends `remoteJid` as `<lid>@lid`
    (a 15-digit anonymized identifier) for users with privacy enabled.
    The actual phone JID is in `senderPn` / `participantPn` (Evolution
    v2.2.x). We must use that — sending text to an LID number returns
    400 "exists: false" because the LID is not a real phone number.
    """
    key = data.get("key") or {}

    # Real-phone JID fields, checked in priority order
    for field in ("senderPn", "participantPn"):
        for source in (key, data):
            val = source.get(field)
            if val:
                local = val.split("@")[0] if "@" in val else val
                if local and local.isdigit():
                    return local

    remote = key.get("remoteJid") or ""
    if not remote:
        return None

    # WhatsApp groups arrive with `<id>@g.us`. The bot is a 1:1 ordering
    # assistant — drop group traffic so we don't create stale "Sem nome"
    # customer rows for every notification group the number is added to.
    if remote.endswith("@g.us") or remote.endswith("@broadcast"):
        return None

    # If the JID is an LID, keep it as-is. Modern WhatsApp routes 1:1 chats
    # with @lid JIDs by default; reply paths must echo the same LID back.
    # Our custom Evolution image (evolution/Dockerfile) patches the outbound
    # validator so sendText/sendMedia accept `<id>@lid` recipients.
    if remote.endswith("@lid"):
        return remote

    return remote.split("@")[0] or None


def _extract_text(data: dict) -> Optional[str]:
    msg = data.get("message") or {}
    return (
        msg.get("conversation")
        or (msg.get("extendedTextMessage") or {}).get("text")
        or (msg.get("buttonsResponseMessage") or {}).get("selectedDisplayText")
        or (msg.get("listResponseMessage") or {}).get("title")
    )


def _extract_audio_id(data: dict) -> Optional[str]:
    msg = data.get("message") or {}
    if "audioMessage" in msg:  # value can be {} — presence is what matters
        return (data.get("key") or {}).get("id")
    return None


def _extract_image_id(data: dict) -> Optional[str]:
    """Return the message id when this is an inbound image, else None.

    The actual bytes are fetched separately via wa_client.download_media.
    """
    msg = data.get("message") or {}
    if "imageMessage" in msg:
        return (data.get("key") or {}).get("id")
    return None


def _extract_image_caption(data: dict) -> Optional[str]:
    msg = data.get("message") or {}
    img = msg.get("imageMessage") or {}
    cap = img.get("caption")
    return cap.strip() if isinstance(cap, str) and cap.strip() else None


def _extract_location(data: dict) -> Optional[tuple[float, float]]:
    """Pull (lat, lng) from a WhatsApp shared-location message, if present.

    Evolution forwards both static pins (`locationMessage`) and live shares
    (`liveLocationMessage`). Both shapes carry degreesLatitude/degreesLongitude.
    """
    msg = data.get("message") or {}
    for key in ("locationMessage", "liveLocationMessage"):
        loc = msg.get(key)
        if loc:
            try:
                lat = float(loc.get("degreesLatitude"))
                lng = float(loc.get("degreesLongitude"))
                return lat, lng
            except (TypeError, ValueError):
                return None
    return None


def _verify_signature(raw_body: bytes, header_signature: Optional[str]) -> bool:
    """
    Verify HMAC-SHA256 of the raw body against EVOLUTION_WEBHOOK_SECRET.
    If the secret is not configured, verification is skipped (returns True).
    Header format: "sha256=<hex>" or just the hex digest.
    """
    secret = settings.evolution_webhook_secret
    if not secret:
        return True
    if not header_signature:
        return False
    sent = header_signature.split("=", 1)[-1].strip()
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sent.lower(), expected.lower())


async def _process(event: dict) -> None:
    event_type = event.get("event") or event.get("eventType")
    data = event.get("data") or {}
    key = data.get("key") or {}
    log.info(
        "webhook _process: event=%s fromMe=%s remoteJid=%s msgId=%s",
        event_type, key.get("fromMe"), key.get("remoteJid"), key.get("id"),
    )

    if event_type and "message" not in event_type.lower():
        log.info("webhook _process: skipping non-message event %s", event_type)
        return

    if key.get("fromMe"):
        log.info("webhook _process: skipping fromMe (own message)")
        return

    phone = _extract_phone(data)
    if not phone:
        log.info("webhook _process: phone unresolved (LID/group/empty) — drop")
        return
    log.info("webhook _process: resolved phone=%s, dispatching to ai_engine", phone)

    # Mark the inbound message as read before any processing — gives the
    # customer the blue checkmarks immediately, which a real attendant would
    # do as soon as they pick up the chat. Strong anti-bot signal: bots that
    # never deliver read receipts are trivial for WhatsApp to fingerprint.
    remote_jid = key.get("remoteJid")
    msg_id = key.get("id")
    if remote_jid and msg_id:
        await wa_client.mark_as_read(remote_jid, msg_id)

    text = _extract_text(data)
    audio_id = _extract_audio_id(data)
    image_id = _extract_image_id(data)
    location = _extract_location(data)

    media_url: Optional[str] = None
    media_type: Optional[str] = None

    if audio_id and not text:
        audio_bytes = await wa_client.download_media(audio_id)
        if audio_bytes:
            # Save the original voice note so the admin chat viewer can
            # play it, then transcribe for the AI.
            try:
                from app.services.chat_media import save_chat_media
                media_url, _ = save_chat_media(
                    audio_bytes,
                    media_type="audio",
                    content_type="audio/ogg",
                    filename=f"{audio_id}.ogg",
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

    if image_id:
        # Save the inbound image so the operator can see it. The bot itself
        # treats the image as a synthetic [IMAGEM] turn — GPT-4o doesn't get
        # vision here; if the customer sends a pizza photo we just route to
        # human handoff after the bot's polite acknowledgement.
        img_bytes = await wa_client.download_media(image_id)
        if img_bytes:
            try:
                from app.services.chat_media import save_chat_media
                media_url, _ = save_chat_media(
                    img_bytes,
                    media_type="image",
                    content_type="image/jpeg",
                    filename=f"{image_id}.jpg",
                )
                media_type = "image"
            except Exception as e:
                log.warning("save inbound image failed: %s", e)
        caption = _extract_image_caption(data)
        if not text:
            text = caption or "[IMAGEM ENVIADA]"

    # Location pin: write coords directly into the conversation cart, then
    # feed a synthetic turn to the bot so it can confirm with the customer
    # and continue the order. The bot's system prompt already covers the
    # "needs_location_pin" + "delivery_lat" branches.
    if location is not None:
        lat, lng = location
        from app.services import conversation_state as state_svc
        state = await state_svc.get_state(phone)
        cart = state.setdefault("cart", {"items": []})
        cart["delivery_lat"] = lat
        cart["delivery_lng"] = lng
        # Once we have the pin we no longer need to ask for it.
        cart["needs_location_pin"] = False
        await state_svc.set_state(phone, state)
        synthetic = f"[LOCALIZAÇÃO COMPARTILHADA: lat={lat}, lng={lng}]"
        async with AsyncSessionLocal() as db:
            reply = await process_incoming(db, phone=phone, text=synthetic)
        if reply:
            await wa_client.send_text(phone, reply)
        return

    if not text:
        return

    async with AsyncSessionLocal() as db:
        reply = await process_incoming(
            db,
            phone=phone,
            text=text,
            is_audio=bool(audio_id),
            media_url=media_url,
            media_type=media_type,
        )
    if reply:
        await wa_client.send_text(phone, reply)


@router.post("/evolution")
@limiter.limit("100/minute")
async def evolution_webhook(request: Request, bg: BackgroundTasks):
    raw = await request.body()
    sig = request.headers.get("x-hub-signature-256") or request.headers.get("x-signature")
    if not _verify_signature(raw, sig):
        log.warning("webhook signature mismatch")
        raise HTTPException(status_code=401, detail="invalid signature")

    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return {"ok": False, "reason": "invalid-json"}

    bg.add_task(_handle_safely, body)
    return {"ok": True}


async def _handle_safely(event: dict) -> None:
    try:
        await _process(event)
    except Exception:
        log.exception("webhook processing failed")

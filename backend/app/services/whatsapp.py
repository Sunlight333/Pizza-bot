"""
Evolution API v2 client — text/list/buttons/media + retry with exponential backoff.
"""
import asyncio
import base64
import logging
import random
from typing import Any, Optional

import httpx

from app.config import settings

log = logging.getLogger(__name__)


class EvolutionClient:
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 0.5  # seconds — doubles each retry

    # Humanisation parameters — the bot must not feel instant. WhatsApp's
    # anti-spam heuristics fingerprint bots by:
    #   1. sub-second replies
    #   2. perfectly identical reply latency (always 2.000s)
    #   3. typing time independent of message length
    # We address all three: every send shows a presence indicator, then waits
    # a randomised, content-aware pause before the message lands.
    COMPOSE_FLOOR_MS = 1500   # never feel instant — even an "ok"
    COMPOSE_CEILING_MS = 6000  # never bore the customer past ~6s
    COMPOSE_PER_CHAR_MS = 30   # ~33 chars/sec = realistic auto-suggest typing
    # Media (no text length): represents "thinking + tap-to-upload" time.
    MEDIA_DELAY_MIN_MS = 2200
    MEDIA_DELAY_MAX_MS = 3800
    # Audio (voice notes): "tap to record + speak briefly + send".
    AUDIO_DELAY_MIN_MS = 1800
    AUDIO_DELAY_MAX_MS = 3000

    def __init__(self) -> None:
        self._base = settings.evolution_api_url.rstrip("/")
        self._instance = settings.evolution_instance_name
        self._headers = {
            "apikey": settings.evolution_api_key,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        url = f"{self._base}{path}"
        last_exc: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    r = await client.request(method, url, headers=self._headers, **kwargs)
                if r.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"server error {r.status_code}", request=r.request, response=r
                    )
                if r.status_code >= 400:
                    log.warning(
                        "Evolution API %s %s -> %s %s",
                        method,
                        path,
                        r.status_code,
                        r.text[:300],
                    )
                    r.raise_for_status()
                if r.headers.get("content-type", "").startswith("application/json"):
                    return r.json()
                return r.content
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as e:
                last_exc = e
                if attempt + 1 < self.MAX_RETRIES:
                    backoff = self.INITIAL_BACKOFF * (2**attempt)
                    log.warning(
                        "Evolution API %s %s attempt %d/%d failed: %s — retrying in %.1fs",
                        method, path, attempt + 1, self.MAX_RETRIES, e, backoff,
                    )
                    await asyncio.sleep(backoff)
                    continue
                raise
        raise last_exc  # pragma: no cover

    def _text_delay_ms(self, text: str) -> int:
        """Compute a length-scaled, jittered compose delay for text."""
        chars = len(text or "")
        # Linear growth from FLOOR upward, capped at CEILING.
        scaled = self.COMPOSE_FLOOR_MS + chars * self.COMPOSE_PER_CHAR_MS
        scaled = min(scaled, self.COMPOSE_CEILING_MS)
        # ±15% jitter so two replies of the same length don't land at the
        # same latency — a deterministic latency is the easiest fingerprint.
        jittered = scaled * random.uniform(0.85, 1.15)
        return int(max(self.COMPOSE_FLOOR_MS, min(self.COMPOSE_CEILING_MS, jittered)))

    def _media_delay_ms(self) -> int:
        return int(random.uniform(self.MEDIA_DELAY_MIN_MS, self.MEDIA_DELAY_MAX_MS))

    def _audio_delay_ms(self) -> int:
        return int(random.uniform(self.AUDIO_DELAY_MIN_MS, self.AUDIO_DELAY_MAX_MS))

    async def _compose_pause(self, phone: str, presence: str, delay_ms: int) -> None:
        """
        Show a presence indicator and wait `delay_ms` before letting the
        caller actually send.

        Applied to every customer-facing send. The wait also doubles as a
        settle window for WhatsApp's E2EE pre-key handshake — Baileys-based
        clients sometimes ship messages before the recipient's pre-key
        bundle is fetched, leaving the recipient stuck on "Waiting for this
        message".

        `presence` is "composing" for text/buttons/lists/media (typing dots),
        "recording" for voice notes (mic-icon indicator). WhatsApp has no
        dedicated "uploading" state, so images/documents reuse "composing".
        """
        # Presence is best-effort; never block the send if it fails.
        try:
            await self._request(
                "POST",
                f"/chat/sendPresence/{self._instance}",
                json={
                    "number": phone,
                    "presence": presence,
                    "delay": delay_ms,
                },
            )
        except Exception as e:
            log.debug("presence %s failed (non-fatal): %s", presence, e)

        await asyncio.sleep(delay_ms / 1000)

    async def mark_as_read(self, remote_jid: str, message_id: str) -> None:
        """
        Mark an inbound customer message as read (the blue checkmarks).
        Best-effort — failures are logged and swallowed; not delivering a
        read receipt would only mean the customer doesn't see the blue ticks
        before the bot's reply, which is suboptimal UX but not catastrophic.

        Strong anti-bot signal: real humans read before they reply. Bots
        that skip read receipts are easier for WhatsApp to fingerprint.
        """
        try:
            await self._request(
                "POST",
                f"/chat/markMessageAsRead/{self._instance}",
                json={
                    "readMessages": [
                        {"remoteJid": remote_jid, "fromMe": False, "id": message_id}
                    ]
                },
            )
        except Exception as e:
            log.debug("markMessageAsRead failed (non-fatal): %s", e)

    async def send_text(self, phone: str, text: str) -> dict:
        """Send a text message with a length-scaled humanised pause."""
        await self._compose_pause(
            phone, presence="composing", delay_ms=self._text_delay_ms(text),
        )
        return await self._request(
            "POST", f"/message/sendText/{self._instance}",
            json={"number": phone, "text": text},
        )

    async def send_audio(self, phone: str, audio_base64: str) -> dict:
        await self._compose_pause(
            phone, presence="recording", delay_ms=self._audio_delay_ms(),
        )
        return await self._request(
            "POST", f"/message/sendWhatsAppAudio/{self._instance}",
            json={"number": phone, "audio": audio_base64},
        )

    async def send_buttons(self, phone: str, text: str, buttons: list[dict]) -> dict:
        await self._compose_pause(
            phone, presence="composing", delay_ms=self._text_delay_ms(text),
        )
        return await self._request(
            "POST", f"/message/sendButtons/{self._instance}",
            json={"number": phone, "text": text, "buttons": buttons},
        )

    async def send_list(
        self,
        phone: str,
        title: str,
        description: str,
        button_text: str,
        sections: list[dict],
        footer_text: Optional[str] = None,
    ) -> dict:
        await self._compose_pause(
            phone,
            presence="composing",
            delay_ms=self._text_delay_ms(f"{title} {description}"),
        )
        payload: dict[str, Any] = {
            "number": phone,
            "title": title,
            "description": description,
            "buttonText": button_text,
            "sections": sections,
        }
        if footer_text:
            payload["footerText"] = footer_text
        return await self._request(
            "POST", f"/message/sendList/{self._instance}", json=payload
        )

    async def send_media(
        self,
        phone: str,
        media_base64_or_url: str,
        media_type: str = "image",
        caption: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> dict:
        """Send image/video/document with a humanised compose pause."""
        await self._compose_pause(
            phone, presence="composing", delay_ms=self._media_delay_ms(),
        )
        payload: dict[str, Any] = {
            "number": phone,
            "mediatype": media_type,
            "media": media_base64_or_url,
        }
        if caption:
            payload["caption"] = caption
        if file_name:
            payload["fileName"] = file_name
        return await self._request(
            "POST", f"/message/sendMedia/{self._instance}", json=payload
        )

    async def download_media(self, message_id: str) -> Optional[bytes]:
        try:
            data = await self._request(
                "POST",
                f"/chat/getBase64FromMediaMessage/{self._instance}",
                json={"message": {"key": {"id": message_id}}},
            )
        except Exception as e:
            log.error("download_media failed: %s", e)
            return None
        b64 = data.get("base64") if isinstance(data, dict) else None
        if not b64:
            return None
        return base64.b64decode(b64)

    async def instance_status(self) -> dict:
        try:
            return await self._request("GET", f"/instance/connectionState/{self._instance}")
        except Exception as e:
            return {"state": "error", "error": str(e)}

    async def fetch_qr(self) -> dict:
        """Fetch QR code (base64) for instance pairing."""
        try:
            return await self._request("GET", f"/instance/connect/{self._instance}")
        except Exception as e:
            return {"error": str(e)}

    async def fetch_instance(self) -> dict:
        """
        Return the instance row from Evolution including the paired number,
        owner JID, profile name/picture, and connection status. Used by the
        admin panel to display 'who's currently linked'.
        """
        try:
            data = await self._request(
                "GET", f"/instance/fetchInstances?instanceName={self._instance}"
            )
        except Exception as e:
            return {"error": str(e)}
        if isinstance(data, list) and data:
            return data[0]
        return data if isinstance(data, dict) else {}

    async def logout_instance(self) -> dict:
        """
        Disconnect the currently paired WhatsApp number. The instance row
        survives, so the operator can scan a fresh QR with a different phone
        without recreating the integration.
        """
        try:
            return await self._request("DELETE", f"/instance/logout/{self._instance}")
        except Exception as e:
            return {"error": str(e)}

    async def delete_instance(self) -> dict:
        """Hard-delete the instance — clears all session data."""
        try:
            return await self._request("DELETE", f"/instance/delete/{self._instance}")
        except Exception as e:
            return {"error": str(e)}

    # Events the bot pipeline cares about. Other events (chats.upsert,
    # presence.update, etc.) are still emitted by Evolution but ignored by the
    # webhook handler; subscribing to too few events means Evolution drops
    # them on the server side, so we list every event our handler may rely
    # on for state tracking.
    WEBHOOK_EVENTS = [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "CONTACTS_UPDATE",
        "CHATS_UPDATE",
        "PRESENCE_UPDATE",
    ]

    def _webhook_payload(self) -> dict[str, Any]:
        return {
            "enabled": True,
            "url": "http://backend:8000/api/webhook/evolution",
            "webhookByEvents": False,
            "webhookBase64": False,
            "events": self.WEBHOOK_EVENTS,
        }

    async def create_instance(self) -> dict:
        """
        Create the instance with the project's standard config + per-instance
        webhook. Evolution v2.2.3's WEBHOOK_GLOBAL_* delivery is broken (the
        events get queued via the `sendData-Webhook-Global` job channel but
        the worker never makes the HTTP POST). The per-instance webhook uses
        a different code path and works. Idempotent: 403/409 from Evolution
        is treated as success, then we (re)bind the webhook explicitly.
        """
        payload = {
            "instanceName": self._instance,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
            "webhook": self._webhook_payload(),
        }
        try:
            result = await self._request("POST", "/instance/create", json=payload)
        except httpx.HTTPStatusError as e:
            if e.response is not None and e.response.status_code in (403, 409):
                result = {"status": "already_exists"}
            else:
                return {"error": str(e)}
        except Exception as e:
            return {"error": str(e)}

        # Always (re-)set the webhook — guards against Evolution silently
        # dropping the embedded webhook block on already-exists, and against
        # someone clearing it via the panel. Best-effort.
        try:
            await self._request(
                "POST",
                f"/webhook/set/{self._instance}",
                json={"webhook": self._webhook_payload()},
            )
        except Exception as e:
            log.warning("webhook bind after create failed (non-fatal): %s", e)

        return result

    async def ensure_webhook(self) -> dict:
        """Force-set the per-instance webhook. Called on backend startup so a
        fresh paired instance immediately starts delivering messages without
        waiting for someone to hit /reset in the panel."""
        try:
            return await self._request(
                "POST",
                f"/webhook/set/{self._instance}",
                json={"webhook": self._webhook_payload()},
            )
        except Exception as e:
            log.warning("ensure_webhook failed: %s", e)
            return {"error": str(e)}


client = EvolutionClient()

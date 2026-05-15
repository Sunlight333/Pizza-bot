"""
WhatsApp Cloud API client (Meta).

Replaces the old Evolution-based client. The module name is unchanged
so the rest of the backend (`from app.services.whatsapp import client`)
keeps working — only the implementation underneath changed.

What you need in .env (see app.config.Settings):
  META_ACCESS_TOKEN          permanent System User token
  META_APP_SECRET            for X-Hub-Signature-256 verification
  META_PHONE_NUMBER_ID       sender id (NOT the phone number)
  META_WABA_ID               WhatsApp Business Account id
  META_DISPLAY_PHONE_NUMBER  E.164 e.g. +5517991234567 (display only)
  META_VERIFY_TOKEN          freeform string for the webhook GET handshake
  META_GRAPH_VERSION         default "v22.0"

Outbound notes:
- Send text/audio/image with the Cloud API JSON envelope. Audio +
  image can be referenced by either a media_id (uploaded first via
  /media) or a public link. We upload bytes once and reuse the id —
  Meta caches uploads for 30 days, plenty for a single conversation.
- The 24-hour customer service window applies: outside it Meta only
  accepts pre-approved templates. The bot only ever replies inside
  the customer's session window, so this is mostly a non-issue, but
  admin-initiated messages from /conversations may fail outside the
  window. We surface Meta's error string so the operator can see why.

Inbound notes:
- Webhook payload normalization lives in app.api.routes.webhook —
  this module only handles outbound + media download.
- Media download is two steps: GET /{media_id} returns a short-lived
  URL; then GET <url> with the bearer token returns the bytes.
"""
from __future__ import annotations

import asyncio
import io
import logging
import random
from typing import Any, Optional

import httpx

from app.config import settings

log = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com"


class WhatsAppCloudClient:
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 0.5  # doubles each retry

    # Humanisation parameters carried over from the Evolution client. The
    # Cloud API has no presence indicator (no "typing…" dots), so the
    # only thing we can do is throttle outbound timing — readers still
    # get a more natural rhythm rather than instant blasts.
    COMPOSE_FLOOR_MS = 1500
    COMPOSE_CEILING_MS = 6000
    COMPOSE_PER_CHAR_MS = 30
    MEDIA_DELAY_MIN_MS = 2200
    MEDIA_DELAY_MAX_MS = 3800
    AUDIO_DELAY_MIN_MS = 1800
    AUDIO_DELAY_MAX_MS = 3000

    def __init__(self) -> None:
        self._token = settings.meta_access_token
        self._phone_id = settings.meta_phone_number_id
        self._version = settings.meta_graph_version or "v22.0"
        self._messages_url = f"{GRAPH_BASE}/{self._version}/{self._phone_id}/messages"
        self._media_url = f"{GRAPH_BASE}/{self._version}/{self._phone_id}/media"
        self._json_headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }
        self._auth_headers = {"Authorization": f"Bearer {self._token}"}

    @property
    def configured(self) -> bool:
        return bool(self._token and self._phone_id)

    # ---------- low-level request helper ----------

    async def _request(
        self,
        method: str,
        url: str,
        *,
        headers: Optional[dict[str, str]] = None,
        **kwargs: Any,
    ) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=30.0) as c:
                    r = await c.request(method, url, headers=headers, **kwargs)
                if r.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"server error {r.status_code}", request=r.request, response=r
                    )
                if r.status_code >= 400:
                    log.warning(
                        "Meta WhatsApp %s %s -> %s %s",
                        method, url, r.status_code, r.text[:400],
                    )
                    r.raise_for_status()
                return r
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as e:
                last_exc = e
                if attempt + 1 < self.MAX_RETRIES:
                    backoff = self.INITIAL_BACKOFF * (2**attempt)
                    log.warning(
                        "Meta WhatsApp %s %s attempt %d/%d failed: %s — retrying in %.1fs",
                        method, url, attempt + 1, self.MAX_RETRIES, e, backoff,
                    )
                    await asyncio.sleep(backoff)
                    continue
                raise
        raise last_exc  # pragma: no cover

    async def _post_message(self, payload: dict) -> dict:
        if not self.configured:
            log.error("Meta WhatsApp not configured (token/phone_id missing) — drop message")
            return {"error": "not_configured"}
        r = await self._request(
            "POST", self._messages_url, headers=self._json_headers, json=payload
        )
        try:
            return r.json()
        except Exception:
            return {}

    # ---------- humanisation ----------

    def _text_delay_ms(self, text: str) -> int:
        chars = len(text or "")
        scaled = self.COMPOSE_FLOOR_MS + chars * self.COMPOSE_PER_CHAR_MS
        scaled = min(scaled, self.COMPOSE_CEILING_MS)
        jittered = scaled * random.uniform(0.85, 1.15)
        return int(max(self.COMPOSE_FLOOR_MS, min(self.COMPOSE_CEILING_MS, jittered)))

    def _media_delay_ms(self) -> int:
        return int(random.uniform(self.MEDIA_DELAY_MIN_MS, self.MEDIA_DELAY_MAX_MS))

    def _audio_delay_ms(self) -> int:
        return int(random.uniform(self.AUDIO_DELAY_MIN_MS, self.AUDIO_DELAY_MAX_MS))

    @staticmethod
    def _normalize_to(phone: str) -> str:
        """Meta wants digits-only E.164 with no leading + and no @suffix.

        Inbound payloads already deliver `wa_id` as digits-only; admin-typed
        numbers from the panel may still arrive as "+5517...", "(17) 9...",
        or with a stray "@s.whatsapp.net" suffix carried over from Evolution
        days. Normalize defensively.
        """
        s = (phone or "").split("@")[0]
        return "".join(ch for ch in s if ch.isdigit())

    # ---------- outbound: text / audio / image ----------

    async def mark_as_read(self, message_id: str) -> None:
        """Send the read receipt for an inbound message id (wamid.XXX).

        Best-effort. Anti-bot signal — bots that never read are easy to
        fingerprint. Cloud API uses the same /messages endpoint with a
        status payload (different shape from Evolution).
        """
        if not message_id or not self.configured:
            return
        try:
            await self._post_message({
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id,
            })
        except Exception as e:
            log.debug("mark_as_read failed (non-fatal): %s", e)

    async def send_text(self, phone: str, text: str) -> dict:
        await asyncio.sleep(self._text_delay_ms(text) / 1000)
        return await self._post_message({
            "messaging_product": "whatsapp",
            "to": self._normalize_to(phone),
            "type": "text",
            "text": {"preview_url": True, "body": text},
        })

    async def _upload_media(
        self, data: bytes, *, mime_type: str, filename: str
    ) -> Optional[str]:
        """Upload bytes to /media and return the media_id.

        Meta caches uploads for 30 days. We re-upload per send rather than
        cache ids ourselves because the bot's image flow is small (one
        menu image per request) and the cache invalidation logic isn't
        worth the complexity — Meta's CDN handles the heavy lifting.
        """
        if not self.configured:
            return None
        files = {
            "file": (filename, io.BytesIO(data), mime_type),
            "type": (None, mime_type),
            "messaging_product": (None, "whatsapp"),
        }
        try:
            r = await self._request(
                "POST", self._media_url, headers=self._auth_headers, files=files,
            )
            j = r.json()
            return j.get("id")
        except Exception as e:
            log.error("Meta media upload failed: %s", e)
            return None

    async def send_audio(
        self, phone: str, audio_bytes: bytes, *, mime_type: str = "audio/ogg"
    ) -> dict:
        """Send a voice note. Bytes must be ogg/opus for the inline mic UI.

        Signature change vs Evolution client: takes raw bytes, not base64.
        Callers that have base64 already should decode before calling
        (callers/conversations.py is updated accordingly).
        """
        await asyncio.sleep(self._audio_delay_ms() / 1000)
        media_id = await self._upload_media(
            audio_bytes, mime_type=mime_type, filename="voice.ogg"
        )
        if not media_id:
            return {"error": "upload_failed"}
        return await self._post_message({
            "messaging_product": "whatsapp",
            "to": self._normalize_to(phone),
            "type": "audio",
            "audio": {"id": media_id},
        })

    async def send_media(
        self,
        phone: str,
        data: bytes,
        *,
        media_type: str = "image",  # "image" | "document" | "video"
        mime_type: str = "image/jpeg",
        caption: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> dict:
        """Send an image/document/video as raw bytes.

        Caller must pass bytes (not URL or base64) — for menu images this
        is what `ai_engine.send_menu_image` already reads off disk. The old
        Evolution client accepted URL-or-base64; Cloud API takes media_id
        (after upload) or a public link. We always upload because some of
        the menu image URLs (/media/products/<file>) aren't publicly
        reachable from Meta's network behind the host nginx.
        """
        await asyncio.sleep(self._media_delay_ms() / 1000)
        media_id = await self._upload_media(
            data, mime_type=mime_type, filename=filename or "file.bin",
        )
        if not media_id:
            return {"error": "upload_failed"}
        body: dict[str, Any] = {"id": media_id}
        if caption and media_type in ("image", "video", "document"):
            body["caption"] = caption
        if filename and media_type == "document":
            body["filename"] = filename
        return await self._post_message({
            "messaging_product": "whatsapp",
            "to": self._normalize_to(phone),
            "type": media_type,
            media_type: body,
        })

    # ---------- inbound media download ----------

    async def download_media(self, media_id: str) -> Optional[bytes]:
        """Two-hop fetch: media_id → short-lived URL → bytes.

        Inbound webhooks carry media_id (audio/image). This is symmetric
        with Evolution's getBase64FromMediaMessage but uses Meta's URL
        flow + bearer auth instead.
        """
        if not media_id or not self.configured:
            return None
        meta_url = f"{GRAPH_BASE}/{self._version}/{media_id}"
        try:
            r = await self._request("GET", meta_url, headers=self._auth_headers)
            url = r.json().get("url")
            if not url:
                return None
            r2 = await self._request("GET", url, headers=self._auth_headers)
            return r2.content
        except Exception as e:
            log.error("download_media(%s) failed: %s", media_id, e)
            return None


client = WhatsAppCloudClient()

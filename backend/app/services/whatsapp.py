"""
WhatsApp Cloud API client (Meta).

Sole WhatsApp transport for the bot. All inbound + outbound traffic
goes through this module via Meta's Graph API.

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

    # Humanisation parameters. The Cloud API has no presence indicator
    # (no "typing…" dots), so the only thing we can do is throttle
    # outbound timing — readers still get a more natural rhythm rather
    # than instant blasts. Tightened 2026-05-20 after a real exchange
    # showed 5s of pure throttle on top of an already-slow LLM round
    # trip. Cloud API bots are officially registered so we no longer
    # need the anti-fingerprint padding the Evolution-era values had.
    COMPOSE_FLOOR_MS = 400
    COMPOSE_CEILING_MS = 1500
    COMPOSE_PER_CHAR_MS = 12
    MEDIA_DELAY_MIN_MS = 800
    MEDIA_DELAY_MAX_MS = 1500
    AUDIO_DELAY_MIN_MS = 700
    AUDIO_DELAY_MAX_MS = 1300

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
                # 4xx errors are deterministic ("bad token", "phone not in
                # allowed list", "template not approved"), so retrying just
                # wastes time + clutters logs. Raise immediately without
                # entering the retry loop — caller decides how to handle.
                if 400 <= r.status_code < 500:
                    log.warning(
                        "Meta WhatsApp %s %s -> %s %s",
                        method, url, r.status_code, r.text[:400],
                    )
                    r.raise_for_status()
                # 5xx is transient (Meta capacity / network blip), worth
                # retrying with backoff.
                if r.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"server error {r.status_code}", request=r.request, response=r
                    )
                return r
            except httpx.HTTPStatusError as e:
                # 4xx — don't retry, re-raise immediately.
                if e.response is not None and 400 <= e.response.status_code < 500:
                    raise
                last_exc = e
            except (httpx.TimeoutException, httpx.NetworkError) as e:
                last_exc = e
            # Got here from a 5xx or network failure — retry with backoff.
            if attempt + 1 < self.MAX_RETRIES:
                backoff = self.INITIAL_BACKOFF * (2**attempt)
                log.warning(
                    "Meta WhatsApp %s %s attempt %d/%d failed: %s — retrying in %.1fs",
                    method, url, attempt + 1, self.MAX_RETRIES, last_exc, backoff,
                )
                await asyncio.sleep(backoff)
                continue
            raise last_exc
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
        numbers from the panel may arrive as "+5517...", "(17) 9...", or
        with a stray "@s.whatsapp.net" / "@lid" suffix from older stored
        rows. Normalize defensively.
        """
        s = (phone or "").split("@")[0]
        return "".join(ch for ch in s if ch.isdigit())

    # ---------- outbound: text / audio / image ----------

    async def mark_as_read(self, message_id: str) -> None:
        """Send the read receipt for an inbound message id (wamid.XXX).

        Best-effort. Anti-bot signal — bots that never read are easy for
        WhatsApp to fingerprint. Cloud API delivers read receipts via the
        same /messages endpoint with a `status: read` payload.
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

    async def send_template(
        self,
        phone: str,
        *,
        name: str,
        language: str = "pt_BR",
        body_params: Optional[list[str]] = None,
        button_params: Optional[list[str]] = None,
    ) -> dict:
        """Send a Meta-approved message template.

        Required for any send that's outside the 24-hour customer service
        window — admin alerts, OTP delivery to a customer who never messaged
        the bot, marketing pings, post-delivery follow-ups, etc.

        Args:
          name: template name registered at Meta (must match exactly, case
                sensitive). Templates are submitted via WhatsApp Manager →
                Message Templates and need 1-24h approval per template.
          language: BCP-47 lang code. We default pt_BR because every
                template in this project targets Brazil.
          body_params: positional substitutions for {{1}}, {{2}}, ... in
                the template body. Pass [] (or omit) if the template has
                no placeholders.
          button_params: positional substitutions for button URLs/copy-code
                values. For an AUTHENTICATION template with a one-time-
                password button, this carries the actual code.

        Returns the Graph response dict (`{messages: [{id: wamid...}]}`
        on success, `{error: ...}` on failure). Caller decides whether to
        retry / fall back to text / surface the error.
        """
        components: list[dict[str, Any]] = []
        if body_params:
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in body_params],
            })
        if button_params:
            # Index 0 here means "first button" — matches Meta's spec for
            # AUTHENTICATION templates where the OTP button is index 0.
            components.append({
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [
                    {"type": "text", "text": str(p)} for p in button_params
                ],
            })
        payload = {
            "messaging_product": "whatsapp",
            "to": self._normalize_to(phone),
            "type": "template",
            "template": {
                "name": name,
                "language": {"code": language},
                **({"components": components} if components else {}),
            },
        }
        return await self._post_message(payload)

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

        Takes raw bytes; if a caller has base64, decode before calling.
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
        is what `ai_engine.send_menu_image` already reads off disk. Cloud
        API accepts a media_id (after upload) or a public link; we always
        upload because some of the menu image URLs (/media/products/<file>)
        aren't publicly reachable from Meta's network behind the host nginx.
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

        Inbound webhooks only carry the media_id; Meta requires a separate
        GET /{media_id} to obtain a short-lived URL, then a second GET on
        that URL (with the same bearer token) to fetch the bytes.
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

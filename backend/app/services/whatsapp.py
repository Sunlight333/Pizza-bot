"""
Evolution API v2 client — text/list/buttons/media + retry with exponential backoff.
"""
import asyncio
import base64
import logging
from typing import Any, Optional

import httpx

from app.config import settings

log = logging.getLogger(__name__)


class EvolutionClient:
    MAX_RETRIES = 3
    INITIAL_BACKOFF = 0.5  # seconds — doubles each retry

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

    async def send_text(self, phone: str, text: str) -> dict:
        return await self._request(
            "POST", f"/message/sendText/{self._instance}",
            json={"number": phone, "text": text},
        )

    async def send_audio(self, phone: str, audio_base64: str) -> dict:
        return await self._request(
            "POST", f"/message/sendWhatsAppAudio/{self._instance}",
            json={"number": phone, "audio": audio_base64},
        )

    async def send_buttons(self, phone: str, text: str, buttons: list[dict]) -> dict:
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
        """Send image/video/document. media_type: image|video|document."""
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


client = EvolutionClient()

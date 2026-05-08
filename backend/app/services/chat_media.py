"""Save inbound/outbound chat media (images, audio) to /app/media/chats.

Returns the public `/media/chats/<file>` URL the admin chat viewer will hit.
A small wrapper around the same media-root the StaticFiles mount in main.py
serves; keeps file-naming + extension-guess logic in one place.
"""
from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path
from typing import Optional, Tuple

CHAT_MEDIA_DIR = Path(__file__).resolve().parents[2] / "media" / "chats"

# Audio: WhatsApp voice notes arrive as Opus in Ogg. Common image MIME types.
_EXT_BY_MIME = {
    "audio/ogg": ".ogg",
    "audio/ogg; codecs=opus": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/webm; codecs=opus": ".webm",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _guess_ext(content_type: Optional[str], filename: Optional[str]) -> str:
    if content_type:
        ext = _EXT_BY_MIME.get(content_type.lower())
        if ext:
            return ext
        # Generic fallback (handles e.g. "audio/ogg; codecs=opus" with extras)
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext:
            return ext
    if filename:
        ext = Path(filename).suffix.lower()
        if ext:
            return ext
    return ".bin"


def save_chat_media(
    raw: bytes,
    *,
    media_type: str,
    content_type: Optional[str] = None,
    filename: Optional[str] = None,
) -> Tuple[str, Path]:
    """Persist `raw` bytes under /app/media/chats and return (public_url, path).

    media_type must be "image" or "audio". The file extension is guessed
    from content_type + filename so the admin browser can stream it without
    a forced download.
    """
    if media_type not in ("image", "audio"):
        raise ValueError(f"unsupported media_type: {media_type}")

    CHAT_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    ext = _guess_ext(content_type, filename)
    name = f"{uuid.uuid4().hex}{ext}"
    path = CHAT_MEDIA_DIR / name
    path.write_bytes(raw)
    return f"/media/chats/{name}", path

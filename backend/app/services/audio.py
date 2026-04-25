"""Audio transcription via OpenAI Whisper."""
import io
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.config import settings

log = logging.getLogger(__name__)

_client: Optional[AsyncOpenAI] = None


def _openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.ogg") -> Optional[str]:
    """
    Transcribe via Whisper. Returns the transcript string or None on failure.
    WhatsApp PTT messages are Opus in OGG — Whisper handles this natively.
    """
    if not audio_bytes:
        return None
    try:
        resp = await _openai().audio.transcriptions.create(
            model="whisper-1",
            file=(filename, io.BytesIO(audio_bytes)),
            language="pt",
        )
        return resp.text
    except Exception as e:
        log.error("Whisper transcription failed: %s", e)
        return None

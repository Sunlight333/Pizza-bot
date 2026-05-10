"""WhatsApp OTP for the customer portal.

Code lifecycle:
  - generate_and_send(phone) — picks a random 6-digit code, stores it in
    Redis with a 10-min TTL and 0 attempts, sends via Evolution.
  - verify(phone, code) — checks against the stored code; consumes on
    success; increments and bounces on failure (max 3 tries).

Phone normalization: digits only, no leading '+'. Brazilian numbers come
out as 11-13 digits (55 + DDD + number). Matches the format the rest of
the project uses on `customers.phone`.
"""
from __future__ import annotations

import json
import logging
import random
import re
from typing import Optional

import redis.asyncio as redis

from app.config import settings
from app.services.whatsapp import client as wa_client

log = logging.getLogger(__name__)

OTP_TTL_SECONDS = 10 * 60
OTP_MAX_ATTEMPTS = 3
OTP_LENGTH = 6

_redis: Optional[redis.Redis] = None


def _client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _key(phone: str) -> str:
    return f"otp:{phone}"


def normalize_phone(raw: str) -> str:
    """Digits-only. Adds '55' country prefix when caller passed a 10/11-digit
    Brazilian number without it. Returns '' for unparseable input."""
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""
    if len(digits) in (10, 11):
        digits = "55" + digits
    return digits


def _gen_code() -> str:
    return f"{random.randint(0, 10**OTP_LENGTH - 1):0{OTP_LENGTH}d}"


async def generate_and_send(phone: str) -> dict:
    """Issue a new OTP and dispatch via WhatsApp.

    Returns {'sent': True} on success. Always overwrites any prior code
    for the same phone so a "resend" gets a fresh code + reset attempt
    counter.
    """
    code = _gen_code()
    payload = json.dumps({"code": code, "attempts": 0})
    await _client().set(_key(phone), payload, ex=OTP_TTL_SECONDS)

    text = (
        f"Seu código de acesso é *{code}*.\n"
        f"Válido por 10 minutos. Se você não solicitou, ignore esta mensagem."
    )
    try:
        await wa_client.send_text(phone, text)
    except Exception as e:
        # If the send failed, drop the stored code so the customer can try
        # again immediately rather than waiting for TTL expiry.
        await _client().delete(_key(phone))
        log.exception("otp.generate_and_send: WhatsApp send failed for %s", phone)
        raise RuntimeError("Falha ao enviar o código pelo WhatsApp") from e

    log.info("otp issued for %s", phone)
    return {"sent": True}


async def verify(phone: str, code: str) -> dict:
    """Validate `code` against the stored OTP. Consumes on success.

    Returns {'ok': True} on match, otherwise {'ok': False, 'reason': str}
    where reason is one of: 'expired', 'attempts_exhausted', 'mismatch'.
    """
    raw = await _client().get(_key(phone))
    if not raw:
        return {"ok": False, "reason": "expired"}
    state = json.loads(raw)

    if state["code"] == (code or "").strip():
        await _client().delete(_key(phone))
        return {"ok": True}

    state["attempts"] = int(state.get("attempts", 0)) + 1
    if state["attempts"] >= OTP_MAX_ATTEMPTS:
        await _client().delete(_key(phone))
        return {"ok": False, "reason": "attempts_exhausted"}

    # Preserve the remaining TTL to avoid extending the validity window
    # on every wrong guess.
    ttl = await _client().ttl(_key(phone))
    await _client().set(_key(phone), json.dumps(state), ex=max(ttl, 1))
    return {"ok": False, "reason": "mismatch"}

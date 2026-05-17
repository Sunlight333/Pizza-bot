"""WhatsApp OTP for the customer portal.

Code lifecycle:
  - generate_and_send(phone) — picks a random 6-digit code, stores it in
    Redis with a 10-min TTL and 0 attempts, sends via Meta WhatsApp.
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
    """Digits-only Brazilian mobile in international format (5511999999999).

    Brazil mobile = 2-digit DDD + 9-digit local (1 prefix + 8 number) =
    11 local digits, 13 international. Landlines (10 local) and any other
    length aren't valid WhatsApp targets, so the OTP send would fail
    silently — better to reject up front and let the UI explain.

    Accepts:
      11 digits raw   → assume DDD+mobile, prepend 55                (normal case)
      13 digits raw   → already international (must start with 55)   (paste case)
      12 digits raw starting with 55 → operator pasted the legacy
        10-digit landline format with country code prepended; reject
        (no leading 9 = not a mobile = no WhatsApp).

    Returns '' for anything else.
    """
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""
    if len(digits) == 11:
        # 11 local digits: DDD (2) + mobile (9). Must be a mobile (9-prefix).
        if digits[2] != "9":
            return ""
        return "55" + digits
    if len(digits) == 13 and digits.startswith("55"):
        # Already international. Must still be a mobile (9 in position 4).
        if digits[4] != "9":
            return ""
        return digits
    return ""


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

    # OTP delivery has a serious 24h-window problem: customers logging
    # into the portal often have NEVER messaged the bot, so freeform
    # WhatsApp send returns 131047 and the code never arrives.
    # The fix is an AUTHENTICATION-category Meta template (which works
    # any time, no window restriction, AND renders WhatsApp's native
    # "Copy code" button). Use it when configured; fall back to text
    # (works during dev/staging when admin sends the first message
    # to themselves).
    template_name = settings.meta_template_otp
    text_fallback = (
        f"Seu código de acesso é *{code}*.\n"
        f"Válido por 10 minutos. Se você não solicitou, ignore esta mensagem."
    )
    try:
        if template_name:
            res = await wa_client.send_template(
                phone,
                name=template_name,
                language="pt_BR",
                body_params=[code],
                button_params=[code],  # populates the one-time-password button
            )
            if isinstance(res, dict) and res.get("error"):
                # Template configured but Meta rejected (typo, not approved
                # yet, etc). Try freeform — better than failing silently.
                log.warning(
                    "otp template %s failed for %s: %s — falling back to text",
                    template_name, phone, res.get("error"),
                )
                await wa_client.send_text(phone, text_fallback)
        else:
            await wa_client.send_text(phone, text_fallback)
    except Exception as e:
        # If the send failed, drop the stored code so the customer can try
        # again immediately rather than waiting for TTL expiry.
        await _client().delete(_key(phone))
        log.exception("otp.generate_and_send: WhatsApp send failed for %s", phone)
        raise RuntimeError("Falha ao enviar o código pelo WhatsApp") from e

    log.info("otp issued for %s (template=%s)", phone, bool(template_name))
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

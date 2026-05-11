"""Two-factor login + register session state for the customer portal.

Customer auth is now a two-step flow:
  - Login:    email + password  →  WhatsApp OTP  →  session cookie
  - Register: name + email + password + phone  →  WhatsApp OTP  →  session cookie

Between the two steps we hold a short-lived "intent" in Redis under a
random opaque token the client carries forward. The token decouples the
two stages so the client never holds the OTP code itself, and so a
leaked token is useless after 10 min.

For LOGIN: the intent stores {customer_id, code, attempts}. The first
factor (password) has already been verified server-side.

For REGISTER: the intent stores {register: {name, email, password_hash,
phone}, code, attempts}. The account isn't created until OTP is verified
— prevents half-registered rows on abandon.
"""
from __future__ import annotations

import json
import logging
import random
import re
import secrets
from typing import Optional

import redis.asyncio as redis

from app.config import settings
from app.services.whatsapp import client as wa_client

log = logging.getLogger(__name__)

INTENT_TTL_SECONDS = 10 * 60
MAX_ATTEMPTS = 3
OTP_LENGTH = 6

_redis: Optional[redis.Redis] = None


def _client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _gen_code() -> str:
    return f"{random.randint(0, 10**OTP_LENGTH - 1):0{OTP_LENGTH}d}"


def _gen_token() -> str:
    return secrets.token_urlsafe(32)


def mask_phone(phone: str) -> str:
    """E.g. 5543998150536 → '+55 43 ****-0536'."""
    d = re.sub(r"\D", "", phone or "")
    if len(d) < 10:
        return ""
    tail = d[-4:]
    return f"+{d[:2]} {d[2:4]} ****-{tail}"


def _key(token: str) -> str:
    return f"login_intent:{token}"


async def _send_otp(phone: str, code: str) -> None:
    text = (
        f"Seu código de acesso é *{code}*.\n"
        f"Válido por 10 minutos. Se você não solicitou, ignore esta mensagem."
    )
    await wa_client.send_text(phone, text)


# ---------- LOGIN intent ----------

async def initiate_login(customer_id: int, phone: str) -> dict:
    """Stage 2 of login: password is correct, now send OTP. Returns
    {token, phone_hint} that the client passes to /verify."""
    code = _gen_code()
    token = _gen_token()
    state = {
        "kind": "login",
        "customer_id": customer_id,
        "code": code,
        "attempts": 0,
    }
    await _client().set(_key(token), json.dumps(state), ex=INTENT_TTL_SECONDS)
    await _send_otp(phone, code)
    log.info("login intent issued for customer_id=%s", customer_id)
    return {"token": token, "phone_hint": mask_phone(phone)}


async def initiate_register(*, name: str, email: str, password_hash: str, phone: str) -> dict:
    """Stage 1 of register: collect data + send OTP, but don't create
    the account until OTP is verified."""
    code = _gen_code()
    token = _gen_token()
    state = {
        "kind": "register",
        "register": {
            "name": name,
            "email": email,
            "password_hash": password_hash,
            "phone": phone,
        },
        "code": code,
        "attempts": 0,
    }
    await _client().set(_key(token), json.dumps(state), ex=INTENT_TTL_SECONDS)
    await _send_otp(phone, code)
    log.info("register intent issued for email=%s", email)
    return {"token": token, "phone_hint": mask_phone(phone)}


async def resend_otp(token: str) -> dict:
    """Re-issue an OTP for an in-flight login or register intent.
    Resets the attempt counter and refreshes TTL."""
    raw = await _client().get(_key(token))
    if not raw:
        return {"ok": False, "reason": "expired"}
    state = json.loads(raw)
    code = _gen_code()
    state["code"] = code
    state["attempts"] = 0
    await _client().set(_key(token), json.dumps(state), ex=INTENT_TTL_SECONDS)
    phone = (
        state["register"]["phone"]
        if state["kind"] == "register"
        else None
    )
    if phone is None:
        # login intent — phone isn't in the state; caller must look it up
        return {"ok": True, "code": code, "phone_required": True}
    try:
        await _send_otp(phone, code)
    except Exception:
        log.exception("resend OTP send failed")
        return {"ok": False, "reason": "send_failed"}
    return {"ok": True}


async def verify(token: str, code: str) -> dict:
    """Validate the submitted OTP against the intent. Consumes the
    intent on success.

    Returns one of:
      {"ok": True, "kind": "login", "customer_id": int}
      {"ok": True, "kind": "register", "register": {...}}
      {"ok": False, "reason": "expired" | "attempts_exhausted" | "mismatch"}
    """
    raw = await _client().get(_key(token))
    if not raw:
        return {"ok": False, "reason": "expired"}
    state = json.loads(raw)

    if state["code"] == (code or "").strip():
        await _client().delete(_key(token))
        if state["kind"] == "login":
            return {"ok": True, "kind": "login", "customer_id": state["customer_id"]}
        return {"ok": True, "kind": "register", "register": state["register"]}

    state["attempts"] = int(state.get("attempts", 0)) + 1
    if state["attempts"] >= MAX_ATTEMPTS:
        await _client().delete(_key(token))
        return {"ok": False, "reason": "attempts_exhausted"}
    ttl = await _client().ttl(_key(token))
    await _client().set(_key(token), json.dumps(state), ex=max(ttl, 1))
    return {"ok": False, "reason": "mismatch"}


def normalize_phone(raw: str) -> str:
    """Normalize a WhatsApp phone for OTP delivery.

    Accepts:
      - Brazilian mobile: 11 digits local (DDD + 9 + 8) → prepend 55
      - Brazilian mobile already international (5511...): pass through
      - Any international 8-15 digit number → pass through

    Brazilian-specific check: if the digits look Brazilian (10 or 11
    digits, or 12-13 starting with 55) we enforce the 9-prefix rule
    because mobiles without a 9 are landlines and have no WhatsApp.
    Other countries don't get format checks beyond E.164 length bounds.

    Returns '' for unparseable / clearly invalid inputs.
    """
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""

    # Brazilian: 11 local (DDD + 9XXXXXXXX). Mobiles must have 9 prefix.
    if len(digits) == 11:
        if digits[2] != "9":
            return ""
        return "55" + digits

    # 10 local digits = pre-9 Brazilian or landline; reject (no WhatsApp).
    if len(digits) == 10:
        return ""

    # International 12+ digits already with country code.
    if len(digits) == 12 and digits.startswith("55"):
        # 55 + 10-digit landline — reject.
        return ""
    if len(digits) == 13 and digits.startswith("55"):
        return digits if digits[4] == "9" else ""

    # Non-Brazilian international. E.164 is min 8 (e.g. small islands)
    # max 15 digits including country code.
    if 8 <= len(digits) <= 15:
        return digits

    return ""


def detect_brazilian_format_issue(raw: str) -> str | None:
    """Return a friendly hint string when the input *looks* like a
    Brazilian number but is missing the mobile 9 prefix or the country
    code. Returns None when the input is fine or not Brazilian-shaped.
    """
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 10:
        # Could be DDD + 8-digit (pre-2014 mobile or landline). Suggest
        # the 9 prefix since most users mean a mobile.
        return (
            "Faltou o 9 inicial. Celulares brasileiros têm 11 dígitos "
            "depois do DDD, começando com 9."
        )
    if len(digits) == 11 and digits[2] != "9":
        return "Celulares brasileiros têm um 9 logo após o DDD."
    if len(digits) == 12 and digits.startswith("55"):
        return "Faltou o 9 inicial no número de celular."
    if len(digits) == 13 and digits.startswith("55") and digits[4] != "9":
        return "Celulares brasileiros têm um 9 logo após o DDD."
    return None

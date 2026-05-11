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


# Brazilian DDDs in active use (2-digit area codes). Used to disambiguate
# 11-digit inputs: a leading DDD in this set + "9" at position 2 means
# the user typed a Brazilian mobile without the 55 country prefix.
# Source: ANATEL plan; we list every valid DDD so US 11-digit numbers
# (which start with 1) and other countries are treated as international.
BR_DDDS = {
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    21, 22, 24, 27, 28,
    31, 32, 33, 34, 35, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48, 49,
    51, 53, 54, 55,
    61, 62, 63, 64, 65, 66, 67, 68, 69,
    71, 73, 74, 75, 77, 79,
    81, 82, 83, 84, 85, 86, 87, 88, 89,
    91, 92, 93, 94, 95, 96, 97, 98, 99,
}


def _looks_brazilian_local(digits: str) -> bool:
    """True if `digits` looks like a Brazilian local number (DDD + ...)
    without the 55 country prefix."""
    if len(digits) not in (10, 11):
        return False
    try:
        return int(digits[:2]) in BR_DDDS
    except ValueError:
        return False


def normalize_phone(raw: str) -> str:
    """Normalize a WhatsApp phone for OTP delivery.

    Accepts any international 8-15 digit number. For inputs that look
    Brazilian (DDD in the ANATEL list, no country code), enforce the
    post-2014 mobile "9" prefix rule so we don't accidentally send to a
    landline that has no WhatsApp.

    Disambiguation: 11 digits is ambiguous between Brazilian local
    (DDD + 9 + 8) and country-code-1 international (US/Canada: 1 + 10).
    Leading "1" wins → US/Canada; otherwise Brazilian-shape check
    applies. Users can always force international by prefixing with
    the country code (e.g. "+55..." for Brazilian).

    Returns '' for unparseable inputs and Brazilian-shaped inputs that
    are missing the 9 prefix.
    """
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""

    # Country code 1 (US/Canada/Caribbean): always 11 digits with leading
    # 1. Take precedence over Brazilian-DDD interpretation.
    if len(digits) == 11 and digits[0] == "1":
        return digits

    # Brazilian without country code:
    #   11 digits = DDD (2) + mobile (9) — must have the 9 prefix
    #   10 digits = DDD (2) + landline (8) — no WhatsApp, reject
    if len(digits) == 11 and _looks_brazilian_local(digits):
        return "55" + digits if digits[2] == "9" else ""
    if len(digits) == 10 and _looks_brazilian_local(digits):
        return ""

    # Brazilian with country code (55):
    #   13 = 55 + DDD + 9 + 8 digits
    #   12 = 55 + DDD + 8 digits (landline) — reject
    if len(digits) == 13 and digits.startswith("55") and int(digits[2:4]) in BR_DDDS:
        return digits if digits[4] == "9" else ""
    if len(digits) == 12 and digits.startswith("55") and int(digits[2:4]) in BR_DDDS:
        return ""

    # Anything else: international E.164 (8-15 digits). Pass through.
    if 8 <= len(digits) <= 15:
        return digits

    return ""


def detect_brazilian_format_issue(raw: str) -> str | None:
    """Return a friendly hint when the input *looks* Brazilian but is
    missing the mobile 9 prefix. Returns None for genuine international
    numbers (which normalize_phone accepts) and for inputs we have no
    specific advice for.

    Skips the US/Canada case (leading 1) so a US number that happens to
    be 11 digits doesn't get a Brazilian message.
    """
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits[0] == "1":
        return None
    if len(digits) == 10 and _looks_brazilian_local(digits):
        return (
            "Faltou o 9 inicial. Celulares brasileiros têm 11 dígitos "
            "depois do DDD, começando com 9."
        )
    if len(digits) == 11 and _looks_brazilian_local(digits) and digits[2] != "9":
        return "Celulares brasileiros têm um 9 logo após o DDD."
    if (
        len(digits) == 12
        and digits.startswith("55")
        and int(digits[2:4]) in BR_DDDS
    ):
        return "Faltou o 9 inicial no número de celular."
    if (
        len(digits) == 13
        and digits.startswith("55")
        and int(digits[2:4]) in BR_DDDS
        and digits[4] != "9"
    ):
        return "Celulares brasileiros têm um 9 logo após o DDD."
    return None

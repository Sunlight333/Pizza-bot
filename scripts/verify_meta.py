#!/usr/bin/env python3
"""
One-shot Meta WhatsApp Cloud API diagnostic.

Reads /opt/pizzabot/.env (or the path in $PIZZA_ENV) and runs every
Graph probe relevant to the bot — token validity + scopes, phone
binding, WABA reachability, template inventory, subscribed_apps for
the webhook. Prints PASS/FAIL per check plus the exact Meta error
envelope on any failure, so a fresh operator can tell #190 (revoked
token) from #100 (wrong id) from #2494160 (phone not registered)
without reading source.

Run from any machine with outbound HTTPS to graph.facebook.com:

    python3 scripts/verify_meta.py

Or against a non-default env file:

    PIZZA_ENV=/path/to/.env python3 scripts/verify_meta.py

Exit code is 0 only if every check passes. Useful as a smoke test
after rotating the token or running /register.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional


def load_env(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k, v = s.split("=", 1)
                out[k.strip()] = v.strip()
    except FileNotFoundError:
        print(f"FATAL: env file not found at {path}")
        sys.exit(2)
    return out


def graph_get(url: str, token: str) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read() or b""
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body.decode("utf-8", errors="replace")[:400]}
    except Exception as e:
        return 0, {"transport_error": str(e)}


def fmt_error(payload: dict[str, Any]) -> str:
    err = payload.get("error") or {}
    code = err.get("code")
    sub = err.get("error_subcode")
    msg = err.get("message") or payload.get("transport_error") or payload.get("raw") or "unknown"
    parts = [f"code={code}"]
    if sub is not None:
        parts.append(f"subcode={sub}")
    parts.append(f"message={msg}")
    return " ".join(parts)


class Report:
    def __init__(self) -> None:
        self.failed = 0

    def ok(self, name: str, detail: str = "") -> None:
        line = f"  PASS  {name}"
        if detail:
            line += f"   -> {detail}"
        print(line)

    def fail(self, name: str, detail: str, remediation: Optional[str] = None) -> None:
        self.failed += 1
        print(f"  FAIL  {name}   -> {detail}")
        if remediation and "transport" not in detail.lower() and "timed out" not in detail.lower():
            print(f"        fix:  {remediation}")

    def warn(self, name: str, detail: str) -> None:
        print(f"  WARN  {name}   -> {detail}")


def section(title: str) -> None:
    print()
    print(title)
    print("-" * len(title))


def main() -> int:
    env_path = os.environ.get("PIZZA_ENV", "/opt/pizzabot/.env")
    if not os.path.exists(env_path):
        local = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        if os.path.exists(local):
            env_path = local
    print(f"Reading env from: {env_path}")
    env = load_env(env_path)

    token = env.get("META_ACCESS_TOKEN", "")
    app_secret = env.get("META_APP_SECRET", "")
    phone_id = env.get("META_PHONE_NUMBER_ID", "")
    waba_id = env.get("META_WABA_ID", "")
    verify_token = env.get("META_VERIFY_TOKEN", "")
    display = env.get("META_DISPLAY_PHONE_NUMBER", "")
    version = env.get("META_GRAPH_VERSION", "v22.0")
    templates = {
        "META_TEMPLATE_OTP": env.get("META_TEMPLATE_OTP", ""),
        "META_TEMPLATE_ADMIN_ALERT": env.get("META_TEMPLATE_ADMIN_ALERT", ""),
        "META_TEMPLATE_HANDOFF_CUSTOMER": env.get("META_TEMPLATE_HANDOFF_CUSTOMER", ""),
        "META_TEMPLATE_ORDER_STATUS": env.get("META_TEMPLATE_ORDER_STATUS", ""),
    }
    base = f"https://graph.facebook.com/{version}"

    r = Report()

    section("Step 1. env keys present")
    for k, v in [
        ("META_ACCESS_TOKEN", token),
        ("META_APP_SECRET", app_secret),
        ("META_PHONE_NUMBER_ID", phone_id),
        ("META_WABA_ID", waba_id),
        ("META_VERIFY_TOKEN", verify_token),
        ("META_DISPLAY_PHONE_NUMBER", display),
        ("META_GRAPH_VERSION", version),
    ]:
        if v:
            r.ok(k, f"len={len(v)}" if k.endswith("TOKEN") or k.endswith("SECRET") else v)
        else:
            r.fail(k, "missing", "fill it in the env file, see .env.example for source")

    section("Step 2. debug_token (token validity + scopes)")
    if not token:
        r.fail("debug_token", "no token to debug", "set META_ACCESS_TOKEN first")
    else:
        url = f"{base}/debug_token?input_token={urllib.parse.quote(token)}&access_token={urllib.parse.quote(token)}"
        status, body = graph_get(url, token)
        data = (body or {}).get("data") or {}
        if status == 200 and data.get("is_valid"):
            scopes = data.get("scopes") or data.get("granular_scopes") or []
            scope_names = scopes if isinstance(scopes, list) and scopes and isinstance(scopes[0], str) else [
                (s.get("scope") if isinstance(s, dict) else str(s)) for s in (scopes or [])
            ]
            r.ok("is_valid", "true")
            r.ok("app_id", str(data.get("app_id")))
            expires_at = data.get("expires_at") or data.get("data_access_expires_at") or 0
            r.ok("expires_at", "never" if expires_at == 0 else f"unix={expires_at}")
            required = {"whatsapp_business_messaging", "whatsapp_business_management", "business_management"}
            present = set(scope_names)
            missing = required - present
            if missing:
                r.fail("scopes", f"missing: {sorted(missing)}",
                       "regenerate the System User token with all three scopes ticked")
            else:
                r.ok("scopes", "all three required scopes present")
        else:
            r.fail("debug_token", fmt_error(body),
                   "token is revoked/expired/malformed. Regenerate at Business Settings -> Users -> System users -> pizzabot -> Generate token")

    section("Step 3. phone number resource")
    if not phone_id or not token:
        r.fail("phone GET", "missing token or phone_id", "see Step 1")
    else:
        url = f"{base}/{phone_id}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status,is_pin_enabled,platform_type"
        status, body = graph_get(url, token)
        if status == 200:
            r.ok("display_phone_number", str(body.get("display_phone_number")))
            r.ok("verified_name", str(body.get("verified_name")))
            r.ok("quality_rating", str(body.get("quality_rating")))
            cvs = body.get("code_verification_status")
            if cvs == "VERIFIED":
                r.ok("code_verification_status", "VERIFIED")
            else:
                r.fail("code_verification_status", str(cvs),
                       "phone not registered with PIN. Run /register per docs/whatsapp_setup.md Phase 4")
            pin = body.get("is_pin_enabled")
            if pin:
                r.ok("is_pin_enabled", "true")
            else:
                r.fail("is_pin_enabled", "false",
                       "phone has no 2FA PIN. Run /register per docs/whatsapp_setup.md Phase 4")
            if display and body.get("display_phone_number"):
                env_digits = "".join(ch for ch in display if ch.isdigit())
                graph_digits = "".join(ch for ch in body["display_phone_number"] if ch.isdigit())
                if env_digits != graph_digits:
                    r.warn("display match", f".env={display} graph={body['display_phone_number']}")
        else:
            r.fail("phone GET", fmt_error(body),
                   "phone_id wrong OR token has no access to this phone. Re-copy Phone number ID from App Dashboard -> WhatsApp -> API Setup")

    section("Step 4. WABA resource")
    if not waba_id or not token:
        r.fail("waba GET", "missing token or waba_id", "see Step 1")
    else:
        url = f"{base}/{waba_id}?fields=id,name,currency,timezone_id,message_template_namespace"
        status, body = graph_get(url, token)
        if status == 200:
            r.ok("waba name", str(body.get("name")))
            r.ok("currency", str(body.get("currency")))
            r.ok("template_namespace", str(body.get("message_template_namespace")))
        else:
            r.fail("waba GET", fmt_error(body),
                   "WABA id wrong OR token cannot manage this WABA. Assign the system user Full control over the WABA in Business Settings")

    section("Step 5. webhook subscription on the WABA")
    if not waba_id or not token:
        r.fail("subscribed_apps", "missing token or waba_id", "see Step 1")
    else:
        url = f"{base}/{waba_id}/subscribed_apps"
        status, body = graph_get(url, token)
        if status == 200:
            apps = body.get("data") or []
            if apps:
                names = ", ".join(f"{a.get('whatsapp_business_api_data', {}).get('name') or a.get('id')}" for a in apps)
                r.ok("subscribed_apps", names)
            else:
                r.fail("subscribed_apps", "empty list",
                       "no app is subscribed to webhooks for this WABA. POST /{waba}/subscribed_apps with the bot's app token")
        else:
            r.fail("subscribed_apps", fmt_error(body),
                   "token lacks whatsapp_business_management OR WABA id wrong")

    section("Step 6. message templates")
    if not waba_id or not token:
        r.fail("templates GET", "missing token or waba_id", "see Step 1")
    else:
        url = f"{base}/{waba_id}/message_templates?fields=name,status,category,language&limit=100"
        status, body = graph_get(url, token)
        if status == 200:
            data = body.get("data") or []
            if not data:
                r.warn("templates", "none submitted yet")
            else:
                approved_names = {t["name"] for t in data if t.get("status") == "APPROVED"}
                for t in data:
                    line = f"{t.get('name')} [{t.get('category')}, {t.get('language')}] = {t.get('status')}"
                    if t.get("status") == "APPROVED":
                        r.ok("template", line)
                    else:
                        r.warn("template", line)
                for env_key, env_val in templates.items():
                    if not env_val:
                        r.warn(env_key, "blank (freeform fallback in effect)")
                    elif env_val in approved_names:
                        r.ok(env_key, f"{env_val} APPROVED")
                    else:
                        r.fail(env_key, f"{env_val} not found in APPROVED list",
                               f"either Meta has not approved '{env_val}' yet or the name in .env is misspelled")
        else:
            r.fail("templates GET", fmt_error(body))

    section("Result")
    if r.failed == 0:
        print("All checks passed. The bot can send and receive on Meta Cloud API.")
        return 0
    print(f"{r.failed} check(s) failed. Address the 'fix:' lines above in order.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

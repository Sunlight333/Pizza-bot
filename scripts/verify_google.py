#!/usr/bin/env python3
"""
One-shot Google Maps Platform diagnostic.

Reads /opt/pizzabot/.env (or the path in $PIZZA_ENV) and runs the
backend smoke tests Phase 0+ relies on — checking that the server
key is present, that the IP restriction lets us through (this only
PASSes when run from the VPS), and that the four APIs the backend
consumes return live data.

Run from the VPS:

    python3 scripts/verify_google.py

Or against a non-default env file:

    PIZZA_ENV=/path/to/.env python3 scripts/verify_google.py

Exit code is 0 only if every required check passes. Mirrors the
structure of scripts/verify_meta.py so the deploy script can call
both in sequence and bail on either failure.
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


def http_get(url: str) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(url)
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
        if remediation:
            print(f"        fix:  {remediation}")

    def warn(self, name: str, detail: str) -> None:
        print(f"  WARN  {name}   -> {detail}")


def section(title: str) -> None:
    print()
    print(title)
    print("-" * len(title))


def fmt_error(body: dict) -> str:
    status = body.get("status") or "?"
    msg = body.get("error_message") or body.get("transport_error") or body.get("raw") or ""
    return f"status={status} message={msg}"


def main() -> int:
    env_path = os.environ.get("PIZZA_ENV", "/opt/pizzabot/.env")
    if not os.path.exists(env_path):
        local = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
        )
        if os.path.exists(local):
            env_path = local
    print(f"Reading env from: {env_path}")
    env = load_env(env_path)

    server_key = env.get("GOOGLE_MAPS_SERVER_KEY", "")
    browser_key = env.get("VITE_GOOGLE_MAPS_KEY", "")

    r = Report()

    section("Step 1. env keys present")
    if server_key:
        r.ok("GOOGLE_MAPS_SERVER_KEY", f"len={len(server_key)}, prefix={server_key[:4]}")
    else:
        r.fail(
            "GOOGLE_MAPS_SERVER_KEY",
            "missing",
            "create the server key per docs/google_maps_setup.md Step 4",
        )
    if browser_key:
        r.ok("VITE_GOOGLE_MAPS_KEY", f"len={len(browser_key)}, prefix={browser_key[:4]}")
    else:
        r.warn(
            "VITE_GOOGLE_MAPS_KEY",
            "missing — frontend map features will be hidden",
        )

    if not server_key:
        print()
        print("Aborting — server key required for live checks.")
        return 1

    section("Step 2. Geocoding API")
    url = (
        "https://maps.googleapis.com/maps/api/geocode/json"
        f"?address={urllib.parse.quote('Avenida Paulista 1000 Sao Paulo')}"
        f"&key={urllib.parse.quote(server_key)}"
    )
    status, body = http_get(url)
    if status == 200 and body.get("status") == "OK" and body.get("results"):
        formatted = body["results"][0].get("formatted_address", "")
        r.ok("Geocoding API", f"resolved: {formatted[:80]}")
    else:
        r.fail(
            "Geocoding API",
            fmt_error(body),
            "enable Geocoding API in Cloud Console + check IP restriction "
            "matches this host's IP (use `curl ifconfig.me` to confirm).",
        )

    section("Step 3. Distance Matrix API")
    url = (
        "https://maps.googleapis.com/maps/api/distancematrix/json"
        "?origins=-23.561,-46.656&destinations=-23.550,-46.633"
        f"&key={urllib.parse.quote(server_key)}"
    )
    status, body = http_get(url)
    elem = ((body.get("rows") or [{}])[0].get("elements") or [{}])[0]
    if status == 200 and body.get("status") == "OK" and elem.get("status") == "OK":
        km = elem["distance"]["value"] / 1000
        mins = elem["duration"]["value"] // 60
        r.ok("Distance Matrix API", f"{km:.1f} km, {mins} min")
    else:
        r.fail(
            "Distance Matrix API",
            fmt_error(body),
            "enable Distance Matrix API (or Routes API) in Cloud Console "
            "and ensure the server key includes it in API restrictions.",
        )

    section("Step 4. Directions API")
    url = (
        "https://maps.googleapis.com/maps/api/directions/json"
        "?origin=-23.561,-46.656&destination=-23.550,-46.633"
        f"&key={urllib.parse.quote(server_key)}"
    )
    status, body = http_get(url)
    if status == 200 and body.get("status") == "OK" and body.get("routes"):
        route = body["routes"][0]
        polyline = route.get("overview_polyline", {}).get("points") or ""
        r.ok("Directions API", f"polyline len={len(polyline)}")
    else:
        r.fail(
            "Directions API",
            fmt_error(body),
            "enable Directions API in Cloud Console and include it in the "
            "server key's API restrictions list.",
        )

    section("Step 5. Places Autocomplete (server-side check)")
    url = (
        "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        "?input=avenida+paulista&components=country:br"
        f"&key={urllib.parse.quote(server_key)}"
    )
    status, body = http_get(url)
    if status == 200 and body.get("status") == "OK":
        n = len(body.get("predictions") or [])
        r.ok("Places Autocomplete", f"{n} predictions")
    else:
        r.fail(
            "Places Autocomplete",
            fmt_error(body),
            "enable Places API (New) in Cloud Console and include it in the "
            "server key's API restrictions list.",
        )

    section("Result")
    if r.failed == 0:
        print("All checks passed. Backend can use Google Maps end-to-end.")
        return 0
    print(f"{r.failed} check(s) failed. Address the 'fix:' lines above in order.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

"""
Pizzabot Windows bridge service.

Polls the VPS for pending orders and writes .txt files into the Datacaixa
"Pedidos" integration folder. Also sends heartbeats and refreshes product
tax data from the local Firebird DB every 6 hours.

Run: python bridge_service.py
Package: build.bat  (produces bridge.exe via PyInstaller)
"""
from __future__ import annotations

import configparser
import logging
import os
import socket
import sys
import time
from pathlib import Path
from typing import Any

import httpx

try:
    from firebird_reader import refresh_tax_cache
except ImportError:
    refresh_tax_cache = None  # optional

VERSION = "0.1.0"

log = logging.getLogger("bridge")
log.setLevel(logging.INFO)
logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s")


def load_config() -> configparser.ConfigParser:
    cfg = configparser.ConfigParser()
    here = Path(__file__).parent
    candidates = [here / "config.ini", Path("config.ini")]
    for c in candidates:
        if c.exists():
            cfg.read(c, encoding="utf-8")
            return cfg
    raise FileNotFoundError("config.ini not found")


class BridgeClient:
    def __init__(self, cfg: configparser.ConfigParser):
        self.base = cfg["api"]["url"].rstrip("/")
        self.token = cfg["api"]["token"]

    def _headers(self) -> dict[str, str]:
        return {"X-Bridge-Token": self.token, "Content-Type": "application/json"}

    def pending(self) -> list[dict[str, Any]]:
        r = httpx.get(f"{self.base}/api/bridge/pending", headers=self._headers(), timeout=15)
        r.raise_for_status()
        return r.json()

    def confirm(self, order_id: int, filename: str) -> None:
        r = httpx.post(
            f"{self.base}/api/bridge/confirm/{order_id}",
            headers=self._headers(),
            json={"filename": filename},
            timeout=10,
        )
        r.raise_for_status()

    def heartbeat(self, host: str) -> None:
        try:
            httpx.post(
                f"{self.base}/api/bridge/heartbeat",
                headers=self._headers(),
                json={"host": host, "version": VERSION},
                timeout=10,
            )
        except Exception as e:
            log.warning("heartbeat failed: %s", e)


def write_order_file(folder: Path, filename: str, content: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / filename
    # Datacaixa requires UTF-8, no BOM
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    return path


def run() -> int:
    cfg = load_config()
    api = BridgeClient(cfg)
    folder = Path(cfg["datacaixa"]["pedidos_folder"])
    host = cfg["service"].get("host_label", socket.gethostname())
    poll = int(cfg["service"].get("poll_seconds", 5))
    hb_interval = int(cfg["service"].get("heartbeat_seconds", 30))
    tax_refresh = int(cfg["service"].get("tax_refresh_hours", 6)) * 3600

    log.info("pizzabot bridge v%s starting — target %s", VERSION, folder)

    last_hb = 0.0
    last_tax = 0.0

    while True:
        now = time.time()
        try:
            if now - last_hb > hb_interval:
                api.heartbeat(host)
                last_hb = now

            if refresh_tax_cache and now - last_tax > tax_refresh:
                try:
                    refresh_tax_cache(cfg)
                except Exception as e:
                    log.warning("tax refresh failed: %s", e)
                last_tax = now

            pending = api.pending()
            for order in pending:
                try:
                    path = write_order_file(folder, order["filename"], order["content"])
                    api.confirm(order["order_id"], order["filename"])
                    log.info("wrote #%03d -> %s", order["order_number"], path.name)
                except Exception:
                    log.exception("failed to sync order #%s", order.get("order_number"))
        except httpx.HTTPError as e:
            log.warning("api error: %s", e)
        except KeyboardInterrupt:
            log.info("stopping")
            return 0
        except Exception:
            log.exception("loop error")

        time.sleep(poll)


if __name__ == "__main__":
    sys.exit(run())

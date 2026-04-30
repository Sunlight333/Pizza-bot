"""
Pizzabot Windows bridge — self-installing single executable.

Behavior on double-click:
  - First run (no config.ini found) → runs a 3-question wizard, tests the
    connection, writes config to %LOCALAPPDATA%\\Pizzabot\\config.ini, drops
    a shortcut into the user's Startup folder, then starts polling.
  - Subsequent runs (auto-start on login, or manual) → loads config and
    polls the VPS for pending orders, writing .txt files into Datacaixa's
    Pedidos folder. Heartbeat every 30 s. Optional Firebird tax refresh
    every 6 h (only if `fdb` is installed).

Build: build.bat → dist\\bridge.exe (single file, no installer required)
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
    refresh_tax_cache = None

# Make Windows console handle UTF-8 (checkmarks, em-dashes, Portuguese accents).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

VERSION = "0.2.0"

# Optional: developer can bake the public URL here before building so the
# customer only needs to paste a token. Leave empty to ask in the wizard.
BAKED_API_URL = ""

INSTALL_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "Pizzabot"
CONFIG_PATH = INSTALL_DIR / "config.ini"
LOG_PATH = INSTALL_DIR / "bridge.log"


def _exe_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).parent


def _exe_path() -> str:
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}"'
    return f'python "{Path(__file__).resolve()}"'


def _setup_logging() -> None:
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        sh = logging.StreamHandler()
        sh.setFormatter(fmt)
        root.addHandler(sh)
    fh = logging.FileHandler(LOG_PATH, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)


log = logging.getLogger("bridge")


def _autodetect_pedidos_folder() -> str:
    candidates = [
        r"C:\Datacaixa\Integracao\Pedidos",
        r"C:\Datacaixa\Integração\Pedidos",
        r"D:\Datacaixa\Integracao\Pedidos",
        r"C:\Program Files\Datacaixa\Integracao\Pedidos",
        r"C:\Program Files (x86)\Datacaixa\Integracao\Pedidos",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    return r"C:\Datacaixa\Integracao\Pedidos"


def _find_existing_config() -> Path | None:
    for p in (_exe_dir() / "config.ini", CONFIG_PATH):
        if p.exists():
            return p
    return None


def _prompt(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"{label}{suffix}: ").strip()
    return val or default


def _test_connection(url: str, token: str) -> tuple[bool, str]:
    try:
        r = httpx.post(
            f"{url.rstrip('/')}/api/bridge/heartbeat",
            headers={"X-Bridge-Token": token, "Content-Type": "application/json"},
            json={"host": socket.gethostname(), "version": VERSION},
            timeout=10,
        )
        if r.status_code == 401:
            return False, "token rejeitado (verifique BRIDGE_TOKEN no servidor)"
        if r.status_code == 404:
            return False, "endpoint /api/bridge/heartbeat não existe (servidor errado?)"
        r.raise_for_status()
        return True, "OK"
    except httpx.ConnectError as e:
        msg = str(e).lower()
        if "name or service" in msg or "getaddrinfo" in msg or "no address" in msg:
            return False, "domínio não resolve (DNS) — confira a URL"
        if "refused" in msg:
            return False, "servidor recusou conexão (porta/serviço fora do ar)"
        return False, f"sem conexão: {e}"
    except httpx.ConnectTimeout:
        return False, "timeout — servidor não respondeu em 10 s"
    except httpx.HTTPError as e:
        return False, f"erro HTTP: {e}"
    except Exception as e:
        return False, str(e)


def _install_autostart() -> Path:
    appdata = Path(os.environ.get("APPDATA", str(Path.home() / "AppData/Roaming")))
    startup = appdata / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
    startup.mkdir(parents=True, exist_ok=True)
    cmd = startup / "PizzabotBridge.cmd"
    cmd.write_text(
        f'@echo off\r\nstart "Pizzabot Bridge" /min {_exe_path()}\r\n',
        encoding="utf-8",
    )
    return cmd


def _first_run_wizard() -> Path:
    print()
    print("=" * 60)
    print("  Pizzabot Bridge — Configuração inicial")
    print("=" * 60)
    print()
    print("Este programa enviará automaticamente os pedidos do WhatsApp")
    print("para o Datacaixa. Vamos configurá-lo em poucos segundos.")
    print()

    if BAKED_API_URL:
        url = BAKED_API_URL
        print(f"Servidor: {url}")
    else:
        url = _prompt("1) URL do servidor (ex.: https://pizzabot.exemplo.com)")
        while not url.lower().startswith("http"):
            url = _prompt("   URL invalida. Digite novamente")
    url = url.rstrip("/")

    print()
    print("   Token da bridge: defina BRIDGE_TOKEN no .env do servidor,")
    print("   ou use os 16 primeiros caracteres do JWT_SECRET + a palavra 'bridge'.")
    token = ""
    while not token:
        token = _prompt("2) Cole o token da bridge")

    folder = _prompt("3) Pasta de pedidos do Datacaixa", _autodetect_pedidos_folder())

    print()
    print(f"   Servidor: {url}")
    print(f"   Pasta:    {folder}")
    print()
    print("Testando conexao com o servidor...", end=" ", flush=True)
    ok, msg = _test_connection(url, token)
    print("OK" if ok else f"FALHOU ({msg})")
    if not ok:
        ans = input("Salvar a configuração mesmo assim? [s/N] ").strip().lower()
        if ans != "s":
            print("Configuração cancelada.")
            sys.exit(1)

    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    cfg = configparser.ConfigParser()
    cfg["api"] = {"url": url, "token": token}
    cfg["datacaixa"] = {"pedidos_folder": folder}
    cfg["service"] = {
        "host_label": socket.gethostname(),
        "poll_seconds": "5",
        "heartbeat_seconds": "30",
        "tax_refresh_hours": "6",
    }
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        cfg.write(f)

    shortcut = _install_autostart()

    print()
    print("✓ Configuração salva em:", CONFIG_PATH)
    print("✓ Início automático ativo:", shortcut.name)
    print()
    print("A bridge agora abrirá sozinha sempre que o Windows ligar.")
    print("Você pode minimizar esta janela — não precisa fechar nada.")
    print()
    input("Pressione ENTER para iniciar agora...")
    return CONFIG_PATH


def load_config() -> configparser.ConfigParser:
    path = _find_existing_config()
    if path is None:
        path = _first_run_wizard()
    cfg = configparser.ConfigParser()
    cfg.read(path, encoding="utf-8")
    return cfg


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
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    return path


def run() -> int:
    _setup_logging()
    cfg = load_config()
    api = BridgeClient(cfg)
    folder = Path(cfg["datacaixa"]["pedidos_folder"])
    host = cfg["service"].get("host_label", socket.gethostname())
    poll = int(cfg["service"].get("poll_seconds", 5))
    hb_interval = int(cfg["service"].get("heartbeat_seconds", 30))
    tax_refresh = int(cfg["service"].get("tax_refresh_hours", 6)) * 3600

    log.info("pizzabot bridge v%s — destino %s", VERSION, folder)

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
    try:
        sys.exit(run())
    except SystemExit:
        raise
    except Exception:
        logging.getLogger("bridge").exception("fatal error")
        if sys.stdin and sys.stdin.isatty():
            try:
                input("\nOcorreu um erro. Pressione ENTER para fechar...")
            except (EOFError, KeyboardInterrupt):
                pass
        sys.exit(1)

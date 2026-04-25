"""
Reads product tax data from the local Datacaixa Firebird database and
caches it to `tax_cache.json` next to the bridge executable. Used as a
fallback source when the admin panel doesn't have tax fields filled in.

The actual table/column names depend on the Datacaixa schema version —
this is a template; confirm with Gabriel before shipping.
"""
from __future__ import annotations

import configparser
import json
import logging
from pathlib import Path

log = logging.getLogger("bridge.firebird")

CACHE_PATH = Path(__file__).parent / "tax_cache.json"


def refresh_tax_cache(cfg: configparser.ConfigParser) -> None:
    try:
        import fdb
    except ImportError:
        log.warning("fdb not installed — skipping Firebird refresh")
        return

    db_path = cfg["firebird"]["path"]
    user = cfg["firebird"].get("user", "SYSDBA")
    pw = cfg["firebird"].get("password", "masterkey")

    conn = fdb.connect(database=db_path, user=user, password=pw, charset="UTF8")
    try:
        cur = conn.cursor()
        # NOTE: table name is a placeholder; confirm with Datacaixa schema.
        # Expected columns: codigo, descricao, ncm, cest, cfop, csosn, origem, ibpt
        cur.execute(
            "SELECT CODIGO, DESCRICAO, NCM, CEST, CFOP, CSOSN, ORIGEM, IBPT FROM PRODUTO"
        )
        rows = [
            {
                "code": r[0],
                "name": r[1],
                "ncm": r[2],
                "cest": r[3],
                "cfop": r[4],
                "csosn": r[5],
                "origin_code": r[6],
                "ibpt_code": r[7],
            }
            for r in cur.fetchall()
        ]
    finally:
        conn.close()

    CACHE_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("cached %d product tax rows from Firebird", len(rows))


def load_tax_cache() -> list[dict]:
    if not CACHE_PATH.exists():
        return []
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

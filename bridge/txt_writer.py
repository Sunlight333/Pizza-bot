"""
Standalone .txt writer helper — useful for dry-runs and debugging.
The production path uses bridge_service.write_order_file; this module is kept
so scripts can validate a file before delivering it to Datacaixa.
"""
from __future__ import annotations

from pathlib import Path


def write_txt(folder: Path, filename: str, content: str) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / filename
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    return path


def validate_content(content: str) -> list[str]:
    """Sanity-check .txt against Datacaixa format. Returns list of issues (empty if OK)."""
    issues: list[str] = []
    lines = [ln for ln in content.splitlines() if ln.strip()]
    if not lines:
        return ["empty content"]
    if not lines[0].startswith("PEDIDO|"):
        issues.append("must start with PEDIDO| line")
    if not lines[-1].startswith("PGTO|"):
        issues.append("must end with PGTO| line")
    item_lines = [ln for ln in lines if ln.startswith("ITEM|")]
    if not item_lines:
        issues.append("no ITEM lines")
    for ln in item_lines:
        parts = ln.split("|")
        if len(parts) < 14:
            issues.append(f"ITEM line has only {len(parts)} fields: {ln[:80]}")
    for ln in lines:
        if "." in ln and "," not in ln:
            # heuristic — pure dot decimals look wrong
            for token in ln.split("|"):
                if token.replace(".", "").replace("-", "").isdigit() and "." in token:
                    issues.append(f"decimal with dot instead of comma: {token}")
                    break
    return issues

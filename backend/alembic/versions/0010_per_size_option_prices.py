"""Per-size pricing for available_crusts and available_extras.

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-29 02:00:00.000000

Pichya charges different rates for the same crust depending on size: catupiry
on brotinho costs less than catupiry on grande. The flat-price shape from
0007/0009 ({name, price}) is too coarse — replace `price` with a `prices`
map keyed by the size name.

New shape (both crusts and extras):
    {"name": "Catupiry", "prices": {"brotinho": 3.0, "grande": 6.0}}

Backfill rule: copy the existing flat `price` into every size the product
defines, so behavior is unchanged at first. The operator then edits per
cell in the new admin matrix to set real prices.

`get_menu_for_bot` and `order_builder.add_pizza` will start consulting
`prices[size]`, falling back to 0 when missing.
"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _convert_options(options, size_names):
    """Flat [{name, price}] (or legacy [str]) -> [{name, prices: {size: price}}]."""
    out = []
    for o in options or []:
        if isinstance(o, dict):
            if "prices" in o:
                # already migrated
                return options
            name = o.get("name") or ""
            flat = float(o.get("price") or 0)
        else:
            name = str(o)
            flat = 0.0
        out.append(
            {"name": name, "prices": {sn: flat for sn in size_names}}
        )
    return out


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, sizes, available_crusts, available_extras FROM products"
        )
    ).fetchall()

    for r in rows:
        sizes = r.sizes or []
        size_names = [
            s["size"] for s in sizes if isinstance(s, dict) and s.get("size")
        ]
        new_crusts = _convert_options(r.available_crusts, size_names)
        new_extras = _convert_options(r.available_extras, size_names)
        bind.execute(
            sa.text(
                "UPDATE products SET available_crusts = CAST(:c AS jsonb), "
                "available_extras = CAST(:e AS jsonb) WHERE id = :id"
            ),
            {
                "c": json.dumps(new_crusts),
                "e": json.dumps(new_extras),
                "id": r.id,
            },
        )


def downgrade() -> None:
    """Collapse prices map back to a flat price (max across sizes)."""
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, available_crusts, available_extras FROM products")
    ).fetchall()

    def collapse(options):
        out = []
        for o in options or []:
            if not isinstance(o, dict):
                out.append({"name": str(o), "price": 0})
                continue
            if "price" in o and "prices" not in o:
                out.append(o)
                continue
            prices = o.get("prices") or {}
            flat = max(prices.values(), default=0)
            out.append({"name": o.get("name") or "", "price": float(flat)})
        return out

    for r in rows:
        bind.execute(
            sa.text(
                "UPDATE products SET available_crusts = CAST(:c AS jsonb), "
                "available_extras = CAST(:e AS jsonb) WHERE id = :id"
            ),
            {
                "c": json.dumps(collapse(r.available_crusts)),
                "e": json.dumps(collapse(r.available_extras)),
                "id": r.id,
            },
        )

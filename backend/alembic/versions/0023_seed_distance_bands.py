"""Seed the standard 13 distance-based delivery bands.

Revision ID: 0023
Revises: 0022
Create Date: 2026-05-20 21:00:00.000000

The operator gave us a canonical fee schedule (0-2 km at R$ 5,00 up to
16,1-20 km at R$ 30,00). Seed the rows here so the Entrega page is
useful out of the box instead of greeting a fresh install with an
empty table.

Idempotent: for each band we check whether a row with the same
[distance_min_km, distance_max_km] window already exists and skip it
if so. That way re-running the migration after the operator has
hand-tuned the fees is a no-op — never overwrites manual edits.

The DeliveryZone model still requires a unique `neighborhood` string.
For pure-distance bands we synthesise it from the range (e.g. "0-2 km",
"2,1-3 km"). The bot's by-distance lookup ignores this field anyway,
so the label is purely cosmetic / admin-table-friendly.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (distance_min_km, distance_max_km, fee, estimated_minutes)
_BANDS: list[tuple[float, float, float, int]] = [
    (0.0,   2.0,   5.00,  30),
    (2.1,   3.0,   6.00,  35),
    (3.1,   4.0,   7.00,  40),
    (4.1,   5.0,  10.00,  45),
    (5.1,   6.0,  11.00,  50),
    (6.1,   7.0,  12.00,  55),
    (7.1,   8.0,  14.00,  60),
    (8.1,   9.0,  15.00,  65),
    (9.1,  10.0,  17.00,  70),
    (10.1, 12.0,  19.00,  75),
    (12.1, 14.0,  22.00,  80),
    (14.1, 16.0,  25.00,  85),
    (16.1, 20.0,  30.00,  90),
]


def _band_label(min_km: float, max_km: float) -> str:
    """Render as '0-2 km' / '2,1-3 km' with Brazilian comma decimals."""
    def fmt(v: float) -> str:
        if v == int(v):
            return str(int(v))
        # one decimal place, comma separator
        return ("%.1f" % v).replace(".", ",")
    return f"{fmt(min_km)}-{fmt(max_km)} km"


def upgrade() -> None:
    conn = op.get_bind()
    for min_km, max_km, fee, mins in _BANDS:
        existing = conn.execute(
            sa.text(
                "SELECT id FROM delivery_zones "
                "WHERE distance_min_km = :a AND distance_max_km = :b"
            ),
            {"a": min_km, "b": max_km},
        ).first()
        if existing:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO delivery_zones "
                "(neighborhood, fee, estimated_minutes, is_active, "
                " distance_min_km, distance_max_km) "
                "VALUES (:name, :fee, :mins, true, :a, :b) "
                "ON CONFLICT (neighborhood) DO NOTHING"
            ),
            {
                "name": _band_label(min_km, max_km),
                "fee": fee,
                "mins": mins,
                "a": min_km,
                "b": max_km,
            },
        )


def downgrade() -> None:
    # Intentional no-op. The operator may have hand-tuned these rows;
    # blindly deleting them on downgrade would lose work. To revert
    # manually:  DELETE FROM delivery_zones WHERE distance_min_km IS NOT NULL;
    pass

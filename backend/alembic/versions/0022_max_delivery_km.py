"""Max delivery distance cap.

Revision ID: 0022
Revises: 0021
Create Date: 2026-05-20 19:00:00.000000

Adds bot_config.max_delivery_km — a hard cap independent of per-band
distance_max_km. When set and delivery_by_distance is on, the bot and
the customer portal refuse any address whose Haversine distance (with
DETOUR_FACTOR applied) exceeds this value, even if no specific band
covers the distance. NULL = no cap (legacy behavior: out-of-zone is
only determined by whether some band's [min,max] window contains the
distance).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bot_config",
        sa.Column("max_delivery_km", sa.Numeric(5, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bot_config", "max_delivery_km")

"""Add distance-band columns to delivery_zones for km-based pricing.

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-26 14:00:00.000000

The customer prices delivery by distance bands (0–2 km R$5,
2,1–3 km R$6, …) rather than by named neighborhood. The existing
`neighborhood` column stays as the human-readable label and lookup key
for the bot's fuzzy matcher; these new columns let the same row also
record the km range it represents, so a future geocoding flow can pick
the correct band from a customer's actual address.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "delivery_zones",
        sa.Column("distance_min_km", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "delivery_zones",
        sa.Column("distance_max_km", sa.Numeric(5, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("delivery_zones", "distance_max_km")
    op.drop_column("delivery_zones", "distance_min_km")

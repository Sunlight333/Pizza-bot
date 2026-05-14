"""Pizzaria geo + distance-based delivery.

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-14 21:30:00.000000

Adds the four columns the distance-based delivery flow needs:
  - pizzaria_address    Free-text address (so the operator can re-geocode)
  - pizzaria_lat / lng  Origin point for the Haversine distance
  - delivery_by_distance  Toggle. False = legacy neighborhood-name match.

When the toggle is on AND lat/lng are set, the bot's set_delivery_address
tool and the customer portal's /checkout/quote both geocode the customer
address (Nominatim, cached) and look up the matching delivery_zones band
by distance_min_km ≤ km ≤ distance_max_km. Falls back to the
neighborhood-name match when geocoding fails.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bot_config",
        sa.Column("pizzaria_address", sa.Text(), nullable=True),
    )
    op.add_column(
        "bot_config",
        sa.Column("pizzaria_lat", sa.Numeric(10, 7), nullable=True),
    )
    op.add_column(
        "bot_config",
        sa.Column("pizzaria_lng", sa.Numeric(10, 7), nullable=True),
    )
    op.add_column(
        "bot_config",
        sa.Column(
            "delivery_by_distance",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("bot_config", "delivery_by_distance")
    op.drop_column("bot_config", "pizzaria_lng")
    op.drop_column("bot_config", "pizzaria_lat")
    op.drop_column("bot_config", "pizzaria_address")

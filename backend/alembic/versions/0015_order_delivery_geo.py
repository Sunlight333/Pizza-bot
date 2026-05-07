"""Persist GPS pin per order for rural deliveries.

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-03 12:30:00.000000

When the bot detects the address is rural it asks the customer to share the
WhatsApp location pin. The webhook records it in the conversation cart and,
on confirm, the lat/lng land here so the motoboy and the admin panel can
open it directly in Google Maps. Null = ordinary urban delivery (no pin).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("delivery_lat", sa.Numeric(10, 7), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("delivery_lng", sa.Numeric(10, 7), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "delivery_lng")
    op.drop_column("orders", "delivery_lat")

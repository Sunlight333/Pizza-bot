"""Pre-orders: hold an order for the next opening time before sending to Datacaixa.

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-30 16:00:00.000000

When a customer places an order outside business hours the bot now still
assembles the cart and confirms, but the resulting Order is stamped with
scheduled_for = next opening datetime. The bridge poller skips orders
whose scheduled_for is still in the future, so they don't get pushed to
Datacaixa until the pizzaria is open.

Null = immediate order (the existing path; nothing changes for already-
created orders).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "scheduled_for",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    # Indexed because the bridge polls "where scheduled_for is null or <= now()"
    # every few seconds. With even a few hundred scheduled rows the seq scan
    # would dominate the bridge's hot path.
    op.create_index(
        "ix_orders_scheduled_for",
        "orders",
        ["scheduled_for"],
        postgresql_where=sa.text("scheduled_for IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_orders_scheduled_for", table_name="orders")
    op.drop_column("orders", "scheduled_for")

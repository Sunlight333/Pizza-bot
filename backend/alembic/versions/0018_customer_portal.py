"""Customer portal — accounts, carts, birthday, order channel.

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-10 14:30:00.000000

Introduces the data the customer-facing web portal needs:
- customer_accounts: one row per phone that registered for the web,
  one-to-one with customers (the existing WhatsApp-side identity).
- customer_carts: server-side cart for logged-in customers (cross-device).
- customers.birthday: optional, used by the deferred birthday-coupon job.
- orders.channel: 'whatsapp' | 'web', so admin / reports can tell where
  an order came from.

Identity reconciliation rule: a CustomerAccount points to a Customer by
phone. If a phone already has a `customers` row from prior WhatsApp
orders, registration links to it — full history visible on the web
without a manual merge.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # customers.birthday — collected on /profile, used by birthday cron later
    op.add_column("customers", sa.Column("birthday", sa.Date(), nullable=True))

    # orders.channel — keep existing rows correct via DEFAULT
    op.add_column(
        "orders",
        sa.Column(
            "channel",
            sa.String(length=16),
            nullable=False,
            server_default="whatsapp",
        ),
    )
    op.create_index("ix_orders_channel", "orders", ["channel"])

    # customer_accounts
    op.create_table(
        "customer_accounts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "customer_id",
            sa.Integer,
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("email_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("marketing_opt_in", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("customer_id"),
    )
    op.create_index("ix_customer_accounts_customer_id", "customer_accounts", ["customer_id"])

    # customer_carts
    op.create_table(
        "customer_carts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "customer_id",
            sa.Integer,
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "items",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("customer_id"),
    )
    op.create_index("ix_customer_carts_customer_id", "customer_carts", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_carts_customer_id", table_name="customer_carts")
    op.drop_table("customer_carts")
    op.drop_index("ix_customer_accounts_customer_id", table_name="customer_accounts")
    op.drop_table("customer_accounts")
    op.drop_index("ix_orders_channel", table_name="orders")
    op.drop_column("orders", "channel")
    op.drop_column("customers", "birthday")

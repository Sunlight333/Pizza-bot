"""Add columns for half-pizza pricing, default tax fallback, fiscal emission, LGPD, cost cap.

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-25 22:00:00.000000

These columns make the four "blocked on humans" decisions configurable at runtime:
  - C3: half_pizza_pricing  (max | average | first)
  - C2: default_ncm/cfop/csosn/cest/origin_code/ibpt_code  (fallback when product
        fields are blank, until contadora certifies real codes)
  - C4: orders.fiscal_emitted  + bot_config.fiscal_emission_mode
        (separate cupom-fiscal step from .txt import; mode 'manual' until
        Gabriel confirms Datacaixa's auto-emit behavior)
  - LGPD: customers.privacy_notice_sent + bot_config.privacy_notice
  - Cost guardrail: bot_config.daily_token_budget
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # bot_config — pricing rule, default tax fallbacks, emission mode, LGPD, cost cap
    op.add_column(
        "bot_config",
        sa.Column("half_pizza_pricing", sa.String(16), nullable=False, server_default="max"),
    )
    op.add_column("bot_config", sa.Column("default_ncm", sa.String(16), nullable=True))
    op.add_column("bot_config", sa.Column("default_cfop", sa.String(8), nullable=True))
    op.add_column("bot_config", sa.Column("default_csosn", sa.String(8), nullable=True))
    op.add_column("bot_config", sa.Column("default_cest", sa.String(16), nullable=True))
    op.add_column(
        "bot_config",
        sa.Column("default_origin_code", sa.String(4), nullable=True, server_default="0"),
    )
    op.add_column("bot_config", sa.Column("default_ibpt_code", sa.String(16), nullable=True))
    op.add_column(
        "bot_config",
        sa.Column(
            "fiscal_emission_mode", sa.String(16), nullable=False, server_default="manual"
        ),
    )
    op.add_column("bot_config", sa.Column("privacy_notice", sa.Text(), nullable=True))
    op.add_column(
        "bot_config",
        sa.Column("daily_token_budget", sa.Integer(), nullable=False, server_default="0"),
    )

    # orders — separate fiscal-emission tracking from .txt sync
    op.add_column(
        "orders",
        sa.Column("fiscal_emitted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "ix_orders_fiscal_emitted", "orders", ["fiscal_emitted"], unique=False
    )
    op.add_column(
        "orders",
        sa.Column("fiscal_emitted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # customers — LGPD one-shot disclosure
    op.add_column(
        "customers",
        sa.Column(
            "privacy_notice_sent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Drop server_defaults — runtime defaults come from the ORM going forward
    op.alter_column("bot_config", "half_pizza_pricing", server_default=None)
    op.alter_column("bot_config", "default_origin_code", server_default=None)
    op.alter_column("bot_config", "fiscal_emission_mode", server_default=None)
    op.alter_column("bot_config", "daily_token_budget", server_default=None)
    op.alter_column("orders", "fiscal_emitted", server_default=None)
    op.alter_column("customers", "privacy_notice_sent", server_default=None)


def downgrade() -> None:
    op.drop_column("customers", "privacy_notice_sent")
    op.drop_column("orders", "fiscal_emitted_at")
    op.drop_index("ix_orders_fiscal_emitted", table_name="orders")
    op.drop_column("orders", "fiscal_emitted")

    op.drop_column("bot_config", "daily_token_budget")
    op.drop_column("bot_config", "privacy_notice")
    op.drop_column("bot_config", "fiscal_emission_mode")
    op.drop_column("bot_config", "default_ibpt_code")
    op.drop_column("bot_config", "default_origin_code")
    op.drop_column("bot_config", "default_cest")
    op.drop_column("bot_config", "default_csosn")
    op.drop_column("bot_config", "default_cfop")
    op.drop_column("bot_config", "default_ncm")
    op.drop_column("bot_config", "half_pizza_pricing")

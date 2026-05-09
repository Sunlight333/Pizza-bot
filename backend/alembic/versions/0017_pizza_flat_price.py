"""Optional flat pricing for pizzas (com massa / sem massa).

Revision ID: 0017
Revises: 0016
Create Date: 2026-05-09 02:00:00.000000

Some pizzarias charge a single flat price per pizza (com massa) regardless
of size or flavor, plus a discounted "sem massa" (low-carb / no-crust)
option. When these columns are set, order_builder uses them directly and
ignores the per-size pricing in products.sizes; when null, behaviour falls
back to the original per-flavour / per-size table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bot_config",
        sa.Column("pizza_flat_price_with_crust", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "bot_config",
        sa.Column("pizza_flat_price_without_crust", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bot_config", "pizza_flat_price_without_crust")
    op.drop_column("bot_config", "pizza_flat_price_with_crust")

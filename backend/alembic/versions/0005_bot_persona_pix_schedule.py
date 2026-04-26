"""Add bot persona, PIX info, and closed-weekday schedule to BotConfig.

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-26 13:00:00.000000

Adds tenant-specific runtime config that previously was hardcoded:
  - bot_name: how the bot introduces itself ("Bia")
  - closed_weekdays: JSONB list of Python weekday ints (Mon=0..Sun=6)
    so the off-hours gate handles "fechado segunda-feira" without code
  - pix_key / pix_holder: surfaced to customers who pick PIX
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bot_config",
        sa.Column("bot_name", sa.String(40), nullable=False, server_default="Bia"),
    )
    op.add_column(
        "bot_config",
        sa.Column(
            "closed_weekdays",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column("bot_config", sa.Column("pix_key", sa.String(120), nullable=True))
    op.add_column("bot_config", sa.Column("pix_holder", sa.String(120), nullable=True))

    # Drop the server defaults so the ORM owns them going forward
    op.alter_column("bot_config", "bot_name", server_default=None)
    op.alter_column("bot_config", "closed_weekdays", server_default=None)


def downgrade() -> None:
    op.drop_column("bot_config", "pix_holder")
    op.drop_column("bot_config", "pix_key")
    op.drop_column("bot_config", "closed_weekdays")
    op.drop_column("bot_config", "bot_name")

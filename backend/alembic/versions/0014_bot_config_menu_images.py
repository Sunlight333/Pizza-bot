"""Add BotConfig.menu_images for the bot's send_menu_image tool.

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-03 12:00:00.000000

When a customer asks for the menu in WhatsApp, the bot now sends an image
instead of describing every flavor. The image URLs live in this single JSONB
column on bot_config (one row), keyed by category — "salgada", "doce",
"sorvete", "bebida". Empty dict by default; the bot falls back to text
suggestions for any category that isn't populated.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bot_config",
        sa.Column(
            "menu_images",
            sa.dialects.postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("bot_config", "menu_images")

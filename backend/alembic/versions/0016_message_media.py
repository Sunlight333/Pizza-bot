"""Add media_url + media_type to conversation_messages.

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-08 02:00:00.000000

Captures the URL of the saved media file (audio note, image, etc.) the
customer sent — and the type so the admin chat viewer can pick the right
renderer (audio player vs <img>). The existing is_audio flag is kept for
backwards compatibility; new code reads media_type.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversation_messages",
        sa.Column("media_url", sa.String(512), nullable=True),
    )
    op.add_column(
        "conversation_messages",
        sa.Column("media_type", sa.String(16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversation_messages", "media_type")
    op.drop_column("conversation_messages", "media_url")

"""Allow multiple images per product (image_urls list).

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-30 12:00:00.000000

The single image_url column was enough to show one photo per product but
operators want to upload several (different angles, the box, the slice).
Add a JSONB list `image_urls` that holds them in display order; the first
entry is the primary image used by the card thumbnail and the bot prompt.

image_url is kept for backward compatibility and is derived from
image_urls[0] on save by the API layer. Backfill copies any existing
non-empty, non-sentinel image_url into image_urls so nothing visually
changes for products already configured.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "image_urls",
            sa.dialects.postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    # Backfill: any product whose image_url is a real URL (not empty, not the
    # __hidden__ sentinel) gets that URL added as the only entry in image_urls.
    op.execute(
        """
        UPDATE products
        SET image_urls = jsonb_build_array(image_url)
        WHERE image_url IS NOT NULL
          AND image_url <> ''
          AND image_url <> '__hidden__';
        """
    )


def downgrade() -> None:
    op.drop_column("products", "image_urls")

"""Backfill sizes[].allows_half=null from the product-level flag.

Revision ID: 0011
Revises: 0010
Create Date: 2026-04-29 03:00:00.000000

Migration 0008 was idempotent on the *key* — it skipped any size that already
had an `allows_half` key, including those persisted with `null`. The admin UI
saved nulls when the operator didn't touch the per-size checkbox after 0008
ran, so the helper _size_allows_half() then fell back to Product.allows_half
even when the operator may have intended otherwise.

This pass walks every size dict and replaces null/missing allows_half with
Product.allows_half, so the per-size flag is always concrete from now on.
The frontend (ProductModal) was patched in the same change to never persist
null again.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE products
        SET sizes = (
            SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN (s ? 'allows_half')
                            AND jsonb_typeof(s->'allows_half') = 'boolean'
                            THEN s
                        ELSE
                            jsonb_set(
                                s,
                                '{allows_half}',
                                to_jsonb(allows_half)
                            )
                    END
                ),
                '[]'::jsonb
            )
            FROM jsonb_array_elements(sizes) AS s
        )
        WHERE jsonb_typeof(sizes) = 'array'
          AND jsonb_array_length(sizes) > 0
          AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(sizes) AS s
              WHERE NOT (s ? 'allows_half')
                 OR jsonb_typeof(s->'allows_half') <> 'boolean'
          );
        """
    )


def downgrade() -> None:
    # No-op — re-introducing nulls would only re-create the bug.
    pass

"""Add allows_half flag to each size in Product.sizes.

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-29 00:30:00.000000

Pichya's rule: only the "grande" size allows meia-a-meia; brotinho/pequena/
média are 1-flavor only. The product-level Product.allows_half is too coarse
for this — we need a flag on each size entry.

Backfill copies the existing Product.allows_half value into every size
(`{size, price, allows_half: <Product.allows_half>}`) so behavior is
identical until the operator restricts specific sizes via the UI.

Product.allows_half stays for backward compatibility; validate_combination
reads the per-size flag first and falls back to the column when a size
predates this migration.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # For each size dict, add allows_half = product.allows_half. Skip rows
    # that already have the field (idempotent re-run).
    op.execute(
        """
        UPDATE products
        SET sizes = (
            SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN s ? 'allows_half'
                            THEN s
                        ELSE s || jsonb_build_object('allows_half', allows_half)
                    END
                ),
                '[]'::jsonb
            )
            FROM jsonb_array_elements(sizes) AS s
        )
        WHERE jsonb_typeof(sizes) = 'array'
          AND jsonb_array_length(sizes) > 0;
        """
    )


def downgrade() -> None:
    # Strip allows_half from each size dict.
    op.execute(
        """
        UPDATE products
        SET sizes = (
            SELECT COALESCE(jsonb_agg(s - 'allows_half'), '[]'::jsonb)
            FROM jsonb_array_elements(sizes) AS s
        )
        WHERE jsonb_typeof(sizes) = 'array'
          AND jsonb_array_length(sizes) > 0;
        """
    )

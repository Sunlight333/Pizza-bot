"""Convert Product.available_extras from list[str] to list[{name, price}].

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-29 00:00:00.000000

Pichya's menu has a mix of free toppings (cebola, requeijão) and paid ones
(extra queijo, bacon). The old shape only stored names so the operator had
nowhere to enter the price; the bot also couldn't add the charge to the
order. Each existing string entry is backfilled to {"name": <str>, "price": 0},
so legacy products keep working until the operator edits them to set prices.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only touch products whose extras are still all strings — idempotent if
    # rerun and safe if some rows were edited via the new UI before migration.
    op.execute(
        """
        UPDATE products
        SET available_extras = (
            SELECT COALESCE(
                jsonb_agg(jsonb_build_object('name', e, 'price', 0)),
                '[]'::jsonb
            )
            FROM jsonb_array_elements_text(available_extras) AS e
        )
        WHERE jsonb_typeof(available_extras) = 'array'
          AND jsonb_array_length(available_extras) > 0
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(available_extras) elem
              WHERE jsonb_typeof(elem) <> 'string'
          );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE products
        SET available_extras = (
            SELECT COALESCE(jsonb_agg(elem->>'name'), '[]'::jsonb)
            FROM jsonb_array_elements(available_extras) AS elem
        )
        WHERE jsonb_typeof(available_extras) = 'array'
          AND jsonb_array_length(available_extras) > 0
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(available_extras) elem
              WHERE jsonb_typeof(elem) <> 'object'
          );
        """
    )

"""Convert Product.available_crusts from list[str] to list[{name, price}].

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-29 01:00:00.000000

Mirrors what 0007 did for extras: pizzerias often charge for stuffed crusts
(catupiry, cheddar, leite ninho) while plain "sem borda" is free. Each
existing string becomes {name: <str>, price: 0} so legacy products keep
working until the operator sets prices in the new UI.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE products
        SET available_crusts = (
            SELECT COALESCE(
                jsonb_agg(jsonb_build_object('name', e, 'price', 0)),
                '[]'::jsonb
            )
            FROM jsonb_array_elements_text(available_crusts) AS e
        )
        WHERE jsonb_typeof(available_crusts) = 'array'
          AND jsonb_array_length(available_crusts) > 0
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(available_crusts) elem
              WHERE jsonb_typeof(elem) <> 'string'
          );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE products
        SET available_crusts = (
            SELECT COALESCE(jsonb_agg(elem->>'name'), '[]'::jsonb)
            FROM jsonb_array_elements(available_crusts) AS elem
        )
        WHERE jsonb_typeof(available_crusts) = 'array'
          AND jsonb_array_length(available_crusts) > 0
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(available_crusts) elem
              WHERE jsonb_typeof(elem) <> 'object'
          );
        """
    )

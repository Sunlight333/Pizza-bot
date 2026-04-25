"""add pg_trgm extension for fuzzy neighborhood matching

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-24 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_delivery_zones_neighborhood_trgm "
        "ON delivery_zones USING gin (neighborhood gin_trgm_ops)"
    )
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_delivery_zones_neighborhood_trgm")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
    op.execute("DROP EXTENSION IF EXISTS unaccent")

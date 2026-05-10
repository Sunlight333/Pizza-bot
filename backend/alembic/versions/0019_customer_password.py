"""Customer portal — email/password login.

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-10 23:30:00.000000

Adds password_hash to customer_accounts so customers can log in with
email + password (then a WhatsApp OTP for 2FA). Existing rows have no
password yet — they keep the old "no password" state and the auth
endpoints reject them, so they must use the registration flow once to
set a password. Demo accounts seeded by app.seed_customer_portal get a
known default password.

Also adds a unique index on email so two customers can't register the
same address.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customer_accounts",
        sa.Column("password_hash", sa.String(length=255), nullable=True),
    )
    # Unique on email (when present). Postgres treats multiple NULLs as
    # distinct in a unique index, so legacy email-less accounts coexist
    # without collision; new registrations enforce uniqueness because
    # email is required at the API layer.
    op.create_index(
        "ix_customer_accounts_email_unique",
        "customer_accounts",
        ["email"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_customer_accounts_email_unique", table_name="customer_accounts")
    op.drop_column("customer_accounts", "password_hash")

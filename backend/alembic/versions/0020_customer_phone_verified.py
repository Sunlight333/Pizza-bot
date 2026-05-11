"""Customer portal — phone_verified_at on customer_accounts.

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-11 00:30:00.000000

When a customer registers, they pass an OTP step on their first login
to prove ownership of the WhatsApp number. After that, subsequent
logins use email + password only — the OTP step is no longer asked.

This column records the moment that first OTP succeeded. NULL = never
verified yet (first login still goes through OTP); timestamp = verified
(login is one-step).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customer_accounts",
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill: existing accounts (from the seed + any real registrations
    # already persisted) treat the prior register-with-OTP as having
    # verified the phone, so they don't get re-prompted on next login.
    op.execute(
        "UPDATE customer_accounts "
        "SET phone_verified_at = COALESCE(last_login_at, NOW()) "
        "WHERE password_hash IS NOT NULL AND phone_verified_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column("customer_accounts", "phone_verified_at")

"""Track Meta delivery status (sent/delivered/read/failed) per outbound message.

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-27 12:00:00.000000

Meta sends webhook status events for every outbound message — `sent`
when their gateway accepts it, `delivered` when the device receives,
`read` when the customer opens the chat, `failed` on permanent error.
Before this change those events were logged and discarded. Now each
ConversationMessage carries `wa_message_id` (Meta's wamid) and
`delivery_status` so the admin chat viewer can render WhatsApp-style
check marks, and the operator can tell at a glance whether their last
reply actually reached the customer.

Both columns are nullable: inbound rows (role=user) and system rows
(role=system, role=tool) never have a wamid and are not tracked.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversation_messages",
        sa.Column("wa_message_id", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "conversation_messages",
        sa.Column("delivery_status", sa.String(length=16), nullable=True),
    )
    # Indexed because the status webhook handler looks up by wamid on
    # every Meta status event — without an index this is a sequential
    # scan over the entire history of outbound messages.
    op.create_index(
        "ix_conversation_messages_wa_message_id",
        "conversation_messages",
        ["wa_message_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_conversation_messages_wa_message_id", table_name="conversation_messages")
    op.drop_column("conversation_messages", "delivery_status")
    op.drop_column("conversation_messages", "wa_message_id")

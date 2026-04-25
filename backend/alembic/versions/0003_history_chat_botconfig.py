"""order_status_history, bot_config, conversation_messages

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-25 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    order_status = postgresql.ENUM(
        "received", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled",
        name="order_status",
        create_type=False,
    )

    op.create_table(
        "order_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", order_status, nullable=False),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("transitioned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_order_status_history_order_id", "order_status_history", ["order_id"])

    op.create_table(
        "bot_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("greeting", sa.Text(), nullable=False,
                  server_default="Oi! Boa noite — sou o atendente virtual da pizzaria. Como posso ajudar?"),
        sa.Column("enable_repeat_last_order", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("working_hours_start", sa.Integer(), nullable=False, server_default="18"),
        sa.Column("working_hours_end", sa.Integer(), nullable=False, server_default="23"),
        sa.Column("off_hours_message", sa.Text(), nullable=False,
                  server_default="No momento estamos fechados. Funcionamos das 18h às 23h."),
        sa.Column("max_items_per_order", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("ask_cpf", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("tts_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("extra_system_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    message_role = postgresql.ENUM(
        "user", "assistant", "system", "tool", "admin",
        name="message_role",
    )
    message_role.create(op.get_bind(), checkfirst=True)
    message_role_col = postgresql.ENUM(
        "user", "assistant", "system", "tool", "admin",
        name="message_role",
        create_type=False,
    )

    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role", message_role_col, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_audio", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_conversation_messages_phone", "conversation_messages", ["phone"])
    op.create_index("ix_conversation_messages_created_at", "conversation_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_conversation_messages_created_at", table_name="conversation_messages")
    op.drop_index("ix_conversation_messages_phone", table_name="conversation_messages")
    op.drop_table("conversation_messages")
    op.execute("DROP TYPE IF EXISTS message_role")
    op.drop_table("bot_config")
    op.drop_index("ix_order_status_history_order_id", table_name="order_status_history")
    op.drop_table("order_status_history")

"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=True),
        sa.Column("cpf", sa.String(14), nullable=True),
        sa.Column("addresses", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("default_address_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_order_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_customers_phone", "customers", ["phone"], unique=True)

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sizes", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_pizza", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("allows_half", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("available_crusts", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("available_extras", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("ncm", sa.String(10), nullable=True),
        sa.Column("cfop", sa.String(5), nullable=True),
        sa.Column("csosn", sa.String(5), nullable=True),
        sa.Column("cest", sa.String(10), nullable=True),
        sa.Column("ibpt_code", sa.String(20), nullable=True),
        sa.Column("origin_code", sa.String(2), nullable=True),
        sa.Column("datacaixa_code", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_products_category_id", "products", ["category_id"])

    op.create_table(
        "delivery_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("neighborhood", sa.String(120), nullable=False, unique=True),
        sa.Column("fee", sa.Numeric(8, 2), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False, server_default="45"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_delivery_zones_neighborhood", "delivery_zones", ["neighborhood"], unique=True)

    order_status = postgresql.ENUM(
        "received", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled",
        name="order_status",
        create_type=False,
    )
    postgresql.ENUM(
        "received", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled",
        name="order_status",
    ).create(op.get_bind(), checkfirst=True)

    payment_method = postgresql.ENUM(
        "pix", "credit", "debit", "cash", "pickup",
        name="payment_method",
        create_type=False,
    )
    postgresql.ENUM(
        "pix", "credit", "debit", "cash", "pickup",
        name="payment_method",
    ).create(op.get_bind(), checkfirst=True)

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("order_number", sa.Integer(), nullable=False),
        sa.Column("status", order_status, nullable=False, server_default="received"),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("delivery_fee", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", payment_method, nullable=False),
        sa.Column("payment_code", sa.String(2), nullable=False),
        sa.Column("delivery_address", sa.String(500), nullable=True),
        sa.Column("delivery_neighborhood", sa.String(120), nullable=True),
        sa.Column("customer_phone", sa.String(32), nullable=False),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.Column("datacaixa_synced", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("datacaixa_file", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_orders_customer_id", "orders", ["customer_id"])
    op.create_index("ix_orders_order_number", "orders", ["order_number"])
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_datacaixa_synced", "orders", ["datacaixa_synced"])

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit", sa.String(8), nullable=False, server_default="UN"),
        sa.Column("is_delivery_fee", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])

    conv_state = postgresql.ENUM(
        "greeting", "browsing_menu", "building_order", "collecting_address",
        "collecting_payment", "confirming", "completed", "human_takeover",
        name="conversation_state",
        create_type=False,
    )
    postgresql.ENUM(
        "greeting", "browsing_menu", "building_order", "collecting_address",
        "collecting_payment", "confirming", "completed", "human_takeover",
        name="conversation_state",
    ).create(op.get_bind(), checkfirst=True)

    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("state", conv_state, nullable=False, server_default="greeting"),
        sa.Column("cart", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("context_messages", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("handed_off_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_agent", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_conversations_customer_id", "conversations", ["customer_id"])
    op.create_index("ix_conversations_phone", "conversations", ["phone"])

    user_role = postgresql.ENUM("admin", "attendant", name="user_role", create_type=False)
    postgresql.ENUM("admin", "attendant", name="user_role").create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(80), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="attendant"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS user_role")

    op.drop_index("ix_conversations_phone", table_name="conversations")
    op.drop_index("ix_conversations_customer_id", table_name="conversations")
    op.drop_table("conversations")
    op.execute("DROP TYPE IF EXISTS conversation_state")

    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_table("order_items")

    op.drop_index("ix_orders_datacaixa_synced", table_name="orders")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_index("ix_orders_order_number", table_name="orders")
    op.drop_index("ix_orders_customer_id", table_name="orders")
    op.drop_table("orders")
    op.execute("DROP TYPE IF EXISTS payment_method")
    op.execute("DROP TYPE IF EXISTS order_status")

    op.drop_index("ix_delivery_zones_neighborhood", table_name="delivery_zones")
    op.drop_table("delivery_zones")

    op.drop_index("ix_products_category_id", table_name="products")
    op.drop_table("products")

    op.drop_table("categories")

    op.drop_index("ix_customers_phone", table_name="customers")
    op.drop_table("customers")

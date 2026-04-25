import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class OrderStatus(str, enum.Enum):
    received = "received"
    confirmed = "confirmed"
    preparing = "preparing"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentMethod(str, enum.Enum):
    pix = "pix"
    credit = "credit"
    debit = "debit"
    cash = "cash"
    pickup = "pickup"


# SEFAZ payment codes — used by Datacaixa .txt PGTO line
PAYMENT_CODE_MAP = {
    PaymentMethod.cash: "01",
    PaymentMethod.credit: "03",
    PaymentMethod.debit: "04",
    PaymentMethod.pix: "17",
    PaymentMethod.pickup: "90",
}


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), index=True, nullable=False
    )

    # Per-day sequential number, displayed as "#001"
    order_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"),
        default=OrderStatus.received,
        nullable=False,
        index=True,
    )

    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method"), nullable=False
    )
    payment_code: Mapped[str] = mapped_column(String(2), nullable=False)

    delivery_address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    delivery_neighborhood: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    customer_phone: Mapped[str] = mapped_column(String(32), nullable=False)

    observation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    datacaixa_synced: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    datacaixa_file: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Cupom fiscal — separate from .txt sync. The operator (or Datacaixa, depending
    # on bot_config.fiscal_emission_mode) confirms emission separately.
    fiscal_emitted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    fiscal_emitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    customer = relationship("Customer", back_populates="orders", lazy="joined")
    items = relationship(
        "OrderItem",
        back_populates="order",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

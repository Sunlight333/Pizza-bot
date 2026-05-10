from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    cpf: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)

    # [{"label": "casa", "street": "...", "number": "...", "neighborhood": "...", "complement": "...", "reference": "..."}]
    addresses: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    default_address_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    total_orders: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_order_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # LGPD: privacy notice sent once per phone, then never again
    privacy_notice_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Optional, collected on the web-portal /profile page. Powers the
    # deferred birthday-coupon job; harmless when absent.
    birthday: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    orders = relationship("Order", back_populates="customer", lazy="selectin")
    conversations = relationship("Conversation", back_populates="customer", lazy="selectin")

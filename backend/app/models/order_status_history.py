from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.order import OrderStatus


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", create_type=False), nullable=False
    )
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    transitioned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

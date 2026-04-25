from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )

    # Consolidated description — e.g. "Pizza Grande 1/2 Calabresa + 1/2 Portuguesa Borda Catupiry"
    description: Mapped[str] = mapped_column(Text, nullable=False)

    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit: Mapped[str] = mapped_column(String(8), default="UN", nullable=False)

    is_delivery_fee: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", lazy="joined")

    @property
    def line_total(self) -> float:
        return float(self.unit_price) * self.quantity

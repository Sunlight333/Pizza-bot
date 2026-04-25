from sqlalchemy import Boolean, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class DeliveryZone(Base, TimestampMixin):
    __tablename__ = "delivery_zones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    neighborhood: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    fee: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=45, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

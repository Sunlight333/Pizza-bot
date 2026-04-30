from typing import Optional

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

    # Distance band the zone covers (some operators price delivery by km, not bairro).
    # Optional — a zone can be either name-based or distance-based; both columns
    # being null means the zone is purely a named neighborhood.
    distance_min_km: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    distance_max_km: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)

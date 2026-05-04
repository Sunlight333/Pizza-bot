from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True, nullable=False
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # [{"size": "pequena", "price": 29.90}, {"size": "grande", "price": 49.90}]
    sizes: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    is_pizza: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allows_half: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ["Catupiry", "Cheddar", "Chocolate", "Sem Borda"]
    available_crusts: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # ["Extra Queijo", "Extra Bacon", "Sem Cebola"]
    available_extras: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    # Brazilian tax fields — mandatory in every Datacaixa .txt line
    ncm: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    cfop: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    csosn: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    cest: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    ibpt_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    origin_code: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    datacaixa_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Primary image. Kept for backward compatibility; in practice it's
    # set to image_urls[0] by the API layer when the product is saved.
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # All product images in display order; image_urls[0] is the primary.
    # Empty list = use the auto pizzaImage fallback. The HIDDEN_IMAGE
    # sentinel still lives on image_url so behavior of "hide" is unchanged.
    image_urls: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    category = relationship("Category", back_populates="products", lazy="joined")

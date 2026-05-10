from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CustomerCart(Base, TimestampMixin):
    """Server-side cart for a logged-in web customer.

    `items` is the same shape order_builder consumes:
      [{"product_id": int, "description": str, "unit_price": float,
        "quantity": int, "unit": "UN", "is_delivery_fee": bool,
        "_web_meta": {...}}]
    `_web_meta` carries the structured selection (size/crust/extras/half_with)
    so the cart page can render rich line items without re-parsing the
    description string.
    """

    __tablename__ = "customer_carts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    items: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

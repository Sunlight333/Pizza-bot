import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ConversationState(str, enum.Enum):
    greeting = "greeting"
    browsing_menu = "browsing_menu"
    building_order = "building_order"
    collecting_address = "collecting_address"
    collecting_payment = "collecting_payment"
    confirming = "confirming"
    completed = "completed"
    human_takeover = "human_takeover"


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    phone: Mapped[str] = mapped_column(String(32), index=True, nullable=False)

    state: Mapped[ConversationState] = mapped_column(
        Enum(ConversationState, name="conversation_state"),
        default=ConversationState.greeting,
        nullable=False,
    )

    # {"items": [...], "delivery_address": "...", "payment_method": "...", ...}
    cart: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # [{"role": "user"|"assistant"|"system", "content": "..."}]
    context_messages: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    handed_off_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    assigned_agent: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    customer = relationship("Customer", back_populates="conversations")

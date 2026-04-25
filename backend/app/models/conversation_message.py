import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
    tool = "tool"
    admin = "admin"


class ConversationMessage(Base):
    """
    Persisted chat history — every inbound and outbound message goes here so
    the admin panel can show a real chat viewer.
    """
    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    customer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )

    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_audio: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

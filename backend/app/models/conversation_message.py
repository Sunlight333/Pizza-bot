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

    # Optional media attachment served at /media/chats/<file>. media_type is
    # "image" or "audio" so the admin chat viewer picks the right renderer.
    # is_audio is kept for backwards-compatibility and equals media_type=="audio".
    media_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    media_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # Meta's wamid for outbound messages. Captured from the Graph API
    # response when send_text/send_template/send_media succeeds; left
    # null for inbound (role=user) and system rows. Indexed because the
    # webhook status handler looks up by this on every status event.
    wa_message_id: Mapped[Optional[str]] = mapped_column(
        String(120), nullable=True, index=True
    )
    # Last delivery status reported by Meta — one of:
    #   "sent"      : Meta gateway accepted
    #   "delivered" : device received
    #   "read"      : customer opened the chat
    #   "failed"    : permanent send error (PHONE_BLOCKED, REENGAGE, etc.)
    # The frontend Bubble renders different check marks based on this.
    delivery_status: Mapped[Optional[str]] = mapped_column(
        String(16), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

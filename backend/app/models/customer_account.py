from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CustomerAccount(Base, TimestampMixin):
    """Web-portal account for an existing Customer (keyed by phone).

    A row exists only when a customer has registered for the web portal.
    No row = WhatsApp-only customer (the common case). The link to
    `customers` is one-to-one; phone is the identity.
    """

    __tablename__ = "customer_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Email is now the primary login credential (replaces phone-only OTP).
    # Unique when present; nullable for the brief window between migration
    # 0019 running and a legacy account first logging in (which forces
    # them to set an email + password). New registrations always set both.
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # bcrypt hash of the customer's password. Customer login is two-factor:
    # email+password verifies the credential, then a WhatsApp OTP step
    # (sent to customer.phone) authorizes the session.
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set when the customer's WhatsApp number is verified via OTP for the
    # first time (during registration). After that, subsequent logins
    # skip the OTP step — email + password is enough. NULL = not yet
    # verified, OTP still required on next login.
    phone_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer", lazy="joined")

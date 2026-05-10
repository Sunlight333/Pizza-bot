"""Dependencies for the customer portal routes."""
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.utils.customer_security import decode_customer_token

SESSION_COOKIE = "pz_session"


async def get_current_customer(
    pz_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    """Resolve the logged-in customer from the session cookie.

    Raises 401 if the cookie is missing, invalid, expired, or points at a
    customer that no longer exists.
    """
    if not pz_session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        claims = decode_customer_token(pz_session)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    try:
        customer_id = int(claims["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")

    res = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = res.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Customer not found")
    return customer


async def get_current_account(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> CustomerAccount:
    """Resolve the CustomerAccount tied to the logged-in customer."""
    res = await db.execute(
        select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
    )
    account = res.scalar_one_or_none()
    if account is None:
        # Should be impossible — login creates the account row. Treat as 401.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account missing")
    return account


async def get_optional_customer(
    pz_session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> Optional[Customer]:
    """Like get_current_customer but returns None instead of raising.
    Used by routes that work for guests (menu, public tracking)."""
    if not pz_session:
        return None
    try:
        claims = decode_customer_token(pz_session)
        customer_id = int(claims["sub"])
    except (ValueError, KeyError, TypeError):
        return None
    res = await db.execute(select(Customer).where(Customer.id == customer_id))
    return res.scalar_one_or_none()

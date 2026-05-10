"""Customer auth via WhatsApp OTP.

Flow:
  POST /request-otp { phone }                    -> 204 (always; no enumeration)
  POST /verify-otp  { phone, code }              -> sets session cookie, returns customer
  POST /logout                                   -> 204 (clears cookie)
  GET  /me                                       -> 200 { customer } | 401

Cookie: httpOnly, SameSite=Lax. Secure flag only set when CORS includes
an https origin (a small heuristic so dev over http://localhost still
works).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.customer.deps import SESSION_COOKIE, get_current_customer
from app.config import settings
from app.database import get_db
from app.middleware.rate_limit import limiter
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.services import otp as otp_service
from app.utils.customer_security import CUSTOMER_TOKEN_TTL_DAYS, create_customer_token

router = APIRouter()


class RequestOTPBody(BaseModel):
    phone: str = Field(..., min_length=8, max_length=32)


class VerifyOTPBody(BaseModel):
    phone: str = Field(..., min_length=8, max_length=32)
    code: str = Field(..., min_length=4, max_length=8)


class CustomerOut(BaseModel):
    id: int
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    marketing_opt_in: bool = False
    total_orders: int = 0


def _is_secure_env() -> bool:
    return any(o.startswith("https://") for o in settings.cors_origins_list)


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=CUSTOMER_TOKEN_TTL_DAYS * 24 * 3600,
        httponly=True,
        secure=_is_secure_env(),
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.post("/request-otp", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/hour")
async def request_otp(request: Request, body: RequestOTPBody):
    """Issue a WhatsApp OTP. Always 204 — never reveal whether the phone
    is registered (anti-enumeration). Genuinely failing sends still
    return 204 from the customer's perspective; the server logs the
    error so an operator can investigate."""
    phone = otp_service.normalize_phone(body.phone)
    if not phone:
        # Don't tell the caller; pretend it worked.
        return
    try:
        await otp_service.generate_and_send(phone)
    except Exception:
        # Logged in the service. Customer sees 204 either way.
        pass


@router.post("/verify-otp")
@limiter.limit("10/hour")
async def verify_otp(
    request: Request,
    body: VerifyOTPBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    phone = otp_service.normalize_phone(body.phone)
    if not phone:
        raise HTTPException(400, "Telefone inválido")

    result = await otp_service.verify(phone, body.code)
    if not result["ok"]:
        msg = {
            "expired": "Código expirado. Solicite um novo.",
            "attempts_exhausted": "Tentativas excedidas. Solicite um novo código.",
            "mismatch": "Código incorreto.",
        }.get(result.get("reason", ""), "Código inválido")
        raise HTTPException(401, msg)

    # Identity reconciliation: find Customer by phone (the same row the
    # WhatsApp bot writes to), or create if first ever contact.
    res = await db.execute(select(Customer).where(Customer.phone == phone))
    customer = res.scalar_one_or_none()
    created_customer = False
    if customer is None:
        customer = Customer(phone=phone)
        db.add(customer)
        await db.flush()
        created_customer = True

    res = await db.execute(
        select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
    )
    account = res.scalar_one_or_none()
    if account is None:
        account = CustomerAccount(customer_id=customer.id)
        db.add(account)
    account.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(customer)
    await db.refresh(account)

    token = create_customer_token(customer.id)
    _set_session_cookie(response, token)

    return {
        "customer": CustomerOut(
            id=customer.id,
            phone=customer.phone,
            name=customer.name,
            email=account.email,
            marketing_opt_in=account.marketing_opt_in,
            total_orders=customer.total_orders or 0,
        ),
        "is_new_customer": created_customer,
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    _clear_session_cookie(response)


@router.get("/me", response_model=CustomerOut)
async def me(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
    )
    account = res.scalar_one_or_none()
    return CustomerOut(
        id=customer.id,
        phone=customer.phone,
        name=customer.name,
        email=account.email if account else None,
        marketing_opt_in=account.marketing_opt_in if account else False,
        total_orders=customer.total_orders or 0,
    )

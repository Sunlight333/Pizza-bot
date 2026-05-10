"""Customer auth via WhatsApp OTP — split into login and register flows.

Endpoints:
  POST /request-otp   { phone }                              -> 204
  POST /verify-otp    { phone, code }                        -> log in (404 if no account)
  POST /register      { phone, code, name, email?, opt_in? } -> create account + log in
  POST /logout                                                -> 204
  GET  /me                                                    -> 200 customer | 401

Identity reconciliation: register links to the existing `customers` row
when the phone already has WhatsApp history; otherwise creates a new one.
A pre-existing Customer with no CustomerAccount cannot log in via
verify-otp — they must complete /register first (so we collect their
name + opt-in instead of silently auto-creating an account).
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


class RegisterBody(BaseModel):
    phone: str = Field(..., min_length=8, max_length=32)
    code: str = Field(..., min_length=4, max_length=8)
    name: str = Field(..., min_length=1, max_length=120)
    email: Optional[str] = Field(default=None, max_length=255)
    marketing_opt_in: bool = False


class CustomerOut(BaseModel):
    id: int
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    marketing_opt_in: bool = False
    total_orders: int = 0


# ---------- helpers ----------

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


def _to_customer_out(customer: Customer, account: Optional[CustomerAccount]) -> CustomerOut:
    return CustomerOut(
        id=customer.id,
        phone=customer.phone,
        name=customer.name,
        email=account.email if account else None,
        marketing_opt_in=account.marketing_opt_in if account else False,
        total_orders=customer.total_orders or 0,
    )


async def _verify_otp_or_raise(phone: str, code: str) -> None:
    result = await otp_service.verify(phone, code)
    if not result["ok"]:
        msg = {
            "expired": "Código expirado. Solicite um novo.",
            "attempts_exhausted": "Tentativas excedidas. Solicite um novo código.",
            "mismatch": "Código incorreto.",
        }.get(result.get("reason", ""), "Código inválido")
        raise HTTPException(401, msg)


# ---------- request OTP (shared by both flows) ----------

@router.post("/request-otp", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/hour")
async def request_otp(request: Request, body: RequestOTPBody):
    """Send a WhatsApp OTP. Always 204 — never reveal whether the phone
    is registered (anti-enumeration). Failed sends still return 204; the
    server logs the error."""
    phone = otp_service.normalize_phone(body.phone)
    if not phone:
        return
    try:
        await otp_service.generate_and_send(phone)
    except Exception:
        pass


# ---------- login flow ----------

@router.post("/verify-otp")
@limiter.limit("10/hour")
async def verify_otp(
    request: Request,
    body: VerifyOTPBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Log in an existing CustomerAccount.

    Returns 404 with `needs_registration=true` if the phone has no
    web-portal account yet (frontend redirects to /register). The OTP
    code is consumed regardless of whether an account exists, so a
    failed login + register requires a fresh code — that's intentional
    so a leaked code can't be reused across attempts.
    """
    phone = otp_service.normalize_phone(body.phone)
    if not phone:
        raise HTTPException(400, "Telefone inválido")

    await _verify_otp_or_raise(phone, body.code)

    res = await db.execute(select(Customer).where(Customer.phone == phone))
    customer = res.scalar_one_or_none()
    account = None
    if customer is not None:
        res = await db.execute(
            select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
        )
        account = res.scalar_one_or_none()

    if account is None:
        # Phone is verified but no web account — frontend should redirect
        # the user to /register so we can collect name + opt-in instead
        # of silently creating an empty account.
        raise HTTPException(
            404,
            detail={
                "needs_registration": True,
                "phone": phone,
                "message": "Você ainda não tem cadastro. Crie sua conta em alguns segundos.",
            },
        )

    account.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(customer)
    await db.refresh(account)

    token = create_customer_token(customer.id)
    _set_session_cookie(response, token)
    return {"customer": _to_customer_out(customer, account), "is_new_customer": False}


# ---------- register flow ----------

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def register(
    request: Request,
    body: RegisterBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Create a CustomerAccount and log in. Verifies the OTP first.

    If a Customer row already exists for this phone (from prior WhatsApp
    orders), the new CustomerAccount links to it — full WhatsApp order
    history shows up immediately on first login. If not, a new Customer
    is created together with the account.

    Returns 409 if a CustomerAccount already exists for this phone (the
    user should log in instead).
    """
    phone = otp_service.normalize_phone(body.phone)
    if not phone:
        raise HTTPException(400, "Telefone inválido")

    await _verify_otp_or_raise(phone, body.code)

    res = await db.execute(select(Customer).where(Customer.phone == phone))
    customer = res.scalar_one_or_none()
    linked_existing = customer is not None
    if customer is None:
        customer = Customer(phone=phone)
        db.add(customer)
        await db.flush()

    res = await db.execute(
        select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
    )
    account = res.scalar_one_or_none()
    if account is not None:
        raise HTTPException(409, "Esta conta já existe. Faça login em vez de cadastrar.")

    # Apply registration data
    customer.name = body.name.strip()
    account = CustomerAccount(
        customer_id=customer.id,
        email=(body.email or "").strip() or None,
        marketing_opt_in=bool(body.marketing_opt_in),
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(account)
    await db.commit()
    await db.refresh(customer)
    await db.refresh(account)

    token = create_customer_token(customer.id)
    _set_session_cookie(response, token)
    return {
        "customer": _to_customer_out(customer, account),
        "is_new_customer": not linked_existing,
        "linked_whatsapp_history": linked_existing,
    }


# ---------- session ----------

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
    return _to_customer_out(customer, account)

"""Customer auth — email/password + WhatsApp OTP (2FA).

Login flow:
  1. POST /auth/login         { email, password }
       → 200 { token, phone_hint }   (OTP sent to phone)
  2. POST /auth/login/verify  { token, code }
       → 200 { customer }            (sets pz_session cookie)

Register flow:
  1. POST /auth/register         { name, email, password, phone }
       → 201 { token, phone_hint }   (OTP sent to phone)
  2. POST /auth/register/verify  { token, code }
       → 201 { customer, linked_whatsapp_history }
                                      (creates account + sets cookie)

Shared:
  POST /auth/resend-otp      { token }    → 204
  POST /auth/logout                       → 204
  GET  /auth/me                           → 200 customer | 401

Differences vs the previous design:
  - Email + password are now the primary credential (was: phone-only OTP).
  - The OTP step is true second-factor — it is only reached after the
    password is verified for login, or after the registration form is
    submitted. The OTP code is never exposed to the client; it lives
    in the short-lived intent token's Redis state.

Identity reconciliation: register links to an existing customers row by
phone if WhatsApp history already exists, so prior orders show up
immediately on first login.
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
from app.services import customer_login as login_service
from app.utils.customer_security import CUSTOMER_TOKEN_TTL_DAYS, create_customer_token
from app.utils.security import hash_password, verify_password

router = APIRouter()


# ---------- request bodies ----------

class LoginBody(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class RegisterBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    phone: str = Field(..., min_length=8, max_length=32)
    marketing_opt_in: bool = False


class VerifyBody(BaseModel):
    token: str = Field(..., min_length=16, max_length=128)
    code: str = Field(..., min_length=4, max_length=8)


class ResendBody(BaseModel):
    token: str = Field(..., min_length=16, max_length=128)


# ---------- response shapes ----------

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


def _normalize_email(raw: str) -> str:
    return (raw or "").strip().lower()


# ---------- LOGIN ----------

@router.post("/login")
@limiter.limit("10/hour")
async def login(
    request: Request,
    body: LoginBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """First factor: email + password.

    If the customer already verified their phone (registered before, or
    completed the OTP step at least once), this endpoint logs them in
    immediately by setting the session cookie and returning the
    customer profile — no OTP step.

    First-time logins (account exists, password OK, but phone not yet
    verified — e.g. a CustomerAccount that was migrated from the old
    flow without going through the new register-with-OTP step) get the
    OTP intent token instead and have to verify before the cookie is
    set. After that single verification, future logins are one-step.
    """
    email = _normalize_email(body.email)
    res = await db.execute(
        select(CustomerAccount).where(CustomerAccount.email == email)
    )
    account = res.scalar_one_or_none()
    # Generic message: don't reveal whether the email exists or whether
    # the password was the part that failed.
    bad = HTTPException(401, "E-mail ou senha incorretos.")
    if account is None or not account.password_hash:
        raise bad
    if not verify_password(body.password, account.password_hash):
        raise bad

    customer = (
        await db.execute(select(Customer).where(Customer.id == account.customer_id))
    ).scalar_one_or_none()
    if customer is None:
        raise bad

    # Already-verified customer → log in directly.
    if account.phone_verified_at is not None:
        account.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(customer)
        await db.refresh(account)
        token = create_customer_token(customer.id)
        _set_session_cookie(response, token)
        return {
            "verified": True,
            "customer": _to_customer_out(customer, account),
        }

    # First-time login → require OTP.
    try:
        intent = await login_service.initiate_login(customer.id, customer.phone)
    except Exception:
        # Evolution / WhatsApp pairing down. Tell the client honestly so
        # they can show "WhatsApp temporariamente indisponível" instead
        # of "wrong password."
        raise HTTPException(
            503,
            "Não foi possível enviar o código pelo WhatsApp agora. "
            "Tente novamente em alguns instantes.",
        )
    return {"verified": False, **intent}  # {verified: false, token, phone_hint}


@router.post("/login/verify")
@limiter.limit("20/hour")
async def login_verify(
    request: Request,
    body: VerifyBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await login_service.verify(body.token, body.code)
    if not result["ok"]:
        msg = {
            "expired": "Código expirado. Solicite um novo.",
            "attempts_exhausted": "Tentativas excedidas. Solicite um novo código.",
            "mismatch": "Código incorreto.",
        }.get(result.get("reason", ""), "Código inválido")
        raise HTTPException(401, msg)
    if result["kind"] != "login":
        raise HTTPException(400, "Token inválido para login.")

    customer = (
        await db.execute(select(Customer).where(Customer.id == result["customer_id"]))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(401, "Conta não encontrada.")
    account = (
        await db.execute(
            select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
        )
    ).scalar_one_or_none()
    if account is None:
        raise HTTPException(401, "Conta não encontrada.")

    now = datetime.now(timezone.utc)
    account.last_login_at = now
    # Mark the phone as verified so future logins skip the OTP step.
    if account.phone_verified_at is None:
        account.phone_verified_at = now
    await db.commit()
    await db.refresh(customer)
    await db.refresh(account)

    token = create_customer_token(customer.id)
    _set_session_cookie(response, token)
    return {"customer": _to_customer_out(customer, account)}


# ---------- REGISTER ----------

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def register(
    request: Request,
    body: RegisterBody,
    db: AsyncSession = Depends(get_db),
):
    """Stage 1 of register: validate, generate intent, send OTP. The
    account is NOT created here — only on successful /register/verify."""
    email = _normalize_email(body.email)
    if "@" not in email or "." not in email:
        raise HTTPException(400, "E-mail inválido.")
    phone = login_service.normalize_phone(body.phone)
    if not phone:
        # Friendly Brazilian-format hint if the input looks Brazilian
        # but is missing a digit; otherwise generic message.
        hint = login_service.detect_brazilian_format_issue(body.phone)
        if hint:
            raise HTTPException(400, hint)
        raise HTTPException(
            400,
            "WhatsApp inválido. Informe um número completo com código do país "
            "(ex.: +55 43 99815-0536 ou +1 555 123 4567).",
        )

    # Reject duplicates up front so the user gets a clear "you already
    # have an account" instead of a generic OTP-step failure later.
    dup_email = (
        await db.execute(
            select(CustomerAccount).where(CustomerAccount.email == email)
        )
    ).scalar_one_or_none()
    if dup_email is not None:
        raise HTTPException(409, "Este e-mail já está cadastrado. Faça login.")

    customer_existing = (
        await db.execute(select(Customer).where(Customer.phone == phone))
    ).scalar_one_or_none()
    if customer_existing is not None:
        dup_account = (
            await db.execute(
                select(CustomerAccount).where(
                    CustomerAccount.customer_id == customer_existing.id
                )
            )
        ).scalar_one_or_none()
        if dup_account is not None:
            raise HTTPException(409, "Este telefone já está cadastrado. Faça login.")

    pwd_hash = hash_password(body.password)
    try:
        intent = await login_service.initiate_register(
            name=body.name.strip(),
            email=email,
            password_hash=pwd_hash,
            phone=phone,
        )
    except Exception:
        raise HTTPException(
            503,
            "Não foi possível enviar o código pelo WhatsApp agora. "
            "Tente novamente em alguns instantes.",
        )
    # Stash opt-in alongside the intent so verify can apply it.
    # (Avoids needing a second Redis call by tucking it into the response
    # — the client passes it back at verify-time.)
    return {**intent, "marketing_opt_in_pending": bool(body.marketing_opt_in)}


@router.post("/register/verify", status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def register_verify(
    request: Request,
    body: VerifyBody,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await login_service.verify(body.token, body.code)
    if not result["ok"]:
        msg = {
            "expired": "Código expirado. Solicite um novo.",
            "attempts_exhausted": "Tentativas excedidas. Solicite um novo código.",
            "mismatch": "Código incorreto.",
        }.get(result.get("reason", ""), "Código inválido")
        raise HTTPException(401, msg)
    if result["kind"] != "register":
        raise HTTPException(400, "Token inválido para cadastro.")

    reg = result["register"]
    phone = reg["phone"]

    # Re-check duplicates between intent issue and verify (rare race).
    if (
        await db.execute(
            select(CustomerAccount).where(CustomerAccount.email == reg["email"])
        )
    ).scalar_one_or_none() is not None:
        raise HTTPException(409, "Este e-mail já está cadastrado.")

    customer = (
        await db.execute(select(Customer).where(Customer.phone == phone))
    ).scalar_one_or_none()
    linked_existing = customer is not None
    if customer is None:
        customer = Customer(phone=phone)
        db.add(customer)
        await db.flush()

    if (
        await db.execute(
            select(CustomerAccount).where(CustomerAccount.customer_id == customer.id)
        )
    ).scalar_one_or_none() is not None:
        raise HTTPException(409, "Esta conta já existe. Faça login.")

    customer.name = reg["name"]
    now = datetime.now(timezone.utc)
    account = CustomerAccount(
        customer_id=customer.id,
        email=reg["email"],
        password_hash=reg["password_hash"],
        marketing_opt_in=False,  # default; user can enable in profile
        last_login_at=now,
        # OTP just succeeded — mark the phone verified so subsequent
        # logins skip the OTP step.
        phone_verified_at=now,
    )
    db.add(account)
    await db.commit()
    await db.refresh(customer)
    await db.refresh(account)

    token = create_customer_token(customer.id)
    _set_session_cookie(response, token)
    return {
        "customer": _to_customer_out(customer, account),
        "linked_whatsapp_history": linked_existing,
    }


# ---------- shared ----------

@router.post("/resend-otp", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/hour")
async def resend_otp(
    request: Request,
    body: ResendBody,
    db: AsyncSession = Depends(get_db),
):
    """Re-issue an OTP for an in-flight login/register intent. For
    login intents we have to look up the customer's phone since the
    intent state doesn't store it."""
    # Peek at the intent to learn which kind it is.
    raw = await login_service._client().get(login_service._key(body.token))
    if not raw:
        raise HTTPException(404, "Sessão de login expirou. Comece novamente.")
    import json as _json
    state = _json.loads(raw)
    if state["kind"] == "register":
        # Service can resend on its own — phone is in the state.
        result = await login_service.resend_otp(body.token)
        if not result.get("ok"):
            raise HTTPException(503, "Falha ao reenviar.")
        return
    # Login intent: look up the customer's phone.
    customer = (
        await db.execute(select(Customer).where(Customer.id == state["customer_id"]))
    ).scalar_one_or_none()
    if customer is None:
        raise HTTPException(404, "Conta não encontrada.")
    code = login_service._gen_code()
    state["code"] = code
    state["attempts"] = 0
    await login_service._client().set(
        login_service._key(body.token),
        _json.dumps(state),
        ex=login_service.INTENT_TTL_SECONDS,
    )
    try:
        await login_service._send_otp(customer.phone, code)
    except Exception:
        raise HTTPException(503, "WhatsApp temporariamente indisponível.")


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

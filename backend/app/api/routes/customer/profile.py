"""Customer profile + saved addresses.

Addresses are stored on customers.addresses (JSONB list) using the
existing shape: {label, street, number, neighborhood, complement,
reference, cep}. default_address_index points at the preferred entry.
The web portal manages this list; the WhatsApp bot reads from the same
column so changes propagate immediately.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.routes.customer.deps import get_current_account, get_current_customer
from app.database import get_db
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount

router = APIRouter()


class Address(BaseModel):
    label: str = Field(..., min_length=1, max_length=40)
    cep: Optional[str] = Field(default=None, max_length=10)
    street: str = Field(..., min_length=1, max_length=200)
    number: str = Field(..., min_length=1, max_length=20)
    neighborhood: str = Field(..., min_length=1, max_length=120)
    complement: Optional[str] = Field(default=None, max_length=120)
    reference: Optional[str] = Field(default=None, max_length=200)


class ProfilePatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    # Plain str to avoid pulling email-validator into requirements; the
    # field is optional and only used for the (deferred) email-receipt
    # feature. Add basic validation if/when receipts ship.
    email: Optional[str] = Field(default=None, max_length=255)
    birthday: Optional[date] = None
    marketing_opt_in: Optional[bool] = None


class ProfileOut(BaseModel):
    id: int
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    birthday: Optional[date] = None
    marketing_opt_in: bool = False
    total_orders: int = 0


def _profile_out(customer: Customer, account: CustomerAccount) -> ProfileOut:
    return ProfileOut(
        id=customer.id,
        phone=customer.phone,
        name=customer.name,
        email=account.email,
        birthday=customer.birthday,
        marketing_opt_in=account.marketing_opt_in,
        total_orders=customer.total_orders or 0,
    )


@router.get("", response_model=ProfileOut)
async def get_profile(
    customer: Customer = Depends(get_current_customer),
    account: CustomerAccount = Depends(get_current_account),
):
    return _profile_out(customer, account)


@router.patch("", response_model=ProfileOut)
async def patch_profile(
    payload: ProfilePatch,
    customer: Customer = Depends(get_current_customer),
    account: CustomerAccount = Depends(get_current_account),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        customer.name = (data["name"] or "").strip() or None
    if "birthday" in data:
        customer.birthday = data["birthday"]
    if "email" in data:
        account.email = (data["email"] or None) if data["email"] else None
        account.email_verified = False  # any change resets verification
    if "marketing_opt_in" in data:
        account.marketing_opt_in = bool(data["marketing_opt_in"])
    await db.commit()
    await db.refresh(customer)
    await db.refresh(account)
    return _profile_out(customer, account)


# ---------- addresses ----------

class AddressesOut(BaseModel):
    addresses: List[Address]
    default_index: int


def _addresses_out(customer: Customer) -> AddressesOut:
    raw = list(customer.addresses or [])
    parsed: list[Address] = []
    for a in raw:
        # Tolerate legacy entries that may be missing fields.
        try:
            parsed.append(
                Address(
                    label=a.get("label") or "Endereço",
                    cep=a.get("cep"),
                    street=a.get("street") or "",
                    number=a.get("number") or "s/n",
                    neighborhood=a.get("neighborhood") or "",
                    complement=a.get("complement"),
                    reference=a.get("reference"),
                )
            )
        except Exception:
            continue
    idx = customer.default_address_index or 0
    if not parsed:
        idx = 0
    elif idx >= len(parsed):
        idx = 0
    return AddressesOut(addresses=parsed, default_index=idx)


@router.get("/addresses", response_model=AddressesOut)
async def list_addresses(customer: Customer = Depends(get_current_customer)):
    return _addresses_out(customer)


@router.post("/addresses", response_model=AddressesOut, status_code=status.HTTP_201_CREATED)
async def add_address(
    payload: Address,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    addrs = list(customer.addresses or [])
    addrs.append(payload.model_dump())
    customer.addresses = addrs
    flag_modified(customer, "addresses")
    # First address auto-becomes default.
    if len(addrs) == 1:
        customer.default_address_index = 0
    await db.commit()
    await db.refresh(customer)
    return _addresses_out(customer)


@router.patch("/addresses/{idx}", response_model=AddressesOut)
async def update_address(
    idx: int,
    payload: Address,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    addrs = list(customer.addresses or [])
    if idx < 0 or idx >= len(addrs):
        raise HTTPException(404, "Endereço não encontrado")
    addrs[idx] = payload.model_dump()
    customer.addresses = addrs
    flag_modified(customer, "addresses")
    await db.commit()
    await db.refresh(customer)
    return _addresses_out(customer)


@router.delete("/addresses/{idx}", response_model=AddressesOut)
async def delete_address(
    idx: int,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    addrs = list(customer.addresses or [])
    if idx < 0 or idx >= len(addrs):
        raise HTTPException(404, "Endereço não encontrado")
    addrs.pop(idx)
    customer.addresses = addrs
    flag_modified(customer, "addresses")
    # Reset default if we deleted it or anything before it.
    if customer.default_address_index >= len(addrs):
        customer.default_address_index = 0
    await db.commit()
    await db.refresh(customer)
    return _addresses_out(customer)


@router.post("/addresses/{idx}/default", response_model=AddressesOut)
async def set_default_address(
    idx: int,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    addrs = list(customer.addresses or [])
    if idx < 0 or idx >= len(addrs):
        raise HTTPException(404, "Endereço não encontrado")
    customer.default_address_index = idx
    await db.commit()
    await db.refresh(customer)
    return _addresses_out(customer)

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class Address(BaseModel):
    label: Optional[str] = None
    street: str
    number: Optional[str] = None
    neighborhood: Optional[str] = None
    complement: Optional[str] = None
    reference: Optional[str] = None


class CustomerBase(BaseModel):
    phone: str = Field(..., min_length=8, max_length=32)
    name: Optional[str] = None
    cpf: Optional[str] = None
    addresses: List[Address] = []
    default_address_index: int = 0


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    cpf: Optional[str] = None
    addresses: Optional[List[Address]] = None
    default_address_index: Optional[int] = None


class CustomerOut(CustomerBase):
    id: int
    total_orders: int = 0
    last_order_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CustomerListItem(BaseModel):
    id: int
    phone: str
    name: Optional[str] = None
    total_orders: int = 0
    last_order_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

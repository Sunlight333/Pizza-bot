from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus, PaymentMethod


class OrderItemIn(BaseModel):
    product_id: Optional[int] = None
    description: str
    unit_price: float
    quantity: int = 1
    unit: str = "UN"
    is_delivery_fee: bool = False


class OrderCreate(BaseModel):
    customer_phone: str
    customer_name: Optional[str] = None
    customer_cpf: Optional[str] = None
    items: List[OrderItemIn]
    delivery_address: Optional[str] = None
    delivery_neighborhood: Optional[str] = None
    delivery_fee: float = 0
    payment_method: PaymentMethod
    observation: Optional[str] = None


class OrderItemOut(BaseModel):
    id: int
    product_id: Optional[int]
    description: str
    unit_price: float
    quantity: int
    unit: str
    is_delivery_fee: bool
    model_config = ConfigDict(from_attributes=True)


class OrderOut(BaseModel):
    id: int
    order_number: int
    customer_id: int
    customer_phone: str
    customer_name: Optional[str] = None
    status: OrderStatus
    subtotal: float
    delivery_fee: float
    total: float
    payment_method: PaymentMethod
    payment_code: str
    delivery_address: Optional[str]
    delivery_neighborhood: Optional[str]
    observation: Optional[str]
    datacaixa_synced: bool
    datacaixa_file: Optional[str]
    fiscal_emitted: bool = False
    fiscal_emitted_at: Optional[datetime] = None
    scheduled_for: Optional[datetime] = None
    items: List[OrderItemOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderStats(BaseModel):
    orders_today: int
    revenue_today: float
    avg_ticket: float
    avg_delivery_minutes: Optional[float] = None
    by_status: dict[str, int] = {}
    by_hour: list[dict] = Field(default_factory=list)
    revenue_7d: list[dict] = Field(default_factory=list)
    by_dow_hour: list[dict] = Field(default_factory=list)
    sync_pending: int = 0
    sync_completed_today: int = 0

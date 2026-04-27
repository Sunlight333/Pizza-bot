from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DeliveryZoneBase(BaseModel):
    neighborhood: str = Field(..., min_length=1, max_length=120)
    fee: float = Field(..., ge=0)
    estimated_minutes: int = Field(default=45, ge=0)
    is_active: bool = True
    distance_min_km: Optional[float] = Field(default=None, ge=0)
    distance_max_km: Optional[float] = Field(default=None, ge=0)


class DeliveryZoneCreate(DeliveryZoneBase):
    pass


class DeliveryZoneUpdate(BaseModel):
    neighborhood: Optional[str] = None
    fee: Optional[float] = None
    estimated_minutes: Optional[int] = None
    is_active: Optional[bool] = None
    distance_min_km: Optional[float] = Field(default=None, ge=0)
    distance_max_km: Optional[float] = Field(default=None, ge=0)


class DeliveryZoneOut(DeliveryZoneBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ZoneLookupResult(BaseModel):
    matched: bool
    neighborhood: Optional[str] = None
    fee: Optional[float] = None
    estimated_minutes: Optional[int] = None
    confidence: Optional[float] = None

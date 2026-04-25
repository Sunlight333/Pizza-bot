from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


HalfPizzaPricing = Literal["max", "average", "first"]
FiscalEmissionMode = Literal["auto", "manual"]


class BotConfigBase(BaseModel):
    greeting: str = Field(..., min_length=1)
    enable_repeat_last_order: bool = True
    working_hours_start: int = Field(18, ge=0, le=23)
    working_hours_end: int = Field(23, ge=0, le=24)
    off_hours_message: str
    max_items_per_order: int = Field(15, ge=1, le=100)
    ask_cpf: bool = False
    tts_enabled: bool = False
    extra_system_prompt: Optional[str] = None

    half_pizza_pricing: HalfPizzaPricing = "max"
    default_ncm: Optional[str] = None
    default_cfop: Optional[str] = None
    default_csosn: Optional[str] = None
    default_cest: Optional[str] = None
    default_origin_code: Optional[str] = None
    default_ibpt_code: Optional[str] = None
    fiscal_emission_mode: FiscalEmissionMode = "manual"
    privacy_notice: Optional[str] = None
    daily_token_budget: int = Field(0, ge=0)


class BotConfigUpdate(BaseModel):
    greeting: Optional[str] = None
    enable_repeat_last_order: Optional[bool] = None
    working_hours_start: Optional[int] = None
    working_hours_end: Optional[int] = None
    off_hours_message: Optional[str] = None
    max_items_per_order: Optional[int] = None
    ask_cpf: Optional[bool] = None
    tts_enabled: Optional[bool] = None
    extra_system_prompt: Optional[str] = None

    half_pizza_pricing: Optional[HalfPizzaPricing] = None
    default_ncm: Optional[str] = None
    default_cfop: Optional[str] = None
    default_csosn: Optional[str] = None
    default_cest: Optional[str] = None
    default_origin_code: Optional[str] = None
    default_ibpt_code: Optional[str] = None
    fiscal_emission_mode: Optional[FiscalEmissionMode] = None
    privacy_notice: Optional[str] = None
    daily_token_budget: Optional[int] = Field(default=None, ge=0)


class BotConfigOut(BotConfigBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

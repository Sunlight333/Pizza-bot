from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    display_order: int = 0
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryOut(CategoryBase):
    id: int
    product_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class SizePrice(BaseModel):
    size: str
    price: float
    # None = inherit from Product.allows_half (legacy rows). True/False = explicit
    # per-size rule. Pichya: only "grande" allows meia-a-meia.
    allows_half: Optional[bool] = None


class ExtraOption(BaseModel):
    """Adicional (extra topping). price=0 means it's free (e.g. cebola, requeijão)."""
    name: str = Field(..., min_length=1, max_length=80)
    price: float = 0.0


class CrustOption(BaseModel):
    """Borda (stuffed crust). price=0 = no charge ("sem borda")."""
    name: str = Field(..., min_length=1, max_length=80)
    price: float = 0.0


def _normalize_named_options(value):
    """
    Pre-migration rows store options as plain strings. Coerce each legacy
    string to {name: <str>, price: 0} so ProductOut still validates while
    the migration is rolling out (or for any data missed by the backfill).
    """
    if value is None:
        return value
    out = []
    for v in value:
        if isinstance(v, str):
            out.append({"name": v, "price": 0.0})
        else:
            out.append(v)
    return out


# Backwards-compat alias — older imports still call _normalize_extras.
_normalize_extras = _normalize_named_options


class ProductBase(BaseModel):
    category_id: int
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    sizes: List[SizePrice] = []
    is_pizza: bool = False
    allows_half: bool = False
    available_crusts: List[CrustOption] = []
    available_extras: List[ExtraOption] = []

    @field_validator("available_crusts", "available_extras", mode="before")
    @classmethod
    def _coerce_options(cls, v):
        return _normalize_named_options(v)
    ncm: Optional[str] = None
    cfop: Optional[str] = None
    csosn: Optional[str] = None
    cest: Optional[str] = None
    ibpt_code: Optional[str] = None
    origin_code: Optional[str] = None
    datacaixa_code: Optional[str] = None
    is_active: bool = True
    image_url: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sizes: Optional[List[SizePrice]] = None
    is_pizza: Optional[bool] = None
    allows_half: Optional[bool] = None
    available_crusts: Optional[List[CrustOption]] = None
    available_extras: Optional[List[ExtraOption]] = None

    @field_validator("available_crusts", "available_extras", mode="before")
    @classmethod
    def _coerce_options(cls, v):
        return _normalize_named_options(v)
    ncm: Optional[str] = None
    cfop: Optional[str] = None
    csosn: Optional[str] = None
    cest: Optional[str] = None
    ibpt_code: Optional[str] = None
    origin_code: Optional[str] = None
    datacaixa_code: Optional[str] = None
    is_active: Optional[bool] = None
    image_url: Optional[str] = None


class ProductOut(ProductBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

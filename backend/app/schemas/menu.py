from typing import Dict, List, Optional

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
    # per-size rule (e.g. only "grande" allows meia-a-meia).
    allows_half: Optional[bool] = None


class ExtraOption(BaseModel):
    """Adicional (extra topping). prices map size -> charge; missing/0 = free."""
    name: str = Field(..., min_length=1, max_length=80)
    prices: Dict[str, float] = Field(default_factory=dict)


class CrustOption(BaseModel):
    """Borda. prices map size -> charge (Catupiry costs less on brotinho)."""
    name: str = Field(..., min_length=1, max_length=80)
    prices: Dict[str, float] = Field(default_factory=dict)


def _normalize_named_options(value):
    """
    Coerce legacy shapes into {name, prices: {}}:
      - bare strings (pre-0007/0009): "Catupiry"
      - flat-price dicts (0007..0009): {"name": "Catupiry", "price": 5}
    Migration 0010 already does this in the DB; this validator backstops
    rows the backfill missed (or callers passing the old shape).
    """
    if value is None:
        return value
    out = []
    for v in value:
        if isinstance(v, str):
            out.append({"name": v, "prices": {}})
        elif isinstance(v, dict):
            if "prices" in v:
                out.append(v)
            elif "price" in v:
                # We don't know the product's sizes here, so fall back to an
                # empty map and let the consumer treat "missing size" as 0.
                # The flat price is dropped — not ideal but acceptable since
                # the migration handles real data.
                out.append({"name": v.get("name") or "", "prices": {}})
            else:
                out.append({"name": v.get("name") or "", "prices": v.get("prices") or {}})
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

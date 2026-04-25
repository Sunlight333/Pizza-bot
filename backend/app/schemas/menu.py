from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


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


class ProductBase(BaseModel):
    category_id: int
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    sizes: List[SizePrice] = []
    is_pizza: bool = False
    allows_half: bool = False
    available_crusts: List[str] = []
    available_extras: List[str] = []
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
    available_crusts: Optional[List[str]] = None
    available_extras: Optional[List[str]] = None
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

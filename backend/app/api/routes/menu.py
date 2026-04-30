import csv
import io
import mimetypes
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user
from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.menu import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)

router = APIRouter(dependencies=[Depends(get_current_user)])


# ---------- Categories ----------

@router.get("/categories", response_model=List[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    count_subq = (
        select(Product.category_id, func.count(Product.id).label("cnt"))
        .group_by(Product.category_id)
        .subquery()
    )
    result = await db.execute(
        select(Category, func.coalesce(count_subq.c.cnt, 0))
        .outerjoin(count_subq, Category.id == count_subq.c.category_id)
        .order_by(Category.display_order, Category.id)
    )
    out = []
    for cat, cnt in result.all():
        data = CategoryOut.model_validate(cat).model_dump()
        data["product_count"] = int(cnt or 0)
        out.append(data)
    return out


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate, db: AsyncSession = Depends(get_db)):
    cat = Category(**payload.model_dump())
    db.add(cat)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(400, "Category name already exists")
    await db.refresh(cat)
    return {**CategoryOut.model_validate(cat).model_dump(), "product_count": 0}


@router.put("/categories/{cat_id}", response_model=CategoryOut)
async def update_category(cat_id: int, payload: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    cat = (await db.execute(select(Category).where(Category.id == cat_id))).scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    await db.commit()
    await db.refresh(cat)
    return {**CategoryOut.model_validate(cat).model_dump(), "product_count": 0}


@router.delete("/categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(cat_id: int, db: AsyncSession = Depends(get_db)):
    cat = (await db.execute(select(Category).where(Category.id == cat_id))).scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.is_active = False
    await db.commit()


# ---------- Products ----------

@router.get("/products", response_model=List[ProductOut])
async def list_products(
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    is_pizza: Optional[bool] = None,
    search: Optional[str] = Query(None, min_length=1, max_length=120),
    db: AsyncSession = Depends(get_db),
):
    q = select(Product)
    if category_id is not None:
        q = q.where(Product.category_id == category_id)
    if is_active is not None:
        q = q.where(Product.is_active.is_(is_active))
    if is_pizza is not None:
        q = q.where(Product.is_pizza.is_(is_pizza))
    if search:
        q = q.where(Product.name.ilike(f"%{search}%"))
    q = q.order_by(Product.name)
    res = await db.execute(q)
    return res.scalars().all()


# NOTE: literal-path routes ('missing-tax', 'tax-import') are registered
# AFTER the list endpoint but BEFORE the {prod_id} parametric routes, so
# FastAPI doesn't parse them as integer IDs.

TAX_CSV_COLUMNS = ("name", "ncm", "cfop", "csosn", "cest", "origin_code", "ibpt_code", "datacaixa_code")

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB

PRODUCT_MEDIA_DIR = Path(__file__).resolve().parents[3] / "media" / "products"


@router.post("/products/upload-image")
async def upload_product_image(file: UploadFile = File(...)):
    """
    Save an uploaded product photo (camera capture or device upload) to the
    media directory and return its public URL. The caller persists the URL
    in the product's image_url field via the regular update endpoint.
    """
    ctype = (file.content_type or "").lower()
    ext = ALLOWED_IMAGE_TYPES.get(ctype)
    if not ext:
        # Some browsers send octet-stream from camera capture — fall back to
        # the filename's extension when the MIME type is missing/generic.
        guessed, _ = mimetypes.guess_type(file.filename or "")
        ext = ALLOWED_IMAGE_TYPES.get((guessed or "").lower())
    if not ext:
        raise HTTPException(400, "Unsupported image type (use jpg/png/webp/gif)")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Empty file")
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(400, f"File too large (max {MAX_IMAGE_BYTES // (1024 * 1024)} MB)")

    PRODUCT_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    (PRODUCT_MEDIA_DIR / name).write_bytes(contents)
    return {"url": f"/media/products/{name}"}


@router.post("/products/tax-import")
async def bulk_import_product_tax(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    CSV with header row. Required column: 'name' (matched case-insensitively).
    Optional: ncm, cfop, csosn, cest, origin_code, ibpt_code, datacaixa_code.
    Empty cells are skipped (don't overwrite existing values).
    """
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or "name" not in reader.fieldnames:
        raise HTTPException(400, "CSV must include a 'name' column")

    products = (await db.execute(select(Product))).scalars().all()
    by_name = {p.name.lower(): p for p in products}

    updated = 0
    not_found: list[str] = []
    errors: list[str] = []

    for row_idx, row in enumerate(reader, 2):
        try:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            p = by_name.get(name.lower())
            if not p:
                not_found.append(name)
                continue
            for col in TAX_CSV_COLUMNS[1:]:
                val = (row.get(col) or "").strip()
                if val:
                    setattr(p, col, val)
            updated += 1
        except Exception as e:
            errors.append(f"row {row_idx}: {e}")

    await db.commit()
    return {"updated": updated, "not_found": not_found, "errors": errors}


@router.get("/products/missing-tax")
async def list_missing_tax(db: AsyncSession = Depends(get_db)):
    """List active products with at least one fiscal field empty."""
    res = await db.execute(
        select(Product).where(
            Product.is_active.is_(True),
            or_(
                Product.ncm.is_(None),
                Product.ncm == "",
                Product.cfop.is_(None),
                Product.cfop == "",
                Product.csosn.is_(None),
                Product.csosn == "",
            ),
        )
    )
    items = res.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "missing": [
                f
                for f in ("ncm", "cfop", "csosn", "cest", "origin_code", "ibpt_code")
                if not (getattr(p, f) or "").strip()
            ],
        }
        for p in items
    ]


# ---------- Operator bulk tools (registered before {prod_id} so the
# literal segments aren't parsed as ints) ----------


class BulkAllowsHalfRequest(BaseModel):
    """Apply allows_half=<value> to every size whose name matches."""
    size_names: List[str] = Field(..., min_length=1)
    allows_half: bool


@router.post("/products/bulk-allows-half")
async def bulk_allows_half(
    payload: BulkAllowsHalfRequest, db: AsyncSession = Depends(get_db)
):
    """
    Pizzaria-wide rule: e.g. "brotinho is always 1-flavor". Walks every
    pizza, sets allows_half on each matching size (case-insensitive),
    and returns the count of products that actually changed.
    """
    targets = {n.lower() for n in payload.size_names}
    products = (
        await db.execute(select(Product).where(Product.is_pizza.is_(True)))
    ).scalars().all()
    affected = 0
    for p in products:
        new_sizes = list(p.sizes or [])
        changed = False
        for s in new_sizes:
            if isinstance(s, dict) and s.get("size", "").lower() in targets:
                if s.get("allows_half") is not payload.allows_half:
                    s["allows_half"] = payload.allows_half
                    changed = True
        if changed:
            p.sizes = new_sizes
            flag_modified(p, "sizes")
            affected += 1
    await db.commit()
    return {"products_affected": affected, "size_names": payload.size_names}


@router.post("/products/{prod_id}/replicate-options")
async def replicate_options(prod_id: int, db: AsyncSession = Depends(get_db)):
    """
    Copy this pizza's available_crusts and available_extras to every other
    active pizza. Lets the operator configure one pizza fully and propagate
    instead of editing 50 cards by hand.
    """
    src = (
        await db.execute(select(Product).where(Product.id == prod_id))
    ).scalar_one_or_none()
    if not src:
        raise HTTPException(404, "Product not found")
    if not src.is_pizza:
        raise HTTPException(400, "Source must be a pizza")
    targets = (
        await db.execute(
            select(Product).where(
                Product.is_pizza.is_(True),
                Product.is_active.is_(True),
                Product.id != prod_id,
            )
        )
    ).scalars().all()
    for t in targets:
        t.available_crusts = list(src.available_crusts or [])
        t.available_extras = list(src.available_extras or [])
        flag_modified(t, "available_crusts")
        flag_modified(t, "available_extras")
    await db.commit()
    return {"products_affected": len(targets), "source": src.name}


@router.get("/products/data-warnings")
async def data_warnings(db: AsyncSession = Depends(get_db)):
    """
    Surface obvious data-entry mistakes the operator should review before the
    bot starts quoting wrong prices. Active products only.
    """
    products = (
        await db.execute(select(Product).where(Product.is_active.is_(True)))
    ).scalars().all()
    out: list[dict] = []

    for p in products:
        # Pizza without crusts is almost always a forgotten field.
        if p.is_pizza and not (p.available_crusts or []):
            out.append({
                "product_id": p.id,
                "name": p.name,
                "type": "pizza_without_crusts",
                "message": "Pizza sem bordas cadastradas",
            })

        # Pizza marked as half-allowed but no size accepts it (post-0011 this
        # should never happen, but a corrupt manual edit could create it).
        if p.is_pizza and p.allows_half:
            has_half = any(
                isinstance(s, dict) and s.get("allows_half")
                for s in (p.sizes or [])
            )
            if not has_half:
                out.append({
                    "product_id": p.id,
                    "name": p.name,
                    "type": "no_half_size",
                    "message": "Pizza marcada como meia-a-meia mas nenhum tamanho permite",
                })

        # Suspicious option prices: > 70% of the size's base price is almost
        # certainly a typo (e.g. R$ 109,80 for a R$ 35 brotinho border).
        for s in (p.sizes or []):
            if not isinstance(s, dict):
                continue
            base = float(s.get("price") or 0)
            sn = s.get("size", "")
            if base <= 0 or not sn:
                continue
            for c in (p.available_crusts or []):
                cp = float(((c.get("prices") or {}) if isinstance(c, dict) else {}).get(sn, 0) or 0)
                if cp > base * 0.7:
                    out.append({
                        "product_id": p.id,
                        "name": p.name,
                        "type": "crust_price_suspicious",
                        "message": (
                            f"Borda '{c.get('name')}' R$ {cp:.2f} é >70% do "
                            f"preço da pizza ({sn} R$ {base:.2f})"
                        ).replace(".", ","),
                    })
            for e in (p.available_extras or []):
                ep = float(((e.get("prices") or {}) if isinstance(e, dict) else {}).get(sn, 0) or 0)
                if ep > base * 0.5:
                    out.append({
                        "product_id": p.id,
                        "name": p.name,
                        "type": "extra_price_suspicious",
                        "message": (
                            f"Adicional '{e.get('name')}' R$ {ep:.2f} é >50% do "
                            f"preço da pizza ({sn} R$ {base:.2f})"
                        ).replace(".", ","),
                    })

    return out


@router.get("/products/{prod_id}", response_model=ProductOut)
async def get_product(prod_id: int, db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(Product).where(Product.id == prod_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db)):
    data = payload.model_dump()
    data["sizes"] = [s if isinstance(s, dict) else s.model_dump() for s in data.get("sizes", [])]
    p = Product(**data)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


@router.put("/products/{prod_id}", response_model=ProductOut)
async def update_product(prod_id: int, payload: ProductUpdate, db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(Product).where(Product.id == prod_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    data = payload.model_dump(exclude_unset=True)
    if "sizes" in data and data["sizes"] is not None:
        data["sizes"] = [s if isinstance(s, dict) else s.model_dump() for s in data["sizes"]]
    for k, v in data.items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/products/{prod_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(prod_id: int, db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(Product).where(Product.id == prod_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Product not found")
    p.is_active = False
    await db.commit()

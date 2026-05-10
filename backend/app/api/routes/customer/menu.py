"""Public menu for the customer portal.

Reads from the same Category/Product tables admin uses. Returns the
shape the customer site renders directly: categories grouped, with each
product's sizes / crusts / extras ready to display, fiscal fields
stripped (NCM/CFOP/CSOSN/etc — never leaked to a public endpoint).

Image resolution priority (matches the admin Menu page so what the
operator sees in admin matches what the customer sees on the portal):
  1. Per-product photo: Product.image_urls[0] (or legacy Product.image_url)
  2. Per-category fallback: BotConfig.menu_images[<category-key>] —
     operators upload one photo per category in Settings → Menu Images;
     the bot's send_menu_image tool uses the same map. Most pizzarias
     only set the category fallback, so without this every photoless
     product would render as a generic placeholder even though the
     operator did upload a photo.
  3. Empty list → frontend renders PlaceholderArt (initials on a
     deterministic warm gradient).

Cached in Redis for 60s under `customer:menu:public`. Invalidated on
admin product/category writes (see invalidate() below). Bot-config
edits also invalidate via the bot_config write endpoint.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.bot_config import BotConfig
from app.models.category import Category
from app.models.product import Product

import redis.asyncio as redis

log = logging.getLogger(__name__)

router = APIRouter()

CACHE_KEY = "customer:menu:public"
CACHE_TTL_SECONDS = 60

HIDDEN = "__hidden__"

_redis: Optional[redis.Redis] = None


def _client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def invalidate() -> None:
    """Drop the cached menu. Call from any admin endpoint that mutates
    products, categories, or bot_config.menu_images so customer-side
    updates appear within seconds."""
    try:
        await _client().delete(CACHE_KEY)
    except Exception:
        log.exception("menu cache invalidation failed")


# Map a category name to the bot_config.menu_images key the operator
# uploads under. Same heuristic as the admin frontend's pizzaImage()
# helper so the two views stay consistent.
def _category_image_key(category_name: str) -> Optional[str]:
    n = (category_name or "").lower()
    # Order matters — "doce" must win before the generic "pizza" fallback
    # for "Pizzas Doces".
    if "doce" in n:
        return "doce"
    if "sorvete" in n:
        return "sorvete"
    if "bebida" in n:
        return "bebida"
    if "salgada" in n or "pizza" in n:
        return "salgada"
    return None


def _resolve_image_urls(p: Product, category_name: str, menu_images: dict) -> list[str]:
    # 1. Per-product photo
    urls = [u for u in (p.image_urls or []) if u and u != HIDDEN]
    if not urls and p.image_url and p.image_url != HIDDEN:
        urls = [p.image_url]
    if urls:
        return urls

    # Honor "explicitly hidden" — operator chose to suppress the image.
    # In that case skip the category fallback too; render PlaceholderArt
    # on the client.
    if p.image_url == HIDDEN:
        return []

    # 2. Per-category fallback from bot_config.menu_images
    key = _category_image_key(category_name)
    if key and isinstance(menu_images, dict):
        fallback = menu_images.get(key)
        if fallback:
            return [fallback]

    # 3. Nothing — client renders branded placeholder
    return []


def _serialize_product(p: Product, category_name: str, menu_images: dict) -> dict:
    sizes = []
    for s in (p.sizes or []):
        if not isinstance(s, dict):
            continue
        try:
            sizes.append({
                "size": s.get("size", ""),
                "price": float(s.get("price") or 0),
                "allows_half": bool(s.get("allows_half")) if s.get("allows_half") is not None else None,
            })
        except (TypeError, ValueError):
            continue

    def _opt(entry):
        if isinstance(entry, dict):
            prices = entry.get("prices")
            return {
                "name": entry.get("name", ""),
                "prices": prices if isinstance(prices, dict) else None,
                "price": (
                    float(entry["price"])
                    if entry.get("price") is not None and not isinstance(prices, dict)
                    else None
                ),
            }
        # legacy plain string
        return {"name": str(entry), "prices": None, "price": None}

    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "category_id": p.category_id,
        "is_pizza": p.is_pizza,
        "allows_half": p.allows_half,
        "sizes": sizes,
        "min_price": min((s["price"] for s in sizes if s["price"] > 0), default=0.0),
        "available_crusts": [_opt(c) for c in (p.available_crusts or [])],
        "available_extras": [_opt(e) for e in (p.available_extras or [])],
        "image_urls": _resolve_image_urls(p, category_name, menu_images),
    }


async def _load_menu_images(db: AsyncSession) -> dict:
    cfg = (
        await db.execute(select(BotConfig).where(BotConfig.id == 1))
    ).scalar_one_or_none()
    return dict(cfg.menu_images or {}) if cfg else {}


@router.get("")
async def get_menu(db: AsyncSession = Depends(get_db)):
    """Returns: { categories: [{id,name,display_order}],
                  products:   [{...full},...] }"""
    cached = None
    try:
        cached = await _client().get(CACHE_KEY)
    except Exception:
        log.exception("menu cache read failed")
    if cached:
        return json.loads(cached)

    cats_res = await db.execute(
        select(Category)
        .where(Category.is_active.is_(True))
        .order_by(Category.display_order, Category.id)
    )
    cats = list(cats_res.scalars().all())
    categories = [
        {"id": c.id, "name": c.name, "display_order": c.display_order}
        for c in cats
    ]
    cat_name_by_id = {c.id: c.name for c in cats}

    menu_images = await _load_menu_images(db)

    prods_res = await db.execute(
        select(Product)
        .where(Product.is_active.is_(True))
        .order_by(Product.category_id, Product.name)
    )
    products = [
        _serialize_product(p, cat_name_by_id.get(p.category_id, ""), menu_images)
        for p in prods_res.scalars().all()
    ]
    payload = {"categories": categories, "products": products}

    try:
        await _client().set(CACHE_KEY, json.dumps(payload), ex=CACHE_TTL_SECONDS)
    except Exception:
        log.exception("menu cache write failed")

    return payload


@router.get("/products/{product_id}")
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    """Single-product detail. Not cached; lighter than the full menu and
    used by direct-link product pages."""
    p = (
        await db.execute(
            select(Product).where(Product.id == product_id, Product.is_active.is_(True))
        )
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Produto não encontrado")
    cat = (
        await db.execute(select(Category).where(Category.id == p.category_id))
    ).scalar_one_or_none()
    menu_images = await _load_menu_images(db)
    return _serialize_product(p, cat.name if cat else "", menu_images)

"""Public menu for the customer portal.

Reads from the same Category/Product tables admin uses. Returns the
shape the customer site renders directly: categories grouped, with each
product's sizes / crusts / extras ready to display, fiscal fields
stripped (NCM/CFOP/CSOSN/etc — never leaked to a public endpoint).

Image policy: this endpoint returns ONLY the explicit per-product photo
the operator uploaded (Product.image_urls[0] / Product.image_url). When
no per-product photo is set, image_urls is empty and the customer
frontend resolves a fallback via the same `pizzaImage()` helper the
admin Menu page uses — keyword-matched stock pizza photos plus a
category-level static fallback. That keeps both portals visually in
sync without conflating the bot's send_menu_image map (which holds the
*printed cardápio* photo, not per-product fallbacks) with card art.

Cached in Redis for 60s under `customer:menu:public`. Invalidated on
admin product / category writes (see invalidate() below).
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


def _resolve_image_urls(p: Product) -> list[str]:
    """Per-product photos only. Empty list = no operator photo; frontend
    chooses a fallback via pizzaImage()."""
    urls = [u for u in (p.image_urls or []) if u and u != HIDDEN]
    if not urls and p.image_url and p.image_url != HIDDEN:
        urls = [p.image_url]
    return urls


def _serialize_product(p: Product, category_name: str = "") -> dict:
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
        # Frontend uses category_name to drive the pizzaImage() fallback
        # — same logic the admin Menu page uses, so a photoless product
        # renders the identical stock photo on both portals.
        "category_name": category_name,
        "is_pizza": p.is_pizza,
        "allows_half": p.allows_half,
        "sizes": sizes,
        "min_price": min((s["price"] for s in sizes if s["price"] > 0), default=0.0),
        "available_crusts": [_opt(c) for c in (p.available_crusts or [])],
        "available_extras": [_opt(e) for e in (p.available_extras or [])],
        "image_urls": _resolve_image_urls(p),
    }


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
        {"id": c.id, "name": c.name, "display_order": c.display_order} for c in cats
    ]
    cat_name_by_id = {c.id: c.name for c in cats}

    prods_res = await db.execute(
        select(Product)
        .where(Product.is_active.is_(True))
        .order_by(Product.category_id, Product.name)
    )
    products = [
        _serialize_product(p, cat_name_by_id.get(p.category_id, ""))
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
    return _serialize_product(p, cat.name if cat else "")

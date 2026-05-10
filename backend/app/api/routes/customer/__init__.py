"""Customer-portal API.

All routes are mounted under /api/customer in main.py. Auth is via an
httpOnly JWT cookie (`pz_session`) issued by /auth/verify-otp; tokens
are scoped with `aud='customer'` so admin and customer auth never cross.
"""
from fastapi import APIRouter

from app.api.routes.customer import (
    auth,
    cart,
    checkout,
    menu,
    orders,
    profile,
    track,
)

router = APIRouter(prefix="/customer", tags=["customer"])

router.include_router(auth.router, prefix="/auth")
router.include_router(menu.router, prefix="/menu")
router.include_router(profile.router, prefix="/profile")
router.include_router(cart.router, prefix="/cart")
router.include_router(checkout.router, prefix="/checkout")
router.include_router(orders.router, prefix="/orders")
router.include_router(track.router, prefix="/track")

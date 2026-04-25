from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse, UserOut
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    access = create_access_token(subject=user.id, extra={"role": user.role.value})
    refresh = create_refresh_token(subject=user.id)
    return TokenResponse(
        access_token=access,
        expires_in_hours=settings.jwt_expire_hours,
        refresh_token=refresh,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(401, "Invalid refresh token")
    if claims.get("type") != "refresh":
        raise HTTPException(401, "Not a refresh token")
    user = (await db.execute(select(User).where(User.id == int(claims["sub"])))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(401, "User inactive")
    access = create_access_token(subject=user.id, extra={"role": user.role.value})
    new_refresh = create_refresh_token(subject=user.id)
    return TokenResponse(
        access_token=access,
        expires_in_hours=settings.jwt_expire_hours,
        refresh_token=new_refresh,
    )


@router.get("/me", response_model=UserOut)
async def me(current: User = Depends(get_current_user)):
    return current

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel, Field

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
    hash_password,
    verify_password,
)


class ChangePasswordBody(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=6, max_length=200)

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


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordBody,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logged-in user changes their own password. Requires the current
    password as proof of identity."""
    if not verify_password(payload.current_password, current.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Senha atual incorreta.",
        )
    current.password_hash = hash_password(payload.new_password)
    await db.commit()

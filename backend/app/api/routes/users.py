"""Admin user management.

CRUD over `users` table — used by the Configurações → Usuários page.
All endpoints require an authenticated user with role=admin (operators
in the `attendant` role can use the panel but can't add or remove other
users; that's a hard guard so no junior staff can self-promote).

Endpoints:
  GET    /api/admin/users               list active + disabled users
  POST   /api/admin/users               create new user (any role)
  PATCH  /api/admin/users/{id}          update username/role/is_active
  POST   /api/admin/users/{id}/password reset another user's password
  DELETE /api/admin/users/{id}          soft delete (sets is_active=false)
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import UserOut
from app.utils.security import hash_password


router = APIRouter()


def _require_admin(user: User) -> None:
    if user.role != UserRole.admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Apenas administradores podem gerenciar usuários.",
        )


# ---------- request bodies ----------

class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=80)
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole = UserRole.attendant


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=2, max_length=80)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    password: str = Field(..., min_length=6, max_length=128)


# ---------- routes ----------

@router.get("", response_model=List[UserOut])
async def list_users(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Any authenticated admin user can list — we surface the table to
    every admin-level operator. Attendants get 403."""
    _require_admin(current)
    res = await db.execute(select(User).order_by(User.username))
    return res.scalars().all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current)
    username = payload.username.strip()
    existing = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(409, "Já existe um usuário com este nome.")
    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current)
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuário não encontrado.")
    data = payload.model_dump(exclude_unset=True)

    # Guard: don't allow demoting or disabling yourself — would lock the
    # user out of admin and is almost always a misclick. Reset/edit via
    # another admin if needed.
    if user.id == current.id:
        if "is_active" in data and data["is_active"] is False:
            raise HTTPException(400, "Você não pode desativar a si mesmo.")
        if "role" in data and data["role"] != UserRole.admin:
            raise HTTPException(400, "Você não pode alterar o seu próprio papel.")

    if "username" in data:
        new_username = (data["username"] or "").strip()
        if not new_username:
            raise HTTPException(400, "Nome de usuário não pode ficar vazio.")
        if new_username != user.username:
            dup = (
                await db.execute(select(User).where(User.username == new_username))
            ).scalar_one_or_none()
            if dup is not None:
                raise HTTPException(409, "Já existe um usuário com este nome.")
        user.username = new_username
    if "role" in data and data["role"] is not None:
        user.role = data["role"]
    if "is_active" in data and data["is_active"] is not None:
        user.is_active = bool(data["is_active"])
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    user_id: int,
    payload: PasswordReset,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin resets another user's password. The target user can also
    use /api/auth/change-password to change their own."""
    _require_admin(current)
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuário não encontrado.")
    user.password_hash = hash_password(payload.password)
    await db.commit()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_user(
    user_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete — flip is_active to false rather than DELETE. Keeps
    foreign-key history intact (orders the user touched, etc.)."""
    _require_admin(current)
    if user_id == current.id:
        raise HTTPException(400, "Você não pode desativar a si mesmo.")
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Usuário não encontrado.")
    user.is_active = False
    await db.commit()

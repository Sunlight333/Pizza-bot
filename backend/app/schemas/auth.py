from pydantic import BaseModel, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=80)
    password: str = Field(..., min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    username: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}

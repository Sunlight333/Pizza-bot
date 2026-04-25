"""JWT access/refresh token generation + verification + type discrimination."""
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    h = hash_password("admin123")
    assert h != "admin123"
    assert verify_password("admin123", h)
    assert not verify_password("wrong", h)


def test_access_token_marks_type():
    token = create_access_token(subject=1, extra={"role": "admin"})
    claims = decode_token(token)
    assert claims["type"] == "access"
    assert claims["sub"] == "1"
    assert claims["role"] == "admin"


def test_refresh_token_marks_type():
    token = create_refresh_token(subject=42)
    claims = decode_token(token)
    assert claims["type"] == "refresh"
    assert claims["sub"] == "42"


def test_decode_invalid_raises():
    import pytest
    with pytest.raises(ValueError):
        decode_token("not.a.real.token")

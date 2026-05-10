"""JWT helpers for the customer portal.

Separate from utils/security.py (admin JWTs) to avoid cross-tenant
authentication: an admin token cannot be used as a customer token, and
vice-versa, because we stamp `aud='customer'` on customer tokens and
require it on the way back. Same secret is reused — they differ only in
the audience claim.
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

CUSTOMER_AUDIENCE = "customer"
CUSTOMER_TOKEN_TTL_DAYS = 30


def create_customer_token(customer_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(customer_id),
        "aud": CUSTOMER_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(days=CUSTOMER_TOKEN_TTL_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_customer_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=CUSTOMER_AUDIENCE,
        )
    except JWTError as e:
        raise ValueError("Invalid customer token") from e

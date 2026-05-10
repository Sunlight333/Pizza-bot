"""Short-lived JWT for the public order-tracking page.

Embedded in the order confirmation URL; lets a customer (or anyone they
share the link with) view live status without authenticating. Validity
is 7 days — long enough to cover delivery + a "thanks for ordering"
revisit, short enough that a stale link doesn't leak history forever.
"""
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings

TRACKING_AUDIENCE = "order_tracking"
TRACKING_TTL_DAYS = 7


def create_tracking_token(order_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(order_id),
        "aud": TRACKING_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(days=TRACKING_TTL_DAYS),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_tracking_token(token: str) -> int:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=TRACKING_AUDIENCE,
        )
        return int(claims["sub"])
    except (JWTError, KeyError, ValueError) as e:
        raise ValueError("Invalid tracking token") from e

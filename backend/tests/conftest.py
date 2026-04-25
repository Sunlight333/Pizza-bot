import asyncio
import os
import sys

import pytest
import pytest_asyncio


# Ensure backend/ and the repo root are both importable
_THIS = os.path.dirname(__file__)
sys.path.insert(0, os.path.abspath(os.path.join(_THIS, "..")))           # backend/
sys.path.insert(0, os.path.abspath(os.path.join(_THIS, "..", "..")))     # repo root (for bridge)

# Provide env vars before anything imports config.py
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-long-enough-string-for-testing-only")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

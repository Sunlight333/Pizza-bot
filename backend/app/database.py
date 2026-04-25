from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

_engine_kwargs: dict = {"echo": False, "pool_pre_ping": True}
if not settings.database_url.startswith("sqlite"):
    # Pool sizing only applies to real DBs; SQLite uses StaticPool
    _engine_kwargs.update(pool_size=10, max_overflow=20)

engine = create_async_engine(settings.database_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

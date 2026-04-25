from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.bot_config import BotConfig
from app.schemas.bot_config import BotConfigOut, BotConfigUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


async def _get_or_create(db: AsyncSession) -> BotConfig:
    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    if cfg is None:
        cfg = BotConfig(id=1)
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)
    return cfg


@router.get("", response_model=BotConfigOut)
async def get_config(db: AsyncSession = Depends(get_db)):
    return await _get_or_create(db)


@router.put("", response_model=BotConfigOut)
async def update_config(payload: BotConfigUpdate, db: AsyncSession = Depends(get_db)):
    cfg = await _get_or_create(db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cfg, k, v)
    await db.commit()
    await db.refresh(cfg)
    return cfg

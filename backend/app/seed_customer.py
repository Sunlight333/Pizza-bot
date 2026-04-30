"""
Customer operational seed — applies the customer's actual operating data
to the singleton BotConfig and the delivery_zones table.

Run with: docker compose exec backend python -m app.seed_customer

Idempotent — safe to re-run; existing rows are updated in place rather
than duplicated. Distinct from `app.seed` (which loads sample/menu data).
"""
import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.bot_config import BotConfig
from app.models.delivery_zone import DeliveryZone


# --- Operating hours (item 10) -------------------------------------------
# Tuesday → Sunday, 17:00–23:00 (closed Monday).
# 17:00 and 23:00 are whole hours so the existing integer columns suffice;
# if a future customer needs minute granularity or a midnight crossing,
# BotConfig will need a per-day JSON `working_hours` column.
HOURS_START = 17
HOURS_END = 23
CLOSED_WEEKDAYS = [0]  # Mon=0..Sun=6 (Python weekday convention)

# --- Bot persona (item 12) -----------------------------------------------
# The bot must NEVER reveal it's a bot. Greeting + name read like a real
# attendant; the system prompt enforces that at conversation level.
BOT_NAME = "Bia"
GREETING = "Oi! Tudo bem? 😊 Em que posso te ajudar hoje?"

# --- PIX (item 11) -------------------------------------------------------
# CNPJ key. Customer did not supply a QR image; if they later do, upload
# it via the products image endpoint and store the URL in a future
# `pix_qr_code_image_url` column (not yet added — see audit notes).
PIX_KEY = "24853133000179"
PIX_HOLDER = "Guilherme Guimaraes Lopes"

# --- Delivery bands (item 9) ---------------------------------------------
# Stored as one row per band. `neighborhood` is the human label; the new
# distance_min_km / distance_max_km columns hold the band itself. The
# bot's existing fuzzy matcher still works on `neighborhood`, so this
# alone won't auto-pick a band from a customer's address — that needs
# geocoding (separate work item; see audit notes).
DELIVERY_BANDS = [
    ("0 a 2 km",      0.00,  2.00,  5.00, 30),
    ("2,1 a 3 km",    2.10,  3.00,  6.00, 35),
    ("3,1 a 4 km",    3.10,  4.00,  8.00, 40),
    ("4,1 a 6 km",    4.10,  6.00, 10.00, 45),
    ("6,1 a 8 km",    6.10,  8.00, 14.00, 50),
    ("8,1 a 9 km",    8.10,  9.00, 16.00, 55),
    ("9,1 a 10 km",   9.10, 10.00, 18.00, 60),
    ("10,1 a 11 km", 10.10, 11.00, 20.00, 65),
    ("11,1 a 15 km", 11.10, 15.00, 25.00, 75),
]


async def upsert_bot_config(db) -> None:
    cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    if cfg is None:
        cfg = BotConfig(id=1)
        db.add(cfg)

    cfg.bot_name = BOT_NAME
    cfg.greeting = GREETING
    cfg.working_hours_start = HOURS_START
    cfg.working_hours_end = HOURS_END
    cfg.closed_weekdays = list(CLOSED_WEEKDAYS)
    cfg.pix_key = PIX_KEY
    cfg.pix_holder = PIX_HOLDER

    await db.commit()
    print(
        f"+ BotConfig: bot_name={cfg.bot_name}, "
        f"hours={cfg.working_hours_start}h–{cfg.working_hours_end}h, "
        f"closed_weekdays={cfg.closed_weekdays}, "
        f"pix={cfg.pix_key} ({cfg.pix_holder})"
    )


async def upsert_distance_bands(db) -> None:
    existing = {
        z.neighborhood: z
        for z in (await db.execute(select(DeliveryZone))).scalars().all()
    }
    for label, kmin, kmax, fee, mins in DELIVERY_BANDS:
        z = existing.get(label)
        if z is None:
            db.add(
                DeliveryZone(
                    neighborhood=label,
                    fee=fee,
                    estimated_minutes=mins,
                    is_active=True,
                    distance_min_km=kmin,
                    distance_max_km=kmax,
                )
            )
            print(f"+ band {label} R$ {fee:.2f} ({mins}min)")
        else:
            z.fee = fee
            z.estimated_minutes = mins
            z.is_active = True
            z.distance_min_km = kmin
            z.distance_max_km = kmax
            print(f"~ band {label} updated")
    await db.commit()


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await upsert_bot_config(db)
        await upsert_distance_bands(db)
    print("customer seed complete")


if __name__ == "__main__":
    asyncio.run(main())

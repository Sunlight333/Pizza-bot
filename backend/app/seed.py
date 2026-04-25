"""
Seed script — creates default admin, sample menu, delivery zones.

Run with: docker compose exec backend python -m app.seed
"""
import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.category import Category
from app.models.delivery_zone import DeliveryZone
from app.models.product import Product
from app.models.user import User, UserRole
from app.utils.security import hash_password


DEFAULT_CRUSTS = ["Catupiry", "Cheddar", "Chocolate", "Sem Borda"]
DEFAULT_EXTRAS = ["Extra Queijo", "Extra Bacon", "Extra Calabresa", "Sem Cebola"]

PIZZA_TAX = {
    "ncm": "19059090",
    "cfop": "5102",
    "csosn": "102",
    "cest": "1706400",
    "ibpt_code": "19059090",
    "origin_code": "0",
}
DRINK_TAX = {
    "ncm": "22021000",
    "cfop": "5102",
    "csosn": "102",
    "cest": "0302100",
    "ibpt_code": "22021000",
    "origin_code": "0",
}

# 15 flavors, four sizes each (Pequena, Média, Grande, Gigante)
PIZZA_FLAVORS = [
    ("Calabresa", "Calabresa, cebola, orégano"),
    ("Portuguesa", "Presunto, ovo, cebola, pimentão, azeitona"),
    ("Mussarela", "Queijo mussarela, orégano"),
    ("Frango com Catupiry", "Frango desfiado, catupiry, orégano"),
    ("Quatro Queijos", "Mussarela, parmesão, provolone, catupiry"),
    ("Napolitana", "Mussarela, tomate em rodelas, parmesão"),
    ("Margherita", "Mussarela, tomate, manjericão fresco"),
    ("Bacon", "Mussarela, bacon em cubos, orégano"),
    ("Pepperoni", "Mussarela, pepperoni fatiado"),
    ("Vegetariana", "Mussarela, brócolis, milho, ervilha, palmito"),
    ("Atum", "Mussarela, atum, cebola, azeitona"),
    ("Lombo Canadense", "Mussarela, lombo canadense, orégano"),
    ("Catupiry", "Mussarela, catupiry, orégano"),
    ("Chocolate", "Chocolate ao leite, morango"),
    ("Prestígio", "Chocolate, coco ralado, leite condensado"),
]


async def seed_admin(db) -> None:
    if (await db.execute(select(User).where(User.username == "admin"))).scalar_one_or_none():
        return
    db.add(
        User(
            username="admin",
            password_hash=hash_password("admin123"),
            role=UserRole.admin,
            is_active=True,
        )
    )
    await db.commit()
    print("+ admin (admin/admin123)")


async def seed_categories(db) -> dict[str, int]:
    wanted = [
        ("Pizzas Salgadas", 1),
        ("Pizzas Doces", 2),
        ("Bebidas", 3),
        ("Acompanhamentos", 4),
    ]
    existing = {
        c.name: c.id
        for c in (await db.execute(select(Category))).scalars().all()
    }
    for name, order in wanted:
        if name not in existing:
            cat = Category(name=name, display_order=order, is_active=True)
            db.add(cat)
            await db.flush()
            existing[name] = cat.id
            print(f"+ category {name}")
    await db.commit()
    return existing


async def seed_products(db, cats: dict[str, int]) -> None:
    existing = {p.name for p in (await db.execute(select(Product))).scalars().all()}

    # Pizzas salgadas (all except the last two)
    for name, desc in PIZZA_FLAVORS[:-2]:
        if name in existing:
            continue
        db.add(
            Product(
                category_id=cats["Pizzas Salgadas"],
                name=name,
                description=desc,
                sizes=[
                    {"size": "pequena", "price": 32.90},
                    {"size": "média", "price": 42.90},
                    {"size": "grande", "price": 52.90},
                    {"size": "gigante", "price": 64.90},
                ],
                is_pizza=True,
                allows_half=True,
                available_crusts=DEFAULT_CRUSTS,
                available_extras=DEFAULT_EXTRAS,
                is_active=True,
                **PIZZA_TAX,
            )
        )
        print(f"+ pizza {name}")

    # Pizzas doces (last two flavors)
    for name, desc in PIZZA_FLAVORS[-2:]:
        if name in existing:
            continue
        db.add(
            Product(
                category_id=cats["Pizzas Doces"],
                name=name,
                description=desc,
                sizes=[
                    {"size": "pequena", "price": 36.90},
                    {"size": "média", "price": 46.90},
                    {"size": "grande", "price": 56.90},
                    {"size": "gigante", "price": 68.90},
                ],
                is_pizza=True,
                allows_half=True,
                available_crusts=["Chocolate", "Sem Borda"],
                available_extras=["Extra Leite Condensado", "Extra Morango"],
                is_active=True,
                **PIZZA_TAX,
            )
        )
        print(f"+ pizza doce {name}")

    drinks = [
        ("Coca-Cola 2L", 14.00),
        ("Coca-Cola Lata 350ml", 6.00),
        ("Guaraná Antarctica 2L", 12.00),
        ("Água Mineral 500ml", 4.00),
        ("Suco de Laranja 500ml", 8.00),
    ]
    for name, price in drinks:
        if name in existing:
            continue
        db.add(
            Product(
                category_id=cats["Bebidas"],
                name=name,
                sizes=[{"size": "único", "price": price}],
                is_pizza=False,
                allows_half=False,
                is_active=True,
                **DRINK_TAX,
            )
        )
        print(f"+ bebida {name}")

    sides = [
        ("Batata Frita Pequena", 16.00, "Porção com 300g"),
        ("Batata Frita Grande", 26.00, "Porção com 600g"),
        ("Borda Recheada Avulsa", 8.00, "Adicional borda catupiry/cheddar"),
    ]
    for name, price, desc in sides:
        if name in existing:
            continue
        db.add(
            Product(
                category_id=cats["Acompanhamentos"],
                name=name,
                description=desc,
                sizes=[{"size": "único", "price": price}],
                is_pizza=False,
                allows_half=False,
                is_active=True,
                **DRINK_TAX,
            )
        )
        print(f"+ acompanhamento {name}")

    await db.commit()


async def seed_zones(db) -> None:
    existing = {
        z.neighborhood for z in (await db.execute(select(DeliveryZone))).scalars().all()
    }
    zones = [
        ("Centro", 5.00, 30),
        ("Jardim América", 7.00, 35),
        ("Vila Nova", 8.00, 40),
        ("Jardim Europa", 9.00, 45),
        ("Bairro Alto", 10.00, 50),
        ("Distrito Industrial", 12.00, 55),
    ]
    for name, fee, mins in zones:
        if name in existing:
            continue
        db.add(DeliveryZone(neighborhood=name, fee=fee, estimated_minutes=mins, is_active=True))
        print(f"+ zone {name} R$ {fee:.2f} ({mins}min)")
    await db.commit()


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed_admin(db)
        cats = await seed_categories(db)
        await seed_products(db, cats)
        await seed_zones(db)
    print("seed complete")


if __name__ == "__main__":
    asyncio.run(main())

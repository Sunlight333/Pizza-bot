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


# ---------------------------------------------------------------------------
# Pizzaria Planalto savory catalog — transcribed from
# docs/menu-reference/menu-print-savory-list-1.jpeg
#
# Pricing comes from the same brochure (menu-print-sweet-and-prices.jpeg):
#   Brotinho (4 pedaços): R$ 35,00
#   Grande   (8 pedaços): R$ 55,00
#
# Photos are NOT set here — image_url stays NULL so the frontend resolves them
# at render time via pizzaImage(p.name, categoryName) in
# frontend/src/utils/assets.js.
# ---------------------------------------------------------------------------
PLANALTO_SIZES = [
    {"size": "brotinho", "price": 35.00},
    {"size": "grande", "price": 55.00},
]

PIZZAS_PLANALTO_SAVORY = [
    ("Alho", "Molho de tomate, mussarela, alho tostado, tomate, azeitona e orégano."),
    ("Atum", "Molho de tomate, mussarela, atum, tomate, azeitona e orégano."),
    ("Atum com Milho", "Molho de tomate, mussarela, atum, milho, tomate, azeitona e orégano."),
    ("Bacon", "Molho de tomate, mussarela, bacon, azeitona e orégano."),
    ("Bacon Mix", "Molho de tomate, mussarela, bacon, banana, azeitona e orégano."),
    ("Bacon Super", "Molho de tomate, mussarela, bacon, ovo, parmesão, azeitona e orégano."),
    ("Baiana", "Molho de tomate, mussarela, calabresa ralada, pimenta calabresa, azeitona e orégano."),
    ("Brócolis", "Molho de tomate, mussarela, brócolis, parmesão, alho tostado, azeitona e orégano."),
    ("Brócolis com Bacon", "Molho de tomate, mussarela, brócolis, bacon, parmesão, azeitona e orégano."),
    ("Brócolis Super", "Molho de tomate, mussarela, brócolis, palmito, champignon, alho tostado, azeitona e orégano."),
    ("Calabresa", "Molho de tomate, mussarela, calabresa fatiada, azeitona e orégano."),
    ("Calabresa Egg", "Molho de tomate, mussarela, calabresa fatiada, ovo, azeitona e orégano."),
    ("Calabresa Mix", "Molho de tomate, mussarela, calabresa fatiada, lombo canadense, provolone ralado, azeitona e orégano."),
    ("Calabresa Super", "Molho de tomate, mussarela, calabresa fatiada, bacon, azeitona e orégano."),
    ("Carne Seca", "Molho de tomate, carne seca, mussarela, azeitona e orégano."),
    ("Carne Seca com Milho", "Molho de tomate, carne seca, mussarela, milho, azeitona e orégano."),
    ("Escarola", "Molho de tomate, escarola, mussarela, bacon, parmesão, azeitona e orégano."),
    ("Espanhola", "Molho de tomate, mussarela, calabresa ralada, alho tostado, azeitona e orégano."),
    ("Espanhola Super", "Molho de tomate, mussarela, calabresa, palmito, ervilha, ovo, alho tostado, azeitona e orégano."),
    ("Francesa", "Molho de tomate, mussarela, palmito, ovo, tomate, azeitona e orégano."),
    ("Frango com Catupiry", "Molho de tomate, frango, catupiry, mussarela, azeitona e orégano."),
    ("Frango com Brócolis", "Molho de tomate, mussarela, frango, brócolis, azeitona e orégano."),
    ("Frango com Cheddar", "Molho de tomate, frango, cheddar, mussarela, azeitona e orégano."),
    ("Frango com Milho", "Molho de tomate, frango, mussarela, milho, azeitona e orégano."),
    ("Frango com Palmito", "Molho de tomate, frango, mussarela, palmito, azeitona e orégano."),
    ("Frango Picante", "Molho de tomate, frango, mussarela, milho, pimenta dedo de moça, azeitona e orégano."),
    ("Frango Serrano", "Creme de milho, frango, mussarela, azeitona e orégano."),
    ("Frango Super", "Molho de tomate, frango, mussarela, bacon, milho, azeitona e orégano."),
    ("Hot Dog", "Molho especial, salsicha, mussarela, azeitona, orégano e batata palha."),
    ("Lombo", "Molho de tomate, mussarela, lombo fatiado, azeitona e orégano."),
    ("Lombo com Cheddar", "Molho de tomate, cheddar, mussarela, lombo ralado, azeitona e orégano."),
    ("Lombo Mix", "Molho de tomate, mussarela, lombo fatiado, abacaxi, azeitona e orégano."),
    ("Lombo Super", "Molho de tomate, mussarela, lombo ralado, milho, bacon, alho tostado, azeitona e orégano."),
    ("Margherita", "Molho de tomate, mussarela, parmesão, manjericão, tomate, azeitona e orégano."),
    ("Mexicana", "Molho de tomate, mussarela, presunto, pimentão, pimenta dedo de moça, azeitona e orégano."),
    ("Mexicana Super", "Molho de tomate, mussarela, calabresa fatiada, pimentão, pimenta dedo de moça, azeitona e orégano."),
    ("Mussarela", "Molho de tomate, mussarela, tomate, azeitona e orégano."),
    ("3 Queijos", "Molho de tomate, mussarela, provolone, tomate, azeitona e orégano."),
    ("4 Queijos", "Molho de tomate, mussarela, gorgonzola, provolone, tomate, azeitona e orégano."),
    ("4 Queijos Super", "Molho de tomate, requeijão, mussarela, ricota, provolone, tomate, azeitona e orégano."),
    ("5 Queijos", "Molho de tomate, mussarela, requeijão, ricota, provolone, parmesão, tomate, azeitona e orégano."),
    ("Napolitana", "Molho de tomate, mussarela, parmesão, tomate, azeitona e orégano."),
    ("Palmito", "Molho de tomate, mussarela, palmito, tomate, azeitona e orégano."),
    ("Paulista", "Molho de tomate, mussarela, presunto, palmito, champignon, bacon, tomate, azeitona e orégano."),
    ("Peito de Peru", "Molho de tomate, peito de peru, mussarela, azeitona e orégano."),
    ("Peito de Peru com Ricota", "Molho de tomate, peito de peru, ricota, mussarela, azeitona e orégano."),
    ("Portuguesa", "Molho de tomate, mussarela, presunto, palmito, ervilha, ovo, tomate, azeitona e orégano."),
    ("Portuguesa Mix", "Molho, mussarela, presunto, calabresa ralada, bacon, lombo, provolone ralado, milho, ovo, tomate, azeitona e orégano."),
    ("Portuguesa Picante", "Molho de tomate, mussarela, calabresa ralada, palmito, ervilha, ovo, pimenta calabresa, tomate, azeitona e orégano."),
    ("Portuguesa Super", "Molho de tomate, mussarela, presunto, palmito, ervilha, ovo, tomate, azeitona e orégano."),
    ("Presunto e Queijo", "Molho de tomate, mussarela, presunto, tomate, azeitona e orégano."),
    ("Presunto Mix", "Molho de tomate, mussarela, presunto, milho, bacon, tomate, batata palha, azeitona e orégano."),
    ("Presunto Super", "Molho de tomate, mussarela, presunto, calabresa ralada, lombo, bacon, tomate, azeitona e orégano."),
    ("Provolombo", "Molho de tomate, mussarela, lombo, provolone, azeitona e orégano."),
    ("Provolone Super", "Molho de tomate, mussarela, provolone, milho, bacon, azeitona e orégano."),
    ("Romana", "Molho de tomate, mussarela, calabresa fatiada, lombo, azeitona e orégano."),
    ("Rúcula", "Molho de tomate, mussarela, tomate seco, parmesão, rúcula, azeitona e orégano."),
    ("Salame", "Molho de tomate, mussarela, salame, azeitona e orégano."),
    ("Serrana", "Creme de milho, lombo canadense, mussarela, azeitona e orégano."),
    ("Strogonoff de Carne", "Strogonoff de carne, mussarela, champignon, azeitona, orégano e batata palha."),
    ("Strogonoff de Frango", "Strogonoff de frango, mussarela, azeitona, orégano e batata palha."),
    ("Tomate Seco", "Molho de tomate, mussarela, tomate seco, parmesão, azeitona e orégano."),
    ("Tomate Seco com Palmito", "Molho de tomate, mussarela, tomate seco, palmito, azeitona e orégano."),
    ("Tomate Seco Super", "Molho de tomate, mussarela, tomate seco, brócolis, ricota, azeitona e orégano."),
    ("Toscana", "Molho de tomate, mussarela, calabresa ralada, bacon, azeitona e orégano."),
    ("Toscana Picante", "Molho de tomate, mussarela, bacon, calabresa ralada, pimenta dedo de moça, azeitona e orégano."),
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


async def seed_planalto_flavors(db, cats: dict[str, int]) -> None:
    """Import the full Pizzaria Planalto savory catalog (transcribed from
    docs/menu-reference/menu-print-savory-list-1.jpeg).

    Idempotent — skips any flavor whose name already exists. Leaves image_url
    NULL so the frontend resolves photos via pizzaImage() at render time.
    """
    existing = {p.name for p in (await db.execute(select(Product))).scalars().all()}
    added = 0
    for name, desc in PIZZAS_PLANALTO_SAVORY:
        if name in existing:
            continue
        db.add(
            Product(
                category_id=cats["Pizzas Salgadas"],
                name=name,
                description=desc,
                sizes=PLANALTO_SIZES,
                is_pizza=True,
                allows_half=True,
                available_crusts=DEFAULT_CRUSTS,
                available_extras=DEFAULT_EXTRAS,
                is_active=True,
                **PIZZA_TAX,
            )
        )
        added += 1
    await db.commit()
    print(f"+ planalto savory flavors: {added} new (of {len(PIZZAS_PLANALTO_SAVORY)})")


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
        await seed_planalto_flavors(db, cats)
        await seed_zones(db)
    print("seed complete")


if __name__ == "__main__":
    asyncio.run(main())

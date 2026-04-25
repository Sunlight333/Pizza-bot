"""
Half-pizza pricing: Brazilian standard is that the MORE EXPENSIVE half
sets the price. This is the 'max' rule — not average.
"""
from types import SimpleNamespace

from app.services.menu_service import (
    build_pizza_description,
    calculate_half_pizza_price,
    validate_combination,
)


def make_product(name, sizes, allows_half=True, crusts=None, extras=None):
    return SimpleNamespace(
        name=name,
        sizes=sizes,
        allows_half=allows_half,
        available_crusts=crusts or [],
        available_extras=extras or [],
    )


def test_half_pizza_price_takes_max():
    a = make_product("Calabresa", [{"size": "grande", "price": 50.0}])
    b = make_product("Portuguesa", [{"size": "grande", "price": 60.0}])
    assert calculate_half_pizza_price(a, b, "grande") == 60.0
    # Order shouldn't matter
    assert calculate_half_pizza_price(b, a, "grande") == 60.0
    # Explicit mode='max' matches the default
    assert calculate_half_pizza_price(a, b, "grande", mode="max") == 60.0


def test_half_pizza_average_mode():
    a = make_product("Calabresa", [{"size": "grande", "price": 50.0}])
    b = make_product("Portuguesa", [{"size": "grande", "price": 61.0}])
    # Some pizzarias use average instead of max — must round to cents
    assert calculate_half_pizza_price(a, b, "grande", mode="average") == 55.5


def test_half_pizza_first_mode():
    a = make_product("Calabresa", [{"size": "grande", "price": 50.0}])
    b = make_product("Portuguesa", [{"size": "grande", "price": 70.0}])
    # 'first' uses the first flavor's price — order matters in this mode
    assert calculate_half_pizza_price(a, b, "grande", mode="first") == 50.0
    assert calculate_half_pizza_price(b, a, "grande", mode="first") == 70.0


def test_half_pizza_raises_on_missing_size():
    a = make_product("X", [{"size": "grande", "price": 50.0}])
    b = make_product("Y", [{"size": "média", "price": 40.0}])
    try:
        calculate_half_pizza_price(a, b, "grande")
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError for missing size")


def test_description_builds_half_half():
    a = make_product("Calabresa", [{"size": "grande", "price": 50.0}])
    b = make_product("Portuguesa", [{"size": "grande", "price": 60.0}])
    desc = build_pizza_description([a, b], "grande", crust="Catupiry")
    assert "1/2 Calabresa" in desc
    assert "1/2 Portuguesa" in desc
    assert "Borda Catupiry" in desc
    assert "Grande" in desc


def test_description_single_flavor_no_half_marker():
    a = make_product("Margherita", [{"size": "grande", "price": 55.0}])
    desc = build_pizza_description([a], "grande")
    assert "1/2" not in desc
    assert "Margherita" in desc


def test_validate_half_rejected_when_not_allowed():
    a = make_product("Especial", [{"size": "grande", "price": 80.0}], allows_half=False)
    b = make_product("Outro", [{"size": "grande", "price": 70.0}])
    try:
        validate_combination([a, b], "grande", None, None)
    except ValueError as e:
        assert "meia-a-meia" in str(e)
    else:
        raise AssertionError("expected ValueError when half not allowed")


def test_validate_rejects_unknown_extra():
    a = make_product(
        "Calabresa",
        [{"size": "grande", "price": 50.0}],
        crusts=["Catupiry"],
        extras=["Extra Queijo"],
    )
    try:
        validate_combination([a], "grande", "Catupiry", ["Caviar Russo"])
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError for unknown extra")

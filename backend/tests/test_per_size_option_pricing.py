"""
Per-size pricing for crusts and extras:

  - "Catupiry" crust on brotinho costs R$ 3, on grande R$ 6.
  - "Extra Queijo" on brotinho costs R$ 4, on grande R$ 7.
  - "Cebola" is free on both sizes.

The full unit_price chain — size + crust + extras — must match what the
WhatsApp AI quotes the customer, since the AI is the primary order taker.
"""
from types import SimpleNamespace

from app.services.menu_service import (
    crust_price,
    extras_price_total,
    validate_combination,
)


def make_pizza():
    return SimpleNamespace(
        id=1,
        name="Calabresa Egg",
        sizes=[
            {"size": "brotinho", "price": 35.0, "allows_half": False},
            {"size": "grande", "price": 55.0, "allows_half": True},
        ],
        is_pizza=True,
        allows_half=True,
        available_crusts=[
            {"name": "Catupiry", "prices": {"brotinho": 3.0, "grande": 6.0}},
            {"name": "Sem Borda", "prices": {}},
        ],
        available_extras=[
            {"name": "Extra Queijo", "prices": {"brotinho": 4.0, "grande": 7.0}},
            {"name": "Cebola", "prices": {"brotinho": 0.0, "grande": 0.0}},
        ],
    )


# ---------- crust_price ----------


def test_crust_price_resolves_per_size():
    p = make_pizza()
    assert crust_price(p, "Catupiry", "brotinho") == 3.0
    assert crust_price(p, "Catupiry", "grande") == 6.0


def test_crust_price_is_case_insensitive_for_name_and_size():
    p = make_pizza()
    assert crust_price(p, "catupiry", "BROTINHO") == 3.0


def test_sem_borda_is_free_at_any_size():
    p = make_pizza()
    assert crust_price(p, "Sem Borda", "brotinho") == 0.0
    assert crust_price(p, "Sem Borda", "grande") == 0.0


def test_unknown_crust_returns_zero():
    p = make_pizza()
    # Validation rejects unknown crusts elsewhere; helper just answers 0.
    assert crust_price(p, "Caviar", "grande") == 0.0


def test_no_crust_chosen_returns_zero():
    p = make_pizza()
    assert crust_price(p, None, "grande") == 0.0
    assert crust_price(p, "", "grande") == 0.0


# ---------- extras_price_total ----------


def test_extras_total_per_size():
    p = make_pizza()
    assert extras_price_total(p, ["Extra Queijo"], "brotinho") == 4.0
    assert extras_price_total(p, ["Extra Queijo"], "grande") == 7.0


def test_free_extra_does_not_add():
    p = make_pizza()
    assert extras_price_total(p, ["Cebola"], "grande") == 0.0
    assert extras_price_total(p, ["Cebola", "Extra Queijo"], "grande") == 7.0


def test_unknown_extra_is_ignored_in_total():
    p = make_pizza()
    # validate_combination is the rejection layer; the price helper is lenient.
    assert extras_price_total(p, ["Inexistente"], "grande") == 0.0


def test_empty_extras_list_returns_zero():
    p = make_pizza()
    assert extras_price_total(p, [], "grande") == 0.0
    assert extras_price_total(p, None, "grande") == 0.0


# ---------- end-to-end unit_price math ----------


def test_unit_price_brotinho_with_catupiry_and_extras():
    """
    Customer asks: 'Calabresa Egg brotinho com borda catupiry, extra queijo
    e cebola, sem cebola'. Expected unit price:
        35 (brotinho)  + 3 (catupiry/brotinho) + 4 (queijo/brotinho) + 0 (cebola)
        = 42.00
    """
    p = make_pizza()
    base = next(s["price"] for s in p.sizes if s["size"] == "brotinho")
    total = (
        base
        + crust_price(p, "Catupiry", "brotinho")
        + extras_price_total(p, ["Extra Queijo", "Cebola"], "brotinho")
    )
    assert round(total, 2) == 42.00


def test_unit_price_grande_same_options_costs_more():
    """Same options on grande: 55 + 6 + 7 + 0 = 68.00."""
    p = make_pizza()
    base = next(s["price"] for s in p.sizes if s["size"] == "grande")
    total = (
        base
        + crust_price(p, "Catupiry", "grande")
        + extras_price_total(p, ["Extra Queijo", "Cebola"], "grande")
    )
    assert round(total, 2) == 68.00


# ---------- per-size meia-a-meia gate ----------


def test_brotinho_rejects_meia_a_meia():
    """Per-size rule: brotinho is 1-flavor only even when product allows half."""
    a = make_pizza()
    b = SimpleNamespace(
        id=2,
        name="Portuguesa",
        sizes=[
            {"size": "brotinho", "price": 35.0, "allows_half": False},
            {"size": "grande", "price": 55.0, "allows_half": True},
        ],
        is_pizza=True,
        allows_half=True,
        available_crusts=[],
        available_extras=[],
    )
    try:
        validate_combination([a, b], "brotinho", None, None)
    except ValueError as e:
        assert "meia-a-meia" in str(e).lower() or "1 sabor" in str(e).lower() or "brotinho" in str(e).lower()
    else:
        raise AssertionError("expected ValueError for brotinho meia-a-meia")


def test_grande_allows_meia_a_meia():
    a = make_pizza()
    b = SimpleNamespace(
        id=2,
        name="Portuguesa",
        sizes=[
            {"size": "grande", "price": 55.0, "allows_half": True},
        ],
        is_pizza=True,
        allows_half=True,
        available_crusts=[],
        available_extras=[],
    )
    # Should NOT raise.
    validate_combination([a, b], "grande", None, None)

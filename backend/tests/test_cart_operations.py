"""Cart operations — pure dict manipulation, no DB."""
from app.services.order_builder import cart_summary, cart_totals, remove_item


def make_cart():
    return {
        "items": [
            {"description": "Pizza Grande Calabresa", "unit_price": 50.0, "quantity": 1},
            {"description": "Coca-Cola 2L", "unit_price": 14.0, "quantity": 2},
        ],
        "delivery_fee": 8.0,
    }


def test_totals():
    cart = make_cart()
    sub, fee, total = cart_totals(cart)
    assert sub == 50.0 + 14.0 * 2
    assert fee == 8.0
    assert total == sub + fee


def test_totals_empty():
    assert cart_totals({"items": []}) == (0, 0, 0)


def test_remove_item_in_range():
    cart = make_cart()
    remove_item(cart, 0)
    assert len(cart["items"]) == 1
    assert cart["items"][0]["description"] == "Coca-Cola 2L"


def test_remove_item_out_of_range_is_noop():
    cart = make_cart()
    remove_item(cart, 99)
    assert len(cart["items"]) == 2
    remove_item(cart, -1)
    assert len(cart["items"]) == 2


def test_summary_uses_brl_comma():
    cart = make_cart()
    s = cart_summary(cart)
    assert "Pizza Grande Calabresa" in s
    assert "R$ 50,00" in s
    assert "R$ 28,00" in s  # 2 × 14
    assert "R$ 86,00" in s  # total: 50 + 28 + 8


def test_summary_omits_fee_when_zero():
    cart = {"items": [{"description": "x", "unit_price": 10, "quantity": 1}], "delivery_fee": 0}
    s = cart_summary(cart)
    assert "Entrega" not in s

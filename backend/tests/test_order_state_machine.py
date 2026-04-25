"""Order status transition rules."""
from app.models.order import OrderStatus
from app.services.order_service import VALID_TRANSITIONS


def test_happy_path_exists():
    path = [
        OrderStatus.received,
        OrderStatus.confirmed,
        OrderStatus.preparing,
        OrderStatus.out_for_delivery,
        OrderStatus.delivered,
    ]
    for a, b in zip(path, path[1:]):
        assert b in VALID_TRANSITIONS[a], f"missing {a} -> {b}"


def test_cannot_reverse():
    assert OrderStatus.received not in VALID_TRANSITIONS[OrderStatus.confirmed]
    assert OrderStatus.preparing not in VALID_TRANSITIONS[OrderStatus.out_for_delivery]


def test_cancel_from_any_active_state():
    for s in (
        OrderStatus.received,
        OrderStatus.confirmed,
        OrderStatus.preparing,
        OrderStatus.out_for_delivery,
    ):
        assert OrderStatus.cancelled in VALID_TRANSITIONS[s], f"cannot cancel from {s}"


def test_terminal_states_have_no_transitions():
    assert VALID_TRANSITIONS[OrderStatus.delivered] == set()
    assert VALID_TRANSITIONS[OrderStatus.cancelled] == set()


def test_cannot_skip_states():
    # e.g. you can't jump received -> out_for_delivery
    assert OrderStatus.out_for_delivery not in VALID_TRANSITIONS[OrderStatus.received]
    assert OrderStatus.delivered not in VALID_TRANSITIONS[OrderStatus.received]

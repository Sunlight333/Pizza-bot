"""Admin-phone normalization + short-circuit in process_incoming.

When the pizzaria owner WhatsApps the bot from their own number (which
is in ADMIN_PHONES), the bot must NOT greet them with the ordering
flow or build a cart. The shared `is_admin_phone()` helper backs that
check.
"""
import pytest

from app.services.notifications import _admin_phones, is_admin_phone


def test_admin_phones_returns_empty_when_unset(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "admin_phones", "")
    assert _admin_phones() == []


def test_admin_phones_strips_punctuation_and_dedupes(monkeypatch):
    from app.config import settings
    # Same number formatted three different ways → only one entry after
    # normalization. Plus a distinct number that should also appear.
    monkeypatch.setattr(
        settings, "admin_phones",
        "+55 17 99128-9777, 5517991289777, 55 17 99128-9777, 5511999998888",
    )
    out = _admin_phones()
    assert "5517991289777" in out
    assert "5511999998888" in out
    assert len(out) == 2  # three formats of the same number → one entry


def test_admin_phones_skips_empty_entries(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "admin_phones", "5517,, , 5511")
    assert _admin_phones() == ["5517", "5511"]


@pytest.mark.parametrize("inbound,expected", [
    ("5517991289777", True),
    ("+5517991289777", True),
    ("+55 17 99128-9777", True),
    ("(17) 99128-9777", False),  # missing country code → different digits
    ("5511999998888", True),
    ("5517999990000", False),  # not in list
    ("", False),
    (None, False),
])
def test_is_admin_phone(monkeypatch, inbound, expected):
    from app.config import settings
    monkeypatch.setattr(settings, "admin_phones", "5517991289777,5511999998888")
    assert is_admin_phone(inbound) is expected


def test_is_admin_phone_when_admin_list_empty(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "admin_phones", "")
    assert is_admin_phone("5517991289777") is False

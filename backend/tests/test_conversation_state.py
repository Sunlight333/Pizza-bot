"""Redis-backed conversation state — tested with fakeredis."""
import pytest

from app.services import conversation_state as state_svc


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    import fakeredis.aioredis as fakeredis
    client = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(state_svc, "_redis", client)
    yield client


async def test_get_state_returns_default_when_missing():
    state = await state_svc.get_state("5511999999999")
    assert state["state"] == "greeting"
    assert state["cart"] == {"items": []}
    assert state["context_messages"] == []


async def test_set_then_get_roundtrip():
    payload = {
        "state": "building_order",
        "cart": {"items": [{"description": "Pizza", "unit_price": 50, "quantity": 1}]},
        "context_messages": [{"role": "user", "content": "oi"}],
        "customer_id": 7,
    }
    await state_svc.set_state("5511999999999", payload)
    got = await state_svc.get_state("5511999999999")
    assert got["state"] == "building_order"
    assert got["cart"]["items"][0]["description"] == "Pizza"
    assert got["customer_id"] == 7


async def test_clear_state():
    await state_svc.set_state("5511888888888", {"state": "completed", "cart": {"items": []}})
    await state_svc.clear_state("5511888888888")
    fresh = await state_svc.get_state("5511888888888")
    assert fresh["state"] == "greeting"


async def test_append_message_truncates_history():
    phone = "5511777777777"
    for i in range(25):
        await state_svc.append_message(phone, "user", f"msg {i}", max_history=20)
    state = await state_svc.get_state(phone)
    assert len(state["context_messages"]) == 20
    assert state["context_messages"][-1]["content"] == "msg 24"
    assert state["context_messages"][0]["content"] == "msg 5"


async def test_state_separation_per_phone():
    await state_svc.set_state("111", {"state": "completed", "cart": {"items": []}})
    await state_svc.set_state("222", {"state": "greeting", "cart": {"items": [1, 2, 3]}})

    a = await state_svc.get_state("111")
    b = await state_svc.get_state("222")
    assert a["state"] == "completed"
    assert b["state"] == "greeting"
    assert len(b["cart"]["items"]) == 3

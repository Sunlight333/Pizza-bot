"""EvolutionClient — verify retries kick in for 5xx and timeouts."""
import asyncio

import httpx
import pytest

from app.services.whatsapp import EvolutionClient


class _FakeAsyncClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def request(self, method, url, **kwargs):
        self.calls += 1
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _ok_response():
    req = httpx.Request("POST", "http://x")
    return httpx.Response(200, json={"ok": True}, request=req)


def _server_error():
    req = httpx.Request("POST", "http://x")
    return httpx.Response(500, text="boom", request=req)


@pytest.mark.asyncio
async def test_retries_on_5xx_then_succeeds(monkeypatch):
    fake = _FakeAsyncClient([_server_error(), _ok_response()])
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: fake)
    async def _no_sleep(*_):
        return
    import app.services.whatsapp as wa_mod
    monkeypatch.setattr(wa_mod.asyncio, "sleep", _no_sleep)

    client = EvolutionClient()
    result = await client.send_text("5511", "hi")
    assert result == {"ok": True}
    assert fake.calls == 2


@pytest.mark.asyncio
async def test_retries_on_network_error(monkeypatch):
    fake = _FakeAsyncClient([
        httpx.ConnectError("conn refused"),
        _ok_response(),
    ])
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: fake)
    async def _no_sleep(*_):
        return
    import app.services.whatsapp as wa_mod
    monkeypatch.setattr(wa_mod.asyncio, "sleep", _no_sleep)

    client = EvolutionClient()
    result = await client.send_text("5511", "hi")
    assert result == {"ok": True}
    assert fake.calls == 2


@pytest.mark.asyncio
async def test_gives_up_after_max_retries(monkeypatch):
    fake = _FakeAsyncClient([_server_error()] * 5)
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: fake)
    async def _no_sleep(*_):
        return
    import app.services.whatsapp as wa_mod
    monkeypatch.setattr(wa_mod.asyncio, "sleep", _no_sleep)

    client = EvolutionClient()
    with pytest.raises(httpx.HTTPStatusError):
        await client.send_text("5511", "hi")
    assert fake.calls == EvolutionClient.MAX_RETRIES

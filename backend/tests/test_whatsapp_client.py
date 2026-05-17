"""WhatsApp Cloud API client — phone normalization + payload shape.

The HTTP layer (`_request` retry logic) is tested separately via mocked
httpx; here we focus on the pure helpers and the payload Meta will see
for each send method, so a future refactor can't silently break the
shape Meta requires.
"""
import asyncio
import httpx
import pytest

from app.services.whatsapp import WhatsAppCloudClient


# ---------- _normalize_to ----------

def test_normalize_strips_plus_and_spaces():
    assert WhatsAppCloudClient._normalize_to("+55 17 99128-9777") == "5517991289777"


def test_normalize_strips_at_suffix():
    """Legacy Evolution-era @s.whatsapp.net / @lid suffixes should be dropped."""
    assert WhatsAppCloudClient._normalize_to("5517991289777@s.whatsapp.net") == "5517991289777"
    assert WhatsAppCloudClient._normalize_to("190374526083207@lid") == "190374526083207"


def test_normalize_handles_empty_and_garbage():
    assert WhatsAppCloudClient._normalize_to("") == ""
    assert WhatsAppCloudClient._normalize_to("abc") == ""
    assert WhatsAppCloudClient._normalize_to(None) == ""


# ---------- configured property ----------

def test_configured_requires_both_token_and_phone_id(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "")
    monkeypatch.setattr(settings, "meta_phone_number_id", "")
    assert WhatsAppCloudClient().configured is False

    monkeypatch.setattr(settings, "meta_access_token", "EAA-test")
    assert WhatsAppCloudClient().configured is False  # missing phone id

    monkeypatch.setattr(settings, "meta_phone_number_id", "123")
    assert WhatsAppCloudClient().configured is True


# ---------- send_text + send_template payload shapes ----------

class _FakeResponse:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json = json_data or {"messages": [{"id": "wamid.AAA"}]}
        self.headers = {"content-type": "application/json"}
        self.text = ""
        self.content = b""
        self.request = None

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=self)


def _patch_outbound(monkeypatch, client):
    """Capture the JSON payload posted to /messages without hitting Meta."""
    captured = {}

    async def fake_request(method, url, headers=None, **kwargs):
        captured["method"] = method
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        captured["headers"] = headers
        return _FakeResponse()

    # Replace the underlying httpx async client with our capture
    monkeypatch.setattr(client, "_request", fake_request)
    return captured


@pytest.mark.asyncio
async def test_send_text_payload_shape(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "EAA-test")
    monkeypatch.setattr(settings, "meta_phone_number_id", "123")

    client = WhatsAppCloudClient()
    captured = _patch_outbound(monkeypatch, client)
    # Skip the humanisation sleep so the test runs in millis, not seconds
    monkeypatch.setattr(client, "_text_delay_ms", lambda _t: 0)

    await client.send_text("+55 17 99128-9777", "ola")

    assert captured["method"] == "POST"
    assert captured["url"].endswith("/123/messages")
    payload = captured["json"]
    assert payload["messaging_product"] == "whatsapp"
    assert payload["to"] == "5517991289777"
    assert payload["type"] == "text"
    assert payload["text"]["body"] == "ola"
    assert payload["text"]["preview_url"] is True


@pytest.mark.asyncio
async def test_send_template_without_params(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "EAA-test")
    monkeypatch.setattr(settings, "meta_phone_number_id", "123")
    client = WhatsAppCloudClient()
    captured = _patch_outbound(monkeypatch, client)

    await client.send_template("5517", name="hello_world")

    payload = captured["json"]
    assert payload["type"] == "template"
    assert payload["template"]["name"] == "hello_world"
    assert payload["template"]["language"]["code"] == "pt_BR"
    # No params → no components key
    assert "components" not in payload["template"]


@pytest.mark.asyncio
async def test_send_template_with_body_params(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "EAA-test")
    monkeypatch.setattr(settings, "meta_phone_number_id", "123")
    client = WhatsAppCloudClient()
    captured = _patch_outbound(monkeypatch, client)

    await client.send_template(
        "5517", name="order_status", body_params=["12345", "saiu pra entrega"],
    )

    components = captured["json"]["template"]["components"]
    assert len(components) == 1
    body = components[0]
    assert body["type"] == "body"
    assert body["parameters"] == [
        {"type": "text", "text": "12345"},
        {"type": "text", "text": "saiu pra entrega"},
    ]


@pytest.mark.asyncio
async def test_send_template_with_otp_button(monkeypatch):
    """AUTHENTICATION template carries the OTP in the button params."""
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "EAA-test")
    monkeypatch.setattr(settings, "meta_phone_number_id", "123")
    client = WhatsAppCloudClient()
    captured = _patch_outbound(monkeypatch, client)

    await client.send_template(
        "5517", name="otp_login_code",
        body_params=["123456"], button_params=["123456"],
    )

    components = captured["json"]["template"]["components"]
    assert len(components) == 2
    button = components[1]
    assert button["type"] == "button"
    assert button["sub_type"] == "url"
    assert button["index"] == "0"
    assert button["parameters"] == [{"type": "text", "text": "123456"}]


@pytest.mark.asyncio
async def test_send_text_drops_when_unconfigured(monkeypatch):
    """No token / phone_id → return an error dict, don't crash."""
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "")
    monkeypatch.setattr(settings, "meta_phone_number_id", "")
    client = WhatsAppCloudClient()
    monkeypatch.setattr(client, "_text_delay_ms", lambda _t: 0)

    res = await client.send_text("5517", "x")
    assert res == {"error": "not_configured"}


# ---------- _request retry logic ----------
# (replaces the old test_evolution_client.py retry tests against the new
# client. Same algorithm, different class.)

@pytest.mark.asyncio
async def test_request_retries_on_5xx(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "EAA-test")
    monkeypatch.setattr(settings, "meta_phone_number_id", "123")
    client = WhatsAppCloudClient()
    # Capture real sleep before patching to avoid recursion when the test
    # patch references asyncio.sleep itself.
    real_sleep = asyncio.sleep
    monkeypatch.setattr(
        "app.services.whatsapp.asyncio.sleep", lambda _s: real_sleep(0),
    )

    calls = {"n": 0}

    class _FakeAsyncClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def request(self, *a, **k):
            calls["n"] += 1
            return _FakeResponse(status_code=503)

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    with pytest.raises(httpx.HTTPStatusError):
        await client._request("POST", "https://x/y", json={})
    assert calls["n"] == client.MAX_RETRIES


@pytest.mark.asyncio
async def test_request_does_not_retry_on_4xx(monkeypatch):
    """4xx means "your fault" — retrying won't help, fail fast."""
    from app.config import settings
    monkeypatch.setattr(settings, "meta_access_token", "EAA-test")
    monkeypatch.setattr(settings, "meta_phone_number_id", "123")
    client = WhatsAppCloudClient()

    calls = {"n": 0}

    class _FakeAsyncClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def request(self, *a, **k):
            calls["n"] += 1
            return _FakeResponse(status_code=400)

    monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient)

    with pytest.raises(httpx.HTTPStatusError):
        await client._request("POST", "https://x/y", json={})
    assert calls["n"] == 1  # NOT MAX_RETRIES

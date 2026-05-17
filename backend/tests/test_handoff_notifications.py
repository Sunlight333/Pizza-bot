"""trigger_handoff side-effects.

When the bot hands off (customer asked, rate limit hit, token budget
blown), three things happen:
  1. State flips to human_takeover
  2. Customer gets a "atendente vai responder" message (template if
     META_TEMPLATE_HANDOFF_CUSTOMER is set, freeform otherwise)
  3. Admins get a WhatsApp alert via notifications.alert (template if
     META_TEMPLATE_ADMIN_ALERT is set, freeform otherwise)

When the ADMIN themselves clicks "take over" in the panel, none of those
side-effects should fire — admin is already in the chat about to type.
"""
from unittest.mock import AsyncMock, patch

import pytest

from app.services import handoff as handoff_svc


@pytest.mark.asyncio
async def test_trigger_handoff_default_notifies_customer_and_admins(monkeypatch):
    sent_to_customer: list[tuple[str, str]] = []
    admin_alert_calls: list[tuple[str, str]] = []

    async def fake_send_text(phone, text):
        sent_to_customer.append((phone, text))
        return {"messages": [{"id": "wamid.XXX"}]}

    async def fake_get_state(phone):
        return {"state": "greeting"}

    async def fake_set_state(phone, data):
        return None

    async def fake_broadcast(event, data):
        return None

    async def fake_alert(phone, reason):
        admin_alert_calls.append((phone, reason))

    monkeypatch.setattr("app.services.handoff.state_svc.get_state", fake_get_state)
    monkeypatch.setattr("app.services.handoff.state_svc.set_state", fake_set_state)
    monkeypatch.setattr("app.services.handoff.manager.broadcast", fake_broadcast)
    monkeypatch.setattr("app.services.notifications.handoff_requested_alert", fake_alert)
    # Use freeform send (no template configured) so we exercise the
    # fallback path. The template branch is its own test below.
    monkeypatch.setattr("app.services.whatsapp.client.send_text", fake_send_text)

    await handoff_svc.trigger_handoff("5517991289777", reason="customer_request")

    assert len(sent_to_customer) == 1, "customer should receive 1 reassurance"
    assert sent_to_customer[0][0] == "5517991289777"
    assert "atendente" in sent_to_customer[0][1].lower()
    assert admin_alert_calls == [("5517991289777", "customer_request")]


@pytest.mark.asyncio
async def test_admin_takeover_skips_customer_and_admin_notifications(monkeypatch):
    """When the admin clicks 'take over' from the panel, we must NOT send
    the customer a "atendente vai responder" message — the admin is about
    to type directly — and we must NOT WhatsApp-alert admins (they ARE the
    admin doing this). Tested by hooking the same callsites and asserting
    they were never invoked."""
    customer_send = AsyncMock()
    admin_alert = AsyncMock()

    monkeypatch.setattr(
        "app.services.handoff.state_svc.get_state",
        AsyncMock(return_value={"state": "greeting"}),
    )
    monkeypatch.setattr("app.services.handoff.state_svc.set_state", AsyncMock())
    monkeypatch.setattr("app.services.handoff.manager.broadcast", AsyncMock())
    monkeypatch.setattr("app.services.whatsapp.client.send_text", customer_send)
    monkeypatch.setattr("app.services.notifications.handoff_requested_alert", admin_alert)

    await handoff_svc.trigger_handoff(
        "5517991289777",
        reason="admin_takeover",
        notify_customer=False,
        notify_admins=False,
    )

    customer_send.assert_not_awaited()
    admin_alert.assert_not_awaited()


@pytest.mark.asyncio
async def test_handoff_customer_template_preferred_when_configured(monkeypatch):
    """When META_TEMPLATE_HANDOFF_CUSTOMER is set, use send_template so
    the reassurance works outside the 24h customer-service window."""
    template_calls: list[dict] = []

    async def fake_send_template(phone, *, name, language="pt_BR",
                                 body_params=None, button_params=None):
        template_calls.append({
            "phone": phone, "name": name, "language": language,
            "body_params": body_params, "button_params": button_params,
        })
        return {"messages": [{"id": "wamid.YYY"}]}

    text_send = AsyncMock()

    monkeypatch.setattr("app.config.settings.meta_template_handoff_customer", "handoff_customer_wait")
    monkeypatch.setattr(
        "app.services.handoff.state_svc.get_state",
        AsyncMock(return_value={"state": "greeting"}),
    )
    monkeypatch.setattr("app.services.handoff.state_svc.set_state", AsyncMock())
    monkeypatch.setattr("app.services.handoff.manager.broadcast", AsyncMock())
    monkeypatch.setattr("app.services.notifications.handoff_requested_alert", AsyncMock())
    monkeypatch.setattr("app.services.whatsapp.client.send_template", fake_send_template)
    monkeypatch.setattr("app.services.whatsapp.client.send_text", text_send)

    await handoff_svc.trigger_handoff("5517991289777", reason="customer_request")

    assert len(template_calls) == 1
    assert template_calls[0]["name"] == "handoff_customer_wait"
    text_send.assert_not_awaited()  # template succeeded, no text fallback


@pytest.mark.asyncio
async def test_handoff_falls_back_to_text_when_template_returns_error(monkeypatch):
    """Template configured but Meta rejected it (typo, not approved).
    Must fall back to freeform send_text so the customer still hears something."""

    async def fake_send_template(phone, **kwargs):
        return {"error": {"code": 132001, "message": "template not found"}}

    text_send = AsyncMock(return_value={"messages": [{"id": "wamid.ZZZ"}]})

    monkeypatch.setattr("app.config.settings.meta_template_handoff_customer", "wrong_name")
    monkeypatch.setattr(
        "app.services.handoff.state_svc.get_state",
        AsyncMock(return_value={"state": "greeting"}),
    )
    monkeypatch.setattr("app.services.handoff.state_svc.set_state", AsyncMock())
    monkeypatch.setattr("app.services.handoff.manager.broadcast", AsyncMock())
    monkeypatch.setattr("app.services.notifications.handoff_requested_alert", AsyncMock())
    monkeypatch.setattr("app.services.whatsapp.client.send_template", fake_send_template)
    monkeypatch.setattr("app.services.whatsapp.client.send_text", text_send)

    await handoff_svc.trigger_handoff("5517991289777", reason="customer_request")

    text_send.assert_awaited_once()
    assert "atendente" in text_send.await_args.args[1].lower()

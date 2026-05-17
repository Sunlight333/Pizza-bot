"""Pure-function tests for Meta WhatsApp Cloud API webhook parsing.

Replaces the old Evolution-era test_webhook_parsing.py. Meta's envelope
is `entry[].changes[].value.messages[]` rather than Evolution's flat
`{key, message}` shape, so the helper functions are different.

The full _process_one path can't be unit-tested without mocking the
WhatsApp client + DB session + AI engine; those are integration concerns
covered elsewhere (smoke tests against prod). What we CAN cover here:
the structural helpers (`_extract_message_envelope`, `_push_name`) and
the signature verification (covered separately in test_webhook_signature.py).
"""
import pytest

from app.api.routes.webhook import (
    _extract_message_envelope,
    _push_name,
    _verify_signature,
)


# ---------- envelope walker ----------

def _make_envelope(*messages, contacts=None):
    """Helper to build a realistic Meta webhook envelope."""
    return {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "100288279321420",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "display_phone_number": "+5517991289777",
                        "phone_number_id": "393616145927879",
                    },
                    "contacts": contacts or [],
                    "messages": list(messages),
                },
            }],
        }],
    }


def test_envelope_extracts_single_text_message():
    msg = {"id": "wamid.AAA", "from": "5517999998888", "type": "text",
           "text": {"body": "oi"}}
    env = _make_envelope(msg)
    out = _extract_message_envelope(env)
    assert len(out) == 1
    value, message = out[0]
    assert message["id"] == "wamid.AAA"
    assert message["text"]["body"] == "oi"
    assert value["metadata"]["phone_number_id"] == "393616145927879"


def test_envelope_extracts_multiple_messages_in_same_entry():
    env = _make_envelope(
        {"id": "wamid.AAA", "from": "5517999998888", "type": "text",
         "text": {"body": "first"}},
        {"id": "wamid.BBB", "from": "5511999997777", "type": "text",
         "text": {"body": "second"}},
    )
    out = _extract_message_envelope(env)
    assert len(out) == 2
    assert [m["id"] for _, m in out] == ["wamid.AAA", "wamid.BBB"]


def test_envelope_empty_when_no_messages():
    env = {"object": "whatsapp_business_account", "entry": []}
    assert _extract_message_envelope(env) == []


def test_envelope_handles_status_only_event():
    # Delivery / read receipts arrive in `statuses`, not `messages`. The
    # envelope walker should return nothing — `_handle_safely` logs them.
    env = {
        "object": "whatsapp_business_account",
        "entry": [{"id": "X", "changes": [{
            "field": "messages",
            "value": {"statuses": [{"id": "wamid.X", "status": "delivered"}]},
        }]}],
    }
    assert _extract_message_envelope(env) == []


def test_envelope_walks_nested_changes_safely():
    """Meta sometimes sends multiple changes per entry. All should be walked."""
    env = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "X",
            "changes": [
                {"field": "messages", "value": {
                    "messages": [{"id": "wamid.AAA", "from": "5511", "type": "text"}],
                }},
                {"field": "messages", "value": {
                    "messages": [{"id": "wamid.BBB", "from": "5511", "type": "text"}],
                }},
            ],
        }],
    }
    assert [m["id"] for _, m in _extract_message_envelope(env)] == [
        "wamid.AAA", "wamid.BBB",
    ]


# ---------- push name lookup ----------

def test_push_name_matches_wa_id():
    value = {"contacts": [
        {"wa_id": "5517999998888", "profile": {"name": "Gustavo"}},
        {"wa_id": "5511999997777", "profile": {"name": "Maria"}},
    ]}
    assert _push_name(value, "5517999998888") == "Gustavo"
    assert _push_name(value, "5511999997777") == "Maria"


def test_push_name_returns_none_when_missing():
    assert _push_name({"contacts": []}, "5517999998888") is None
    assert _push_name({}, "5517999998888") is None


def test_push_name_strips_whitespace():
    value = {"contacts": [{"wa_id": "5517", "profile": {"name": "  Ana  "}}]}
    assert _push_name(value, "5517") == "Ana"


def test_push_name_treats_empty_name_as_none():
    value = {"contacts": [{"wa_id": "5517", "profile": {"name": "   "}}]}
    assert _push_name(value, "5517") is None


# ---------- message-type sanity ----------
# These confirm the helpers don't blow up on the various Meta payload
# shapes — the actual handling logic in _process_one is too coupled to
# WhatsApp client + DB to unit-test cleanly, but we can at least confirm
# the envelope extraction handles each type without raising.

@pytest.mark.parametrize("msg_type,body", [
    ("text", {"text": {"body": "oi"}}),
    ("audio", {"audio": {"id": "media-id-abc", "mime_type": "audio/ogg; codecs=opus"}}),
    ("image", {"image": {"id": "media-id-xyz", "mime_type": "image/jpeg",
                          "caption": "olha essa pizza"}}),
    ("location", {"location": {"latitude": -20.7671, "longitude": -49.3847,
                                "name": "Casa", "address": "Rua X"}}),
    ("interactive", {"interactive": {"type": "button_reply",
                                      "button_reply": {"id": "btn_1", "title": "Confirmar"}}}),
])
def test_envelope_handles_all_message_types(msg_type, body):
    msg = {"id": f"wamid.{msg_type}", "from": "5517", "type": msg_type, **body}
    env = _make_envelope(msg)
    out = _extract_message_envelope(env)
    assert len(out) == 1
    _, m = out[0]
    assert m["type"] == msg_type
    # Spot-check the type-specific payload made it through
    assert msg_type in m

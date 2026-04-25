"""Pure-function tests for webhook payload parsing."""
from app.api.routes.webhook import _extract_audio_id, _extract_phone, _extract_text


def test_extract_phone_strips_jid_suffix():
    data = {"key": {"remoteJid": "5511999999999@s.whatsapp.net"}}
    assert _extract_phone(data) == "5511999999999"


def test_extract_phone_handles_missing():
    assert _extract_phone({}) is None
    assert _extract_phone({"key": {}}) is None


def test_extract_text_from_conversation():
    data = {"message": {"conversation": "Oi, boa noite"}}
    assert _extract_text(data) == "Oi, boa noite"


def test_extract_text_from_extended_text():
    data = {"message": {"extendedTextMessage": {"text": "quero uma pizza"}}}
    assert _extract_text(data) == "quero uma pizza"


def test_extract_text_from_button_response():
    data = {"message": {"buttonsResponseMessage": {"selectedDisplayText": "Confirmar"}}}
    assert _extract_text(data) == "Confirmar"


def test_extract_text_from_list_response():
    data = {"message": {"listResponseMessage": {"title": "Calabresa"}}}
    assert _extract_text(data) == "Calabresa"


def test_extract_text_returns_none_when_absent():
    assert _extract_text({}) is None
    assert _extract_text({"message": {}}) is None


def test_extract_audio_id_returns_message_id():
    data = {"message": {"audioMessage": {}}, "key": {"id": "ABCDEF123"}}
    assert _extract_audio_id(data) == "ABCDEF123"


def test_extract_audio_id_none_when_no_audio():
    data = {"message": {"conversation": "hi"}, "key": {"id": "X"}}
    assert _extract_audio_id(data) is None


def test_extract_audio_id_handles_missing_message():
    assert _extract_audio_id({}) is None

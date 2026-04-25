"""Webhook HMAC signature verification."""
import hashlib
import hmac

from app.api.routes.webhook import _verify_signature
from app.config import settings


def test_skip_when_secret_not_set(monkeypatch):
    monkeypatch.setattr(settings, "evolution_webhook_secret", "")
    assert _verify_signature(b"any payload", None) is True
    assert _verify_signature(b"any payload", "garbage") is True


def test_rejects_when_secret_set_and_signature_missing(monkeypatch):
    monkeypatch.setattr(settings, "evolution_webhook_secret", "topsecret")
    assert _verify_signature(b"payload", None) is False
    assert _verify_signature(b"payload", "") is False


def test_accepts_correct_signature(monkeypatch):
    secret = "topsecret"
    monkeypatch.setattr(settings, "evolution_webhook_secret", secret)
    body = b'{"event":"test"}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert _verify_signature(body, sig) is True
    assert _verify_signature(body, f"sha256={sig}") is True


def test_rejects_wrong_signature(monkeypatch):
    secret = "topsecret"
    monkeypatch.setattr(settings, "evolution_webhook_secret", secret)
    body = b'{"event":"test"}'
    sig = hmac.new(b"wrong-secret", body, hashlib.sha256).hexdigest()
    assert _verify_signature(body, sig) is False

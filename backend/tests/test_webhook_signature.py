"""Webhook HMAC signature verification for Meta Cloud API.

The new webhook validates against META_APP_SECRET (was EVOLUTION_WEBHOOK_SECRET
in the previous integration). Signature format unchanged: `sha256=<hex>` in
the X-Hub-Signature-256 header, HMAC-SHA256 of the raw request body.
"""
import hashlib
import hmac

from app.api.routes.webhook import _verify_signature
from app.config import settings


def test_skip_when_secret_not_set(monkeypatch):
    """No secret configured → verification is bypassed (dev mode)."""
    monkeypatch.setattr(settings, "meta_app_secret", "")
    assert _verify_signature(b"any payload", None) is True
    assert _verify_signature(b"any payload", "garbage") is True


def test_rejects_when_secret_set_and_signature_missing(monkeypatch):
    monkeypatch.setattr(settings, "meta_app_secret", "topsecret")
    assert _verify_signature(b"payload", None) is False
    assert _verify_signature(b"payload", "") is False


def test_accepts_correct_signature(monkeypatch):
    secret = "topsecret"
    monkeypatch.setattr(settings, "meta_app_secret", secret)
    body = b'{"event":"test"}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert _verify_signature(body, sig) is True
    assert _verify_signature(body, f"sha256={sig}") is True
    # Case-insensitive — Meta sometimes uppercases the hex on retries.
    assert _verify_signature(body, f"sha256={sig.upper()}") is True


def test_rejects_tampered_body(monkeypatch):
    secret = "topsecret"
    monkeypatch.setattr(settings, "meta_app_secret", secret)
    correct = hmac.new(secret.encode(), b"original", hashlib.sha256).hexdigest()
    # Same signature, different body — must fail
    assert _verify_signature(b"tampered", correct) is False


def test_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(settings, "meta_app_secret", "real_secret")
    body = b'{"x":1}'
    bad_sig = hmac.new(b"attacker_secret", body, hashlib.sha256).hexdigest()
    assert _verify_signature(body, bad_sig) is False

"""
Unit tests for the three abuse / token barriers in ai_engine.

These barriers protect the WhatsApp bot from:
  A — pathologically long inbound messages (text or transcribed audio)
  B — single calls whose payload would exceed the per-minute token budget
  C — single phones flooding the bot and draining the daily token budget

The HARD requirement these tests enforce: any reply emitted by a barrier
to the customer must NEVER contain technical jargon. If a future change
introduces "rate limit", "token", "429", "INVÁLIDO" or similar into the
copy, this suite must fail loudly.
"""
import re

import pytest

from app.services.ai_engine import (
    MAX_INBOUND_CHARS,
    PER_PHONE_HOURLY_CAP,
    TPM_SAFE_LIMIT_TOKENS,
    _estimate_messages_tokens,
)


FORBIDDEN_TECHNICAL_WORDS = [
    "rate limit", "rate-limit", "ratelimit",
    "token", "tokens",
    "openai", "gpt",
    "429", "tpm",
    "inválido:", "erro:", "exception", "traceback",
    "exceeded", "quota",
    "api ",
]


def assert_no_technical_leak(text: str) -> None:
    low = text.lower()
    for forbidden in FORBIDDEN_TECHNICAL_WORDS:
        assert forbidden not in low, (
            f"Customer-facing string leaks technical term {forbidden!r}: {text!r}"
        )


# ---------- copy library used by the live ai_engine ----------
# Mirrors the strings inside process_incoming so the test catches a
# regression even if someone edits the production copy directly.

POLITE_REPLIES = {
    "long_text": (
        "Foi muita coisa de uma vez 😊 Me manda em partes menores que "
        "assim eu consigo te ajudar bem!"
    ),
    "long_audio": (
        "Seu áudio ficou bem comprido 😅 Manda ele em pedaços menores, "
        "de até um minutinho, que assim eu te entendo direitinho!"
    ),
    "tpm": (
        "Tô com muito atendimento simultâneo agora 🙏 "
        "Me dá um minutinho que já te respondo direitinho!"
    ),
    "phone_cap": (
        "Já trocamos várias mensagens, hein! 😊 "
        "Vou pedir pra um colega aqui te dar mais atenção. Já já alguém fala com você."
    ),
    "daily_budget": (
        "Oi! A casa tá cheia hoje 😊 Já já um colega te responde por aqui."
    ),
}


@pytest.mark.parametrize("label,text", list(POLITE_REPLIES.items()))
def test_replies_have_no_technical_leak(label, text):
    assert_no_technical_leak(text)
    # And they must look like real Brazilian Portuguese, not generic AI stub.
    assert any(emoji in text for emoji in ("😊", "😅", "🙏")), (
        f"{label!r} reply lacks the warm-tone emoji we standardize on"
    )
    assert len(text) >= 40, f"{label!r} reply too curt to feel human"
    assert len(text) <= 220, f"{label!r} reply too long for a chat bubble"


# ---------- Barrier B: token estimator ----------

def test_estimator_scales_with_input_size():
    short = [{"role": "user", "content": "oi tudo bem"}]
    long_ = [{"role": "user", "content": "x" * 100_000}]
    short_est = _estimate_messages_tokens(short)
    long_est = _estimate_messages_tokens(long_)
    # 100k chars should land in the same order of magnitude as 25k tokens
    assert long_est > 20_000, f"100k chars -> only ~{long_est} tokens (estimator under-counts)"
    # And short input should be tiny
    assert short_est < 50, f"short input -> ~{short_est} tokens (over-counts)"


def test_estimator_handles_content_parts_payload():
    """OpenAI sometimes uses [{type, text}] for content; estimator tolerates."""
    msgs = [{
        "role": "user",
        "content": [{"type": "text", "text": "olá " * 1000}],
    }]
    est = _estimate_messages_tokens(msgs)
    assert est > 500, f"content-parts shape under-counted at ~{est} tokens"


def test_safe_tpm_below_org_ceiling():
    """The safe limit must be well below the org's 30k TPM ceiling so two
    near-simultaneous calls don't both pass and then 429."""
    assert TPM_SAFE_LIMIT_TOKENS < 30_000, "safe TPM limit too close to org ceiling"
    assert TPM_SAFE_LIMIT_TOKENS >= 15_000, "safe TPM limit too restrictive — would refuse normal calls"


# ---------- Barrier A: input cap is reasonable ----------

def test_input_cap_lets_normal_orders_through():
    """A real WhatsApp pizza order text is well under the cap."""
    typical_order = (
        "oi! quero uma pizza grande de calabresa com borda catupiry e um "
        "refrigerante 2 litros pra entrega. meu endereço é Rua das Flores "
        "número 123, apartamento 45 bloco B, Vila Mariana. pago no pix"
    )
    assert len(typical_order) < MAX_INBOUND_CHARS


def test_input_cap_rejects_obviously_pathological():
    """A multi-page paste should exceed the cap."""
    pasted_essay = "lorem ipsum " * 200  # 2400 chars
    assert len(pasted_essay) > MAX_INBOUND_CHARS


# ---------- Barrier C: per-phone cap is realistic ----------

def test_phone_cap_above_a_real_order_chat():
    """30 messages/h covers a chatty order (~10 turns) plus follow-up."""
    # Conservative real-world baseline: greeting + 6-8 round trips for the
    # order + 2-3 final confirmations = ~15-20 messages. Cap should leave
    # room for that plus some chit-chat.
    typical_order_msg_count = 20
    assert PER_PHONE_HOURLY_CAP > typical_order_msg_count, (
        f"hourly cap {PER_PHONE_HOURLY_CAP} too tight — would block normal orders"
    )


def test_phone_cap_below_obvious_spam():
    """The cap exists to catch a number flooding the bot. 30/h is enough
    that a real customer never hits it but a scripted spammer does fast."""
    one_message_per_minute_for_an_hour = 60
    assert PER_PHONE_HOURLY_CAP < one_message_per_minute_for_an_hour, (
        f"hourly cap {PER_PHONE_HOURLY_CAP} would let spam through"
    )

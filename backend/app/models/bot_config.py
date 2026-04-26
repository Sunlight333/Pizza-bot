from typing import Optional

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class BotConfig(Base, TimestampMixin):
    """
    Single-row table holding bot personality settings.
    Always queried as id=1; seed creates the row.
    """
    __tablename__ = "bot_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # Persona — name the bot uses to introduce itself ("Oi, sou a Bia da pizzaria...")
    bot_name: Mapped[str] = mapped_column(String(40), default="Bia", nullable=False)

    greeting: Mapped[str] = mapped_column(
        Text,
        default="Oi! Boa noite — sou o atendente virtual da pizzaria. Como posso ajudar?",
        nullable=False,
    )
    enable_repeat_last_order: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    working_hours_start: Mapped[int] = mapped_column(Integer, default=18, nullable=False)
    working_hours_end: Mapped[int] = mapped_column(Integer, default=23, nullable=False)

    # Days the pizzaria is CLOSED. Python weekday convention: Mon=0, Sun=6.
    # Marcio's pizzaria is closed Monday → [0]. Default empty (open every day).
    closed_weekdays: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    off_hours_message: Mapped[str] = mapped_column(
        Text,
        default="No momento estamos fechados. Funcionamos das 18h às 23h. 🍕",
        nullable=False,
    )

    # PIX information surfaced to the customer when they pick PIX as payment method.
    pix_key: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    pix_holder: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    max_items_per_order: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    ask_cpf: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tts_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    extra_system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # --- Pricing rule (C3) ---
    # Meio-a-meia: 'max' (BR standard), 'average', or 'first'.
    # Configurable so we don't need a code redeploy when Marcio decides.
    half_pizza_pricing: Mapped[str] = mapped_column(String(16), default="max", nullable=False)

    # --- Default Datacaixa tax fields (C2) ---
    # Used as fallback when a product's own NCM/CFOP/etc are blank.
    # Until the contadora certifies real codes per product, these prevent
    # blank fiscal fields (which Datacaixa rejects).
    default_ncm: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    default_cfop: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    default_csosn: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    default_cest: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    default_origin_code: Mapped[Optional[str]] = mapped_column(String(4), default="0", nullable=True)
    default_ibpt_code: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # --- Cupom fiscal emission flow (C4) ---
    # 'auto' assumes Datacaixa auto-emits after the .txt import (fast, riskier).
    # 'manual' requires the operator to confirm each emission in the panel
    # (safer until Gabriel confirms Datacaixa's actual behavior).
    fiscal_emission_mode: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)

    # --- LGPD (one-time disclosure on first customer contact) ---
    privacy_notice: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # --- OpenAI cost guardrail ---
    # Daily input+output token budget (0 disables). When exceeded, the bot
    # short-circuits to handoff so spend can't run away on a quiet weekend.
    daily_token_budget: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(...)
    redis_url: str = Field(default="redis://redis:6379/0")

    jwt_secret: str = Field(...)
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_hours: int = Field(default=24)

    openai_api_key: str = Field(default="")

    # Meta WhatsApp Cloud API. Replaces the old Evolution integration —
    # set these in /opt/pizzabot/.env on the VPS. Token is a permanent
    # System User token from Meta Business Settings → Users → System
    # users → pizzabot. App secret is from App Dashboard → Settings →
    # Basic. Phone number id is from App Dashboard → WhatsApp → API
    # Setup (NOT the phone number itself — a separate id). Verify token
    # is a freeform string we send back during the GET handshake; pick
    # anything random and paste the same value into Meta's webhook config.
    meta_access_token: str = Field(default="")
    meta_app_secret: str = Field(default="")
    meta_phone_number_id: str = Field(default="")
    meta_waba_id: str = Field(default="")
    meta_display_phone_number: str = Field(default="")  # E.164 e.g. +5517991234567
    meta_verify_token: str = Field(default="")
    meta_graph_version: str = Field(default="v22.0")

    bridge_token: str = Field(default="")
    admin_phones: str = Field(default="")  # comma-separated

    cors_origins: str = Field(default="http://localhost:5173")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

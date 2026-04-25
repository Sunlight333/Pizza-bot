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

    evolution_api_url: str = Field(default="")
    evolution_api_key: str = Field(default="")
    evolution_instance_name: str = Field(default="pizzabot")
    evolution_webhook_secret: str = Field(default="")

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

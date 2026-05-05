"""Конфигурация из переменных окружения (префикс NLLB_)."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="NLLB_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # facebook/nllb-200-distilled-600M — минимальный разумный вариант для слабого VPS (≈2–4 GB RAM).
    # Усилить качество: NLLB_MODEL_ID=facebook/nllb-200-1.3B или facebook/nllb-200-3.3B (больше RAM).
    model_id: str = "facebook/nllb-200-distilled-600M"
    host: str = "0.0.0.0"
    port: int = Field(default=8088, ge=1, le=65535)
    api_key: str = ""

    max_input_chars: int = Field(default=8000, ge=100, le=50000)
    max_new_tokens: int = Field(default=512, ge=16, le=1024)
    num_beams: int = Field(default=2, ge=1, le=8)


@lru_cache
def get_settings() -> Settings:
    return Settings()

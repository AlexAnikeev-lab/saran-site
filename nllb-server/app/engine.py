"""Загрузка NLLB и перевод (CPU)."""
from __future__ import annotations

import logging
from threading import Lock
from typing import Optional

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from app.config import Settings

logger = logging.getLogger(__name__)

_lock = Lock()
_tokenizer: Optional[AutoTokenizer] = None
_model: Optional[AutoModelForSeq2SeqLM] = None
_loaded_model_id: Optional[str] = None


def _device() -> torch.device:
    return torch.device("cpu")


def load_model(settings: Settings) -> None:
    global _tokenizer, _model, _loaded_model_id
    with _lock:
        if _model is not None and _loaded_model_id == settings.model_id:
            return
        logger.info("Загрузка модели %s (CPU)…", settings.model_id)
        tok = AutoTokenizer.from_pretrained(settings.model_id)
        m = AutoModelForSeq2SeqLM.from_pretrained(settings.model_id)
        m.eval()
        m.to(_device())
        _tokenizer = tok
        _model = m
        _loaded_model_id = settings.model_id
        logger.info("Модель готова: %s", settings.model_id)


def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    settings: Settings,
) -> str:
    """Перевод одного фрагмента NLLB FLORES-кодами языков."""
    if _tokenizer is None or _model is None:
        load_model(settings)

    assert _tokenizer is not None and _model is not None

    if target_lang not in _tokenizer.lang_code_to_id:
        raise ValueError(f"Неизвестный целевой язык: {target_lang}")
    if source_lang not in _tokenizer.lang_code_to_id:
        raise ValueError(f"Неизвестный исходный язык: {source_lang}")

    _tokenizer.src_lang = source_lang
    inputs = _tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=1024,
    )
    inputs = {k: v.to(_device()) for k, v in inputs.items()}

    forced_bos_token_id = int(_tokenizer.lang_code_to_id[target_lang])

    with torch.no_grad():
        generated = _model.generate(
            **inputs,
            forced_bos_token_id=forced_bos_token_id,
            max_new_tokens=settings.max_new_tokens,
            num_beams=settings.num_beams,
            length_penalty=1.0,
            early_stopping=True,
        )

    out = _tokenizer.batch_decode(generated, skip_special_tokens=True)[0]
    return out.strip()

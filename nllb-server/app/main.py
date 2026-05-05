"""HTTP API для NLLB на своём VPS."""
from __future__ import annotations

import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import get_settings
from app.engine import load_model, translate_text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class TranslateIn(BaseModel):
    text: str = Field(..., min_length=1)
    source_lang: str = Field(default="eng_Latn", min_length=3, max_length=32)
    target_lang: str = Field(default="bury_Cyrl", min_length=3, max_length=32)


class TranslateOut(BaseModel):
    translated_text: str
    model: str
    backend: str = "nllb-server"


@asynccontextmanager
async def lifespan(app: FastAPI):
    st = get_settings()
    try:
        load_model(st)
    except Exception as e:
        logger.error("Не удалось загрузить модель при старте: %s", e)
        logger.debug(traceback.format_exc())
        # поднимаем сервер — загрузка повторится на первом /translate
    yield


app = FastAPI(
    title="Saran NLLB",
    description="Локальный перевод NLLB (Meta) для bury_Cyrl и др.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    st = get_settings()
    return {"status": "ok", "model": st.model_id}


@app.post("/translate", response_model=TranslateOut)
def translate(
    body: TranslateIn,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    st = get_settings()
    if st.api_key:
        if not x_api_key or x_api_key != st.api_key:
            raise HTTPException(status_code=401, detail="invalid_api_key")

    raw = body.text.strip()
    if len(raw) > st.max_input_chars:
        raw = raw[: st.max_input_chars]

    try:
        out = translate_text(
            raw,
            body.source_lang.strip(),
            body.target_lang.strip(),
            st,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Ошибка перевода")
        raise HTTPException(status_code=500, detail=str(e)) from e

    return TranslateOut(translated_text=out, model=st.model_id)

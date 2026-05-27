#!/usr/bin/env python3
"""
Читает ключ OpenRouter из .env (Token= или OPENROUTER_API_KEY=),
берёт задания из data/buryat-curriculum.json → meta.imageGenerationQueue,
генерирует изображения через OpenRouter (modalities image+text) и сохраняет файлы.

Лимит: meta.openRouter.maxUsdBudgetPerRun (по умолчанию 2 USD) — останавливается,
если накопленная стоимость из ответов API превысит бюджет (поле usage может отличаться по версии API).

Примеры:
  python3 scripts/generate_lesson_assets_openrouter.py --dry-run
  python3 scripts/generate_lesson_assets_openrouter.py --max 2
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
CURR_PATH = ROOT / "data" / "buryat-curriculum.json"
API_URL = "https://openrouter.ai/api/v1/chat/completions"


def load_dotenv_token() -> str:
    if not ENV_PATH.is_file():
        print("Нет файла .env — создайте из .env.example", file=sys.stderr)
        return ""
    text = ENV_PATH.read_text(encoding="utf-8", errors="ignore")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("Token="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
        if line.startswith("OPENROUTER_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("В .env не найден Token= или OPENROUTER_API_KEY=", file=sys.stderr)
    return ""


def parse_cost_from_usage(usage: object) -> float:
    if not isinstance(usage, dict):
        return 0.0
    for key in ("total_cost", "cost", "generation_cost"):
        v = usage.get(key)
        if isinstance(v, (int, float)):
            return float(v)
    # иногда вложено
    details = usage.get("cost_details")
    if isinstance(details, dict):
        v = details.get("total")
        if isinstance(v, (int, float)):
            return float(v)
    return 0.0


def save_data_url(url: str, dest: Path) -> None:
    m = re.match(r"^data:image/(png|jpeg|jpg|webp);base64,(.+)$", url, re.I | re.S)
    if not m:
        raise ValueError("Неизвестный формат data URL")
    ext = m.group(1).lower()
    if ext == "jpeg":
        ext = "jpg"
    raw = base64.b64decode(m.group(2))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(raw)


def post_json(url: str, headers: dict, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=4, help="Максимум изображений за запуск")
    ap.add_argument("--dry-run", action="store_true", help="Только печать плана, без API")
    ap.add_argument("--model", default="", help="Переопределить image model из JSON")
    args = ap.parse_args()

    if not CURR_PATH.is_file():
        print("Нет", CURR_PATH, file=sys.stderr)
        return 1

    curriculum = json.loads(CURR_PATH.read_text(encoding="utf-8"))
    meta = curriculum.get("meta") or {}
    or_meta = meta.get("openRouter") or {}
    budget = float(or_meta.get("maxUsdBudgetPerRun") or 2.0)
    model = (args.model or or_meta.get("imageModelDefault") or "google/gemini-2.5-flash-image").strip()
    queue = list(meta.get("imageGenerationQueue") or [])

    token = load_dotenv_token()
    if not args.dry_run and not token:
        return 1

    spent = 0.0
    done = 0
    print(f"Модель: {model}, бюджет: ${budget:.2f}, лимит штук: {args.max}, dry_run={args.dry_run}")

    for job in queue[: args.max]:
        jid = job.get("id", "?")
        rel = job.get("outputRelativePath") or ""
        prompt = (job.get("promptEn") or "").strip()
        dest = ROOT / rel
        print(f"- {jid} → {rel}")
        if args.dry_run:
            continue
        if spent >= budget:
            print("  остановка: бюджет исчерпан")
            break
        if not prompt:
            print("  пропуск: пустой promptEn")
            continue

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],
            "image_config": {"aspect_ratio": "1:1", "image_size": "1K"},
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://saran.local",
            "X-Title": "Saran curriculum asset gen",
        }
        try:
            result = post_json(API_URL, headers, payload)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace") if e.fp else ""
            print(f"  HTTP {e.code}: {body[:500]}", file=sys.stderr)
            return 1
        except Exception as e:
            print(f"  ошибка: {e}", file=sys.stderr)
            return 1

        usage = result.get("usage")
        c = parse_cost_from_usage(usage)
        if c:
            spent += c
            print(f"  стоимость ответа (оценка API): ${c:.4f}, всего ~${spent:.4f}")

        choices = result.get("choices") or []
        if not choices:
            print("  нет choices в ответе", file=sys.stderr)
            return 1
        msg = choices[0].get("message") or {}
        images = msg.get("images") or []
        if not images:
            print("  нет images — проверьте модель и modalities", json.dumps(result)[:800], file=sys.stderr)
            return 1
        url = (images[0].get("image_url") or {}).get("url") or ""
        if not url.startswith("data:"):
            print("  неожиданный формат image url", file=sys.stderr)
            return 1
        save_data_url(url, dest)
        print(f"  сохранено: {dest} ({dest.stat().st_size} bytes)")
        done += 1
        if spent >= budget:
            print("достигнут лимит бюджета после сохранения")
            break

    print(f"Готово. Сгенерировано файлов: {done}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

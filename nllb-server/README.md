# NLLB-сервер для Saran

Локальный перевод **NLLB-200** (Meta) на вашем VPS без Hugging Face Inference. По умолчанию — **`facebook/nllb-200-distilled-600M`**: минимальный размер при приемлемом качестве для короткой переписки; для заметно лучшего качества (и большей RAM) можно переключиться на **`facebook/nllb-200-1.3B`** или **`facebook/nllb-200-3.3B`**.

## Требования

- Python **3.10+**
- **RAM**: ориентир **≥ 3–4 GB** для distilled 600M на CPU (с запасом под ОС); **1.3B** — около **6–8 GB**, **3.3B** — существенно больше.
- Диск: несколько GB под кэш моделей (`~/.cache/huggingface`).

## Установка (CPU)

```bash
cd nllb-server
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
cp .env.example .env
```

Первый запрос скачает веса с Hugging Face (нужен интернет).

## Запуск

```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8088
```

Проверка: `GET http://127.0.0.1:8088/health`

Перевод:

```bash
curl -s -X POST http://127.0.0.1:8088/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, how are you?","source_lang":"eng_Latn","target_lang":"bury_Cyrl"}'
```

Если задан `NLLB_API_KEY` в `.env`, добавьте заголовок: `-H "X-API-Key: ваш_ключ"`.

## Связка с сайтом (PHP на Рег.ру)

На хостинге в переменных окружения (или в конфиге PHP, если поддерживается):

- `SARAN_NLLB_SELF_HOST_URL=https://ваш-домен-или-ip:8088` — без завершающего `/`
- при необходимости: `SARAN_NLLB_SELF_HOST_API_KEY` — тот же ключ, что `NLLB_API_KEY` на VPS

Файл `api/nllb-translate.php` сначала проксирует запрос на ваш VPS; токен Hugging Face для этого не нужен.

**Безопасность:** не открывайте порт наружу без firewall; лучше **nginx + HTTPS** и ограничение по IP или секрет в `X-API-Key`.

## Docker (опционально)

```bash
docker build -t saran-nllb ./nllb-server
docker run -p 8088:8088 --env-file nllb-server/.env saran-nllb
```

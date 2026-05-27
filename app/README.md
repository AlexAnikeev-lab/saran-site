# RICHREP Subscription Access

## Что сделано
Проверка доступа к обучению теперь опирается на запись в Supabase, а не на “разрешение по ID” напрямую в боте.

Сценарий такой:
1. Админ в Telegram боте выполняет команду `/grant <telegram_user_id>` (или `/revoke <telegram_user_id>`).
2. Бот сохраняет статус доступа в таблицу `public.subscription_access` в Supabase.
3. Сервер miniapp (FastAPI) по endpoint `POST /api/access` читает статус в Supabase и возвращает `{ "allowed": true|false }`.
4. `index.html` (Telegram WebApp) вызывает этот endpoint при старте и блокирует вкладку “Обучение”, если `allowed=false`.

## Supabase
В репозитории есть SQL-макет миграции:
`supabase/migrations/0001_create_access_table.sql`

Запустите его в SQL редакторе Supabase (Project -> SQL Editor).

Таблица:
`public.subscription_access`

Ключ: `telegram_user_id` (unique/primary key).

## Переменные окружения
Создайте файл `.env` на основе `.env-example` (он не коммитится).

Обязательные переменные:
- `BOT_TOKEN`
- `ADMIN_IDS` (через запятую)
- `BOT_VERSION`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_MODE` (`bot` или `api`)

Для API дополнительно (см. `api_server/.env-example`):
- `BOT_TOKEN` — как у бота (проверка `initData`, `sendAudio` для подкастов)
- `PODCAST_*_AUDIO_FILE_ID` / `URL` — те же, что у бота
- `CORS_ALLOW_ORIGINS` — см. ниже «Что такое CORS»; для фронта на Vercel укажите `https://ваш-проект.vercel.app` (через запятую, если несколько)
- `API_HOST` (по умолчанию `0.0.0.0`)
- `API_PORT` (по умолчанию `8000`)
- `API_RATE_MIN_INTERVAL_SEC` (по умолчанию `1.0`)
- `CACHE_TTL_SEC` (по умолчанию `60`)

### Что такое CORS
**CORS** (Cross-Origin Resource Sharing) — правила браузера: страница с одного домена (например `https://сайт.vercel.app`) не может по умолчанию читать ответы API с **другого** домена (например `https://api.ваш-сервер.ru`), пока сам API явно не разрешит это заголовками.

У вас типичный случай: **фронт** на Vercel, **API** на отдельном хосте. Тогда в `.env` API нужно задать `CORS_ALLOW_ORIGINS` со **списком разрешённых origin’ов** — точным URL фронта (с `https://`, без слэша в конце), например `https://richrep.vercel.app`. Если фронт и API отдаются **с одного origin** (например всё через Vercel rewrite на `/api/*`), браузер считает запросы «своими» и отдельная настройка CORS часто не мешает.

## Важно про miniapp URL
В `index.html` добавлена проверка доступа через переменную:
`window.MINIAPP_API_URL`

Если переменная не задана, код считает доступ отсутствующим (чтобы было безопасно по умолчанию).

Надёжный способ: перед началом скрипта в `index.html` добавьте строку:
`window.MINIAPP_API_URL = "https://ваш-домен-миниапп-api";`

Либо напрямую замените строку `REPLACE_MINIAPP_API_URL` в коде `index.html`.

### Вариант для Vercel (рекомендуется)
В репозитории добавлен `vercel.json` с rewrite:
- `/api/*` → URL вашего бэкенда (сейчас в файле указан пример; **замените на свой** `https://хост:порт` или IP API).

Поэтому в `index.html` можно не задавать `window.MINIAPP_API_URL` (используются относительные пути `/api/...`), и браузер не упирается в mixed-content при загрузке по `https`.

### Деплой «фронт + бэкенд» (текущее состояние)
Рабочая схема: **статический фронт** (например Vercel) отдаёт `index.html` и ассеты; **запросы `/api/*`** проксируются на **FastAPI** на сервере. **Бот** — отдельный процесс (тот же репозиторий, папка `bot_server`), к сайту HTTP не обязателен, нужны `BOT_TOKEN`, Supabase и `ADMIN_IDS`.

Перед выкладкой проверьте:
- В **Supabase** применены нужные миграции (в т.ч. `007_web_access_codes.sql` для кодов с сайта).
- У **API** в `.env` заданы `SUPABASE_*`, `CORS_ALLOW_ORIGINS` (origin фронта, например `https://ваш-проект.vercel.app`), при HTTPS обычно `SESSION_COOKIE_SECURE=true`.
- В **`vercel.json`** destination указывает на **реальный** хост API после деплоя.

**Docker** (без общего `docker-compose` в корне бэкенда): образы собираются из папок сервисов.

```text
cd Backend/Backend_richrep
docker build -t richrep-api ./api_server
docker build -t richrep-bot ./bot_server
```

Запуск: пробросьте порт `8000` для API, передайте env через `-e` или `--env-file`. Старый `docker-compose.yml` в репозитории удалён; сервис `ai_helper_bot` из него, если использовался, поднимайте отдельно.

## Запуск
1. Бот:
   - `APP_MODE=bot python main.py`
2. API miniapp:
   - `APP_MODE=api python main.py`

## Команды бота
- `/grant <telegram_user_id>` — включить доступ (Telegram miniapp)
- `/revoke <telegram_user_id>` — отключить доступ
- `/webcode` — выдать **одноразовый код** для входа на сайт (только админы)
- `/version` — показать версию

### Доступ к обучению на сайте (браузер / «на экран домой»)
1. Админ выполняет `/webcode` и передаёт клиенту код лично.
2. Клиент открывает обычный URL сайта, при желании добавляет на рабочий стол, на экране оплаты внизу вводит код. Код **один раз** создаёт веб-сессию (cookie) и помечается использованным; на устройстве сохраняется флаг доступа.
3. В Supabase нужно применить миграцию `Backend/Backend_richrep/supabase/migrations/007_web_access_codes.sql` (таблица `web_access_codes` и функция `redeem_web_access_code`).
4. API: `POST /api/web/redeem` с телом `{ "code": "..." }`, затем `GET /api/web/me` для проверки сессии.

**Если «не удалось применить код»:** бот тут ни при чём — запрос идёт на FastAPI. Проверьте: миграция `007_web_access_codes.sql` выполнена в Supabase; процесс API перезапущен с актуальным кодом; `POST https://ваш-домен/api/web/redeem` отвечает 200 (не 404/502). В консоли браузера (F12) смотрите лог `[WebApp] /api/web/redeem` с HTTP-кодом и телом ответа.

## WebApp и подкасты
Бот работает с Telegram WebApp (`index.html`). При `/start` пользователь получает приветственное сообщение `👋 Добро пожаловать!` и кнопку `Открыть приложение`.

**Доступ к обучению:** `POST /api/access` с `{ "telegram_user_id": … }` из `initDataUnsafe.user.id` (как раньше).

**Подкаст в чат:** `POST /api/podcast/send` с телом `{ "init_data": "<Telegram.WebApp.initData>", "podcast_slug": "p32"|"p63" }` (или вместо `podcast_slug` — пара `h1`/`h2` hex). Сервер проверяет подпись `initData`, подписку в Supabase и вызывает Telegram **sendAudio**. Фронтенд `index.html` в этом репозитории собран как **обычный сайт** (SDK Telegram Web App и `js/telegram-web-app.js` не используются). **`sendData` для подкаста не используется** (нестабилен из профиля бота / Main App). Бот по-прежнему может обрабатывать `web_app_data` и deep-link `podcast:…` в `podcasts.py` — по желанию.

Настройки подкастов в `bot_server/.env`:
- `WEBAPP_URL` — URL до вашего `index.html` (например, `https://example.com/index.html`) для кнопки `Открыть приложение`
- `PODCAST_32_AUDIO_FILE_ID` или `PODCAST_32_AUDIO_URL` — аудио для подкаста `32 мин`
- `PODCAST_63_AUDIO_FILE_ID` или `PODCAST_63_AUDIO_URL` — аудио для подкаста `63 мин`

### Админская загрузка подкастов (сохранение только `file_id`)
Админ отправляет в бота сообщение с аудио (или voice) и caption:
- `32 мин` (или `32min`) — подкаст `32 min`
- `63 мин` (или `63min`) — подкаст `63 min`

Бот ответит админу `file_id` и подскажет, в какие переменные `.env` вставить значения.
После этого перезапустите бота, чтобы новые `PODCAST_32_AUDIO_FILE_ID` / `PODCAST_63_AUDIO_FILE_ID` начали использоваться.

## Тестовые сценарии
1. Happy path
   - Админ отправляет `/grant 12345`
   - Пользователь с `telegram_user_id=12345` открывает miniapp
   - Вкладка “Обучение” становится доступной

2. Отрицательный кейс
   - Для `telegram_user_id` нет записи в `subscription_access` или `is_active=false`
   - Вкладка “Обучение” блокируется сообщением “Доступ к обучению ограничен...”

3. Неверный user id
   - Если miniapp не получил `telegram_user_id` из контекста Telegram WebApp
   - Доступ будет считаться `false`, бот не упадёт

4. Антифлуд в API
   - Серия быстрых запросов `POST /api/access` от одного клиента
   - API начнёт отдавать `HTTP 429`, miniapp воспримет это как `allowed=false`

## Примечание по безопасности
- **`POST /api/podcast/send`** — на сервере проверяется подпись **`init_data`** (HMAC), `telegram_user_id` берётся только из проверенного поля `user`.
- **`POST /api/access`** — по-прежнему доверяет **`telegram_user_id` из тела** (как раньше). Усиление: перевести проверку доступа на тот же `init_data`, что и для подкастов.


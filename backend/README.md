# Saran Backend

Отдельный Node.js/Express API для проекта Saran. Реализует то, чего не было
в статическом фронтенде:

1. **Реальную регистрацию и вход пользователей** — email + пароль, пароли хранятся
   только как bcrypt-хеш, вход выдаёт короткоживущий access-токен (JWT) и
   refresh-токен (httpOnly cookie) с ротацией.
2. **Сохранение прогресса каждого пользователя на сервере** — XP, стрик, пройденные
   уроки, 14-дневная активность, анкета онбординга и настройки. Структура полей
   специально повторяет то, что раньше лежало в `localStorage` фронтенда
   (`saran_xp_total_v1`, `saran_streak_days_v1`, `saran_lessons_done_v1`,
   `saran_daily_activity_v1`, `saran_onboard_profile_v1` и т.д.), чтобы миграцию
   с локального хранения на серверное было легко сделать позже.

Плюс всё, что обычно требуется "боевому" бэкенду: подтверждение email,
восстановление пароля, ограничение частоты запросов, блокировка после
неудачных попыток входа, удаление аккаунта, простая админ-статистика,
Docker/PM2/nginx для запуска на VPS.

Бэкенд полностью независим от остального репозитория (не трогает `app/`,
`api/`, `scripts/`, ничего не ломает во фронтенде) — это отдельный сервис.

## Стек

| Слой | Технология |
|---|---|
| Сервер | Node.js 18+, Express |
| БД | SQLite (`better-sqlite3`) — один файл, без отдельного сервера БД |
| Пароли | bcryptjs |
| Токены | JWT (access, 15 мин) + случайный refresh-токен в httpOnly cookie (30 дней, с ротацией) |
| Валидация | zod |
| Почта | nodemailer (опционально; без SMTP ссылки просто пишутся в лог) |

## Структура

```
backend/
  src/
    config/env.js          # чтение и валидация переменных окружения
    db/                     # SQLite-подключение + миграции (SQL-файлы)
    middleware/             # auth, rate-limit, обработка ошибок
    modules/
      auth/                 # регистрация, вход, refresh, смена/сброс пароля
      users/                # репозиторий пользователей
      progress/             # get/save/merge прогресса
      admin/                # простая статистика для админа
    utils/                  # jwt, пароли, mailer, валидаторы
    app.js / server.js      # сборка Express-приложения и старт HTTP-сервера
  scripts/
    migrate.js              # прогнать миграции без старта сервера
    generate-secret.js      # сгенерировать случайные секреты для .env
    smoke-test.sh           # быстрая проверка живого API через curl
  test/                     # node:test юнит-тесты (пароли, jwt)
  Dockerfile, docker-compose.yml, ecosystem.config.js (PM2), nginx/*.conf.example
```

## Запуск локально (для проверки перед деплоем)

```bash
cd backend
npm install
cp .env.example .env
node scripts/generate-secret.js         # вставьте 2 значения в JWT_*_SECRET в .env
npm run migrate                         # создаст backend/data/saran.sqlite3
npm run dev                             # http://localhost:8010
```

Проверить, что всё работает:

```bash
BASE_URL=http://localhost:8010 bash scripts/smoke-test.sh
```

Юнит-тесты: `npm test`.

## Запуск на VPS

### Вариант А — PM2 (проще всего)

```bash
cd /path/to/backend
npm install --omit=dev
cp .env.example .env   # заполнить реальными значениями (см. ниже)
node scripts/generate-secret.js
npm run migrate
npm install -g pm2     # если ещё не установлен
pm2 start ecosystem.config.js
pm2 save
pm2 startup            # автозапуск после реюута сервера
```

### Вариант Б — Docker

```bash
cd /path/to/backend
cp .env.example .env    # заполнить
docker compose up -d --build
```

Данные (SQLite-файл) сохраняются в `./data` на хосте — не потеряются при
пересборке контейнера.

### Nginx + HTTPS

Пример конфига — `nginx/saran-backend.conf.example`. Он проксирует внешний
домен (например `api.saran-edu.ru`) на локальный порт бэкенда (`8010` по
умолчанию). После настройки домена выпустить сертификат:

```bash
certbot --nginx -d api.saran-edu.ru
```

### Подключение к текущему фронтенду (Vercel)

Сейчас `vercel.json` в корне репозитория уже проксирует `/api/web/*` и
`/api/podcast/*` на тот же VPS (`77.221.141.51:8000`). Когда вы поднимете
этот бэкенд и скажете мне домен/IP и порт, я добавлю туда же правила вида:

```json
{ "source": "/api/auth/:path*", "destination": "http://VPS_HOST:8010/api/auth/:path*" },
{ "source": "/api/progress/:path*", "destination": "http://VPS_HOST:8010/api/progress/:path*" }
```

и подключу фронтенд (`app/index.html`) к этому API вместо/вместе с
`localStorage` (регистрация/вход в UI, синхронизация прогресса).

## Переменные окружения

См. полный список с комментариями в `.env.example`. Главное, что понадобится
заполнить на VPS:

| Переменная | Назначение |
|---|---|
| `PORT` | порт, на котором слушает Node (по умолчанию 8010) |
| `PUBLIC_URL` | публичный URL API (для ссылки подтверждения email) |
| `FRONTEND_URL` | URL фронтенда (для ссылки сброса пароля — на фронте должна появиться страница `/reset-password`, принимающая `?token=` и вызывающая `POST /api/auth/reset-password`) |
| `CORS_ORIGIN` | домены фронтенда, которым разрешено ходить в API |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | секреты подписи токенов — `node scripts/generate-secret.js` |
| `COOKIE_DOMAIN`, `COOKIE_SECURE` | параметры cookie для refresh-токена |
| `DATABASE_PATH` | путь к файлу SQLite |
| `SMTP_*`, `MAIL_FROM` | почта для писем подтверждения/сброса пароля (опционально) |
| `ADMIN_TOKEN` | токен для `/api/admin/*` |

## API

Базовый префикс: `/api`. Формат тела запросов/ответов — JSON.
Access-токен передаётся в заголовке `Authorization: Bearer <token>`.
Refresh-токен сервер сам ставит в httpOnly cookie — руками его передавать не нужно.

### Аутентификация

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/register` | `{ email, password, displayName? }` → создаёт пользователя, возвращает `{ user, accessToken }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ user, accessToken }` |
| POST | `/api/auth/refresh` | по refresh-cookie выдаёт новую пару токенов |
| POST | `/api/auth/logout` | отзывает текущий refresh-токен |
| POST | `/api/auth/logout-all` 🔒 | отзывает все refresh-токены пользователя (выход со всех устройств) |
| GET | `/api/auth/me` 🔒 | текущий пользователь |
| POST | `/api/auth/change-password` 🔒 | `{ currentPassword, newPassword }` |
| POST | `/api/auth/forgot-password` | `{ email }` → отправляет письмо со ссылкой сброса (или пишет в лог, если SMTP не настроен) |
| POST | `/api/auth/reset-password` | `{ token, newPassword }` |
| GET | `/api/auth/verify-email?token=...` | подтверждение почты по ссылке из письма |
| POST | `/api/auth/resend-verification` 🔒 | повторно отправить письмо подтверждения |
| DELETE | `/api/auth/account` 🔒 | удалить аккаунт и весь его прогресс |

🔒 — требует `Authorization: Bearer <accessToken>`.

### Прогресс

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/progress` 🔒 | вернуть текущий прогресс пользователя |
| PUT | `/api/progress` 🔒 | полностью перезаписать прогресс переданными полями (можно слать только изменившиеся) |
| POST | `/api/progress/merge` 🔒 | "умное" слияние — использовать один раз сразу после логина, чтобы перенести гостевой прогресс из localStorage на сервер без потери данных (берётся максимум по XP/стрику/задачам, объединяются карты уроков и активности) |

Тело для `PUT`/`POST /merge` (все поля опциональны):

```json
{
  "xpTotal": 120,
  "streakDays": 3,
  "tasksCorrect": 42,
  "lastActivityDate": "2026-07-27",
  "lessonsDone": { "module1_lesson2": true },
  "dailyActivity": { "2026-07-27": 5 },
  "onboardingDone": true,
  "onboardingProfile": { "goal": "people", "level": "l2" },
  "displayName": "Батор",
  "uiLang": "ru",
  "soundEnabled": true
}
```

Ответ во всех трёх случаях — `{ "progress": { ...то же самое плюс updatedAt... } }`.

### Служебные

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | проверка живости сервиса |
| GET | `/api/admin/stats` | требует заголовок `X-Admin-Token: <ADMIN_TOKEN>` — общее число пользователей |

## Модель данных (SQLite)

- `users` — email, хеш пароля, статус подтверждения email, счётчик неудачных
  попыток входа и блокировка (5 неудачных попыток → блокировка на 15 минут).
- `refresh_tokens` — хеши refresh-токенов с TTL, отзывом и ротацией (сам
  сырой токен на сервере никогда не хранится).
- `password_reset_tokens`, `email_verification_tokens` — одноразовые токены
  с TTL.
- `progress` — один ряд на пользователя с полями прогресса (см. выше).

## Безопасность из коробки

- Пароли — bcrypt (12 раундов), нигде не логируются.
- JWT-секреты обязательны в `production` (сервер не запустится с "пустыми" секретами).
- Refresh-токен — httpOnly, `Secure` (в проде), `SameSite=Lax`, хранится на
  сервере только как SHA-256 хеш, ротируется при каждом обновлении.
- Rate-limit на `/api/auth/*` (по умолчанию 20 запросов / 15 минут с одного IP).
- Блокировка аккаунта после 5 неверных попыток входа на 15 минут.
- `helmet` для HTTP-заголовков безопасности, строгий CORS по белому списку доменов.
- Email при `forgot-password` никогда не подсказывает, зарегистрирован ли он.

## Что нужно от вас после разворачивания на VPS

Пришлите, и я донастрою интеграцию с фронтендом и `vercel.json`:

1. Домен или `IP:порт`, на котором будет отвечать бэкенд (например `api.saran-edu.ru` или `77.221.141.51:8010`).
2. Настроен ли SMTP для писем (или пока оставляем ссылки в логах).
3. Какие домены фронтенда должны иметь доступ к API (для `CORS_ORIGIN`) — вероятно `https://saran-edu.ru` и `https://saran-edu.ru/app`.

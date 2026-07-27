-- Начальная схема базы данных Saran Backend.
-- Выполняется идемпотентно (IF NOT EXISTS), безопасно запускать повторно.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    email                  TEXT NOT NULL UNIQUE,
    password_hash          TEXT NOT NULL,
    display_name           TEXT,
    email_verified         INTEGER NOT NULL DEFAULT 0,
    failed_login_attempts  INTEGER NOT NULL DEFAULT 0,
    locked_until           TEXT,
    created_at             TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash         TEXT NOT NULL UNIQUE,
    expires_at         TEXT NOT NULL,
    revoked_at         TEXT,
    replaced_by_hash   TEXT,
    user_agent         TEXT,
    ip                 TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,
    expires_at    TEXT NOT NULL,
    used_at       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL UNIQUE,
    expires_at    TEXT NOT NULL,
    used_at       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Прогресс пользователя. Поля напрямую соответствуют тому, что раньше
-- лежало в localStorage фронтенда (saran_xp_total_v1, saran_streak_days_v1,
-- saran_lessons_done_v1, saran_daily_activity_v1, saran_onboard_profile_v1 и т.д.),
-- чтобы миграция с локального хранения на серверное была прямой.
CREATE TABLE IF NOT EXISTS progress (
    user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp_total            INTEGER NOT NULL DEFAULT 0,
    streak_days         INTEGER NOT NULL DEFAULT 0,
    tasks_correct       INTEGER NOT NULL DEFAULT 0,
    last_activity_date  TEXT,
    lessons_done        TEXT NOT NULL DEFAULT '{}',
    daily_activity      TEXT NOT NULL DEFAULT '{}',
    onboarding_done     INTEGER NOT NULL DEFAULT 0,
    onboarding_profile  TEXT NOT NULL DEFAULT '{}',
    display_name        TEXT,
    ui_lang             TEXT,
    sound_enabled       INTEGER NOT NULL DEFAULT 1,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

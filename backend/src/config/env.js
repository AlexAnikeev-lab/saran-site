'use strict';

require('dotenv').config();
const path = require('path');
const crypto = require('crypto');

function parseList(value, fallback) {
  if (!value || typeof value !== 'string' || value.trim() === '') return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true' || value === '1';
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// В production секреты обязательны. В development подставляем случайные,
// чтобы можно было запустить сервер локально без .env "из коробки".
function requireSecret(name) {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  if (isProd) {
    throw new Error(
      `[config] Переменная окружения ${name} не задана или слишком короткая. ` +
        `Сгенерируйте её командой: node scripts/generate-secret.js`
    );
  }
  // dev fallback — стабильный в рамках процесса, но не подходит для прода
  return crypto.createHash('sha256').update(name + '-dev-only').digest('hex');
}

const env = {
  NODE_ENV,
  isProd,
  PORT: parseInt(process.env.PORT || '8010', 10),
  PUBLIC_URL: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 8010}`,
  // URL фронтенда — используется для ссылок в письмах (сброс пароля и т.п.),
  // т.к. бэкенд обычно живёт на отдельном (под)домене от статического фронтенда.
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://saran-edu.ru',

  CORS_ORIGIN: parseList(process.env.CORS_ORIGIN, ['http://localhost:3000']),

  JWT_ACCESS_SECRET: requireSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireSecret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
  JWT_REFRESH_TTL_DAYS: parseInt(process.env.JWT_REFRESH_TTL_DAYS || '30', 10),

  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SECURE: parseBool(process.env.COOKIE_SECURE, isProd),

  DATABASE_PATH: path.resolve(
    __dirname,
    '..',
    '..',
    process.env.DATABASE_PATH || './data/saran.sqlite3'
  ),

  AUTH_RATE_LIMIT_WINDOW_MINUTES: parseInt(
    process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || '15',
    10
  ),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: parseBool(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'Saran <no-reply@saran-edu.ru>',

  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
};

module.exports = env;

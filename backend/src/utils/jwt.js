'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

/** Короткоживущий access-токен, отдаётся клиенту в теле ответа (Authorization: Bearer ...) */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

/**
 * Refresh-токен — случайная строка (не JWT), хранится у клиента в httpOnly cookie,
 * а на сервере хранится только её SHA-256 хеш (чтобы утечка БД не давала токены напрямую).
 */
function generateRefreshToken() {
  const raw = crypto.randomBytes(64).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  return { raw, hash, expiresAt };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Токены для верификации email / восстановления пароля — та же схема, но короче TTL. */
function generateOneTimeToken(ttlMinutes) {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  return { raw, hash, expiresAt };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  generateOneTimeToken,
  hashToken,
};

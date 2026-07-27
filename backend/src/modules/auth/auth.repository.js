'use strict';

const { getDb } = require('../../db');

function insertRefreshToken({ userId, tokenHash, expiresAt, userAgent, ip }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, tokenHash, expiresAt, userAgent || null, ip || null);
}

function findRefreshToken(tokenHash) {
  const db = getDb();
  return db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash);
}

function revokeRefreshToken(tokenHash, replacedByHash) {
  const db = getDb();
  db.prepare(
    `UPDATE refresh_tokens SET revoked_at = datetime('now'), replaced_by_hash = ? WHERE token_hash = ?`
  ).run(replacedByHash || null, tokenHash);
}

function revokeAllUserTokens(userId) {
  const db = getDb();
  db.prepare(
    `UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`
  ).run(userId);
}

function insertPasswordResetToken({ userId, tokenHash, expiresAt }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).run(userId, tokenHash, expiresAt);
}

function findPasswordResetToken(tokenHash) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?')
    .get(tokenHash);
}

function markPasswordResetUsed(tokenHash) {
  const db = getDb();
  db.prepare(
    `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token_hash = ?`
  ).run(tokenHash);
}

function insertEmailVerificationToken({ userId, tokenHash, expiresAt }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).run(userId, tokenHash, expiresAt);
}

function findEmailVerificationToken(tokenHash) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ?')
    .get(tokenHash);
}

function markEmailVerificationUsed(tokenHash) {
  const db = getDb();
  db.prepare(
    `UPDATE email_verification_tokens SET used_at = datetime('now') WHERE token_hash = ?`
  ).run(tokenHash);
}

module.exports = {
  insertRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  insertPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetUsed,
  insertEmailVerificationToken,
  findEmailVerificationToken,
  markEmailVerificationUsed,
};

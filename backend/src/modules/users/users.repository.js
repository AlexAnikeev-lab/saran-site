'use strict';

const { getDb } = require('../../db');

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    emailVerified: !!row.email_verified,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function findByEmail(email) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function create({ email, passwordHash, displayName }) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES (@email, @passwordHash, @displayName)`
  );
  const info = insert.run({ email, passwordHash, displayName: displayName || null });

  // Заводим пустую строку прогресса сразу при регистрации.
  db.prepare(
    `INSERT INTO progress (user_id, display_name) VALUES (?, ?)
     ON CONFLICT(user_id) DO NOTHING`
  ).run(info.lastInsertRowid, displayName || null);

  return findById(info.lastInsertRowid);
}

function updatePasswordHash(userId, passwordHash) {
  const db = getDb();
  db.prepare(
    `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(passwordHash, userId);
}

function markLoginSuccess(userId) {
  const db = getDb();
  db.prepare(
    `UPDATE users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(userId);
}

function registerFailedLogin(userId, { maxAttempts, lockMinutes }) {
  const db = getDb();
  const user = findById(userId);
  if (!user) return;
  const attempts = (user.failed_login_attempts || 0) + 1;
  let lockedUntil = null;
  if (attempts >= maxAttempts) {
    lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString();
  }
  db.prepare(
    `UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(attempts, lockedUntil, userId);
}

function setEmailVerified(userId) {
  const db = getDb();
  db.prepare(
    `UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`
  ).run(userId);
}

function updateDisplayName(userId, displayName) {
  const db = getDb();
  db.prepare(
    `UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(displayName, userId);
}

function deleteUser(userId) {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(userId); // ON DELETE CASCADE подчистит остальное
}

function countAll() {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) as c FROM users').get().c;
}

module.exports = {
  toPublicUser,
  findByEmail,
  findById,
  create,
  updatePasswordHash,
  markLoginSuccess,
  registerFailedLogin,
  setEmailVerified,
  updateDisplayName,
  deleteUser,
  countAll,
};

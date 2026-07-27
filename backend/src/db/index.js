'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('../config/env');

let dbInstance = null;

function ensureDataDir() {
  const dir = path.dirname(env.DATABASE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runMigrations(db) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r) => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    });
    run();
    // eslint-disable-next-line no-console
    console.log(`[db] Применена миграция: ${file}`);
  }
}

function getDb() {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  dbInstance = new Database(env.DATABASE_PATH);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  runMigrations(dbInstance);

  return dbInstance;
}

module.exports = { getDb };

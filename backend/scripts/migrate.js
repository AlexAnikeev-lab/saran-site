'use strict';

// Отдельный запуск миграций: node scripts/migrate.js
// (server.js тоже запускает миграции сам при старте, этот скрипт полезен
// для CI/деплоя, когда нужно накатить схему без старта HTTP-сервера)
const { getDb } = require('../src/db');

const db = getDb();
console.log('[migrate] База данных готова:', db.name);
db.close();

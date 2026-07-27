'use strict';

const env = require('./config/env');
const { getDb } = require('./db');
const { createApp } = require('./app');

// Инициализируем БД и накатываем миграции при старте.
getDb();

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[saran-backend] Слушаю порт ${env.PORT} (${env.NODE_ENV})`);
  // eslint-disable-next-line no-console
  console.log(`[saran-backend] База данных: ${env.DATABASE_PATH}`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[saran-backend] Получен ${signal}, завершаю работу...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[saran-backend] Unhandled Rejection:', reason);
});

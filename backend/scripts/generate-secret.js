'use strict';

// Генератор случайных секретов для .env (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ADMIN_TOKEN).
// Запуск: node scripts/generate-secret.js [количество]
const crypto = require('crypto');

const count = parseInt(process.argv[2] || '2', 10);

console.log('Скопируйте нужные значения в .env:\n');
for (let i = 0; i < count; i += 1) {
  console.log(crypto.randomBytes(48).toString('hex'));
}

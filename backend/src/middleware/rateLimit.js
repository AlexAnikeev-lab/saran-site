'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Ограничение на регистрацию/логин/восстановление пароля — защита от брутфорса.
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Слишком много попыток, попробуйте позже' },
});

// Более мягкий общий лимит на остальные API-запросы.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Слишком много запросов, попробуйте позже' },
});

module.exports = { authLimiter, apiLimiter };

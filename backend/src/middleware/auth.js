'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { Errors } = require('../utils/httpError');
const usersRepo = require('../modules/users/users.repository');

/** Требует валидный access-токен в заголовке Authorization: Bearer <token>. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(Errors.unauthorized('no_token', 'Отсутствует токен авторизации'));
  }

  try {
    const payload = verifyAccessToken(token);
    const user = usersRepo.findById(payload.sub);
    if (!user) {
      return next(Errors.unauthorized('user_not_found', 'Пользователь не найден'));
    }
    req.user = user;
    return next();
  } catch (e) {
    return next(Errors.unauthorized('invalid_token', 'Недействительный или просроченный токен'));
  }
}

function requireAdmin(req, res, next) {
  const env = require('../config/env');
  const token = req.headers['x-admin-token'];
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return next(Errors.forbidden('admin_only', 'Требуется административный токен'));
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };

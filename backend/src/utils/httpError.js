'use strict';

class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message || code);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const Errors = {
  badRequest: (code, message, details) => new HttpError(400, code, message, details),
  unauthorized: (code = 'unauthorized', message = 'Требуется авторизация') =>
    new HttpError(401, code, message),
  forbidden: (code = 'forbidden', message = 'Доступ запрещён') =>
    new HttpError(403, code, message),
  notFound: (code = 'not_found', message = 'Не найдено') => new HttpError(404, code, message),
  conflict: (code, message) => new HttpError(409, code, message),
  tooMany: (message = 'Слишком много попыток, попробуйте позже') =>
    new HttpError(429, 'too_many_requests', message),
  internal: (message = 'Внутренняя ошибка сервера') =>
    new HttpError(500, 'internal_error', message),
};

module.exports = { HttpError, Errors };

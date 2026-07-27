'use strict';

const { HttpError } = require('../utils/httpError');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isHttpError = err instanceof HttpError;
  const statusCode = err.statusCode || (isHttpError ? err.statusCode : 500);

  if (!statusCode || statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(statusCode || 500).json({
    error: err.code || 'internal_error',
    message: statusCode && statusCode < 500 ? err.message : 'Внутренняя ошибка сервера',
    details: err.details,
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

module.exports = { errorHandler };

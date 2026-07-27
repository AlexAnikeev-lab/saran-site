'use strict';

// Оборачивает async-контроллер, чтобы ошибки уходили в централизованный errorHandler.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };

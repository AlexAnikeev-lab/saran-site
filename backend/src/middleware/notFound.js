'use strict';

function notFound(req, res) {
  res.status(404).json({ error: 'not_found', message: 'Эндпоинт не найден' });
}

module.exports = { notFound };

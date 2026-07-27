'use strict';

const express = require('express');
const { requireAdmin } = require('../../middleware/auth');
const usersRepo = require('../users/users.repository');
const { asyncHandler } = require('../../utils/asyncHandler');

const router = express.Router();
router.use(requireAdmin);

// Простая статистика — сколько всего пользователей зарегистрировано.
// Защищено заголовком X-Admin-Token (см. .env -> ADMIN_TOKEN).
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    res.json({
      totalUsers: usersRepo.countAll(),
      serverTime: new Date().toISOString(),
    });
  })
);

module.exports = router;

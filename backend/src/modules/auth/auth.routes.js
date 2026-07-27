'use strict';

const express = require('express');
const ctrl = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// --- Публичные ---
router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.post('/reset-password', authLimiter, ctrl.resetPassword);
router.get('/verify-email', ctrl.verifyEmail);

// --- Требуют авторизации ---
router.get('/me', requireAuth, ctrl.me);
router.post('/logout-all', requireAuth, ctrl.logoutAll);
router.post('/change-password', requireAuth, ctrl.changePassword);
router.post('/resend-verification', requireAuth, ctrl.resendVerification);
router.delete('/account', requireAuth, ctrl.deleteAccount);

module.exports = router;

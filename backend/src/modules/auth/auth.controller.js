'use strict';

const authService = require('./auth.service');
const usersRepo = require('../users/users.repository');
const { asyncHandler } = require('../../utils/asyncHandler');
const {
  validate,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} = require('../../utils/validators');
const env = require('../../config/env');

const REFRESH_COOKIE_NAME = 'saran_refresh_token';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: '/api/auth',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
}

function meta(req) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

const register = asyncHandler(async (req, res) => {
  const data = validate(registerSchema, req.body);
  const result = await authService.register(data, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
});

const login = asyncHandler(async (req, res) => {
  const data = validate(loginSchema, req.body);
  const result = await authService.login(data, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
});

const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const result = await authService.refresh(rawToken, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
});

const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: usersRepo.toPublicUser(req.user) });
});

const changePassword = asyncHandler(async (req, res) => {
  const data = validate(changePasswordSchema, req.body);
  await authService.changePassword(req.user.id, data.currentPassword, data.newPassword);
  clearRefreshCookie(res);
  res.json({ ok: true, message: 'Пароль изменён, войдите заново' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const data = validate(forgotPasswordSchema, req.body);
  await authService.forgotPassword(data.email);
  // Всегда одинаковый ответ, чтобы не раскрывать, какие email зарегистрированы.
  res.json({ ok: true, message: 'Если такой email зарегистрирован, письмо отправлено' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const data = validate(resetPasswordSchema, req.body);
  await authService.resetPassword(data.token, data.newPassword);
  res.json({ ok: true, message: 'Пароль успешно изменён' });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const data = validate(verifyEmailSchema, { token: req.query.token });
  await authService.verifyEmail(data.token);
  res.json({ ok: true, message: 'Email подтверждён' });
});

const resendVerification = asyncHandler(async (req, res) => {
  await authService.issueEmailVerification(req.user);
  res.json({ ok: true, message: 'Письмо отправлено, если почта настроена на сервере' });
});

const deleteAccount = asyncHandler(async (req, res) => {
  usersRepo.deleteUser(req.user.id);
  clearRefreshCookie(res);
  res.json({ ok: true, message: 'Аккаунт и все данные удалены' });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  deleteAccount,
  REFRESH_COOKIE_NAME,
};

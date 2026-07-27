'use strict';

const env = require('../../config/env');
const usersRepo = require('../users/users.repository');
const authRepo = require('./auth.repository');
const { hashPassword, verifyPassword } = require('../../utils/password');
const {
  signAccessToken,
  generateRefreshToken,
  generateOneTimeToken,
  hashToken,
} = require('../../utils/jwt');
const { Errors } = require('../../utils/httpError');
const { sendMail } = require('../../utils/mailer');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

async function register({ email, password, displayName }, meta) {
  const existing = usersRepo.findByEmail(email);
  if (existing) {
    throw Errors.conflict('email_taken', 'Пользователь с таким email уже зарегистрирован');
  }

  const passwordHash = await hashPassword(password);
  const user = usersRepo.create({ email, passwordHash, displayName });

  const tokens = await issueTokenPair(user, meta);

  // Письмо подтверждения email — best effort, не блокирует регистрацию.
  issueEmailVerification(user).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[auth] Не удалось отправить письмо подтверждения:', e.message);
  });

  return { user: usersRepo.toPublicUser(user), ...tokens };
}

async function login({ email, password }, meta) {
  const user = usersRepo.findByEmail(email);
  if (!user) {
    throw Errors.unauthorized('invalid_credentials', 'Неверный email или пароль');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw Errors.tooMany(
      `Аккаунт временно заблокирован после нескольких неудачных попыток входа. Повторите позже.`
    );
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    usersRepo.registerFailedLogin(user.id, {
      maxAttempts: MAX_FAILED_ATTEMPTS,
      lockMinutes: LOCK_MINUTES,
    });
    throw Errors.unauthorized('invalid_credentials', 'Неверный email или пароль');
  }

  usersRepo.markLoginSuccess(user.id);
  const tokens = await issueTokenPair(user, meta);
  return { user: usersRepo.toPublicUser(user), ...tokens };
}

async function issueTokenPair(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const refresh = generateRefreshToken();

  authRepo.insertRefreshToken({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: refresh.expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  return { accessToken, refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt };
}

async function refresh(rawRefreshToken, meta) {
  if (!rawRefreshToken) {
    throw Errors.unauthorized('no_refresh_token', 'Отсутствует refresh-токен');
  }
  const tokenHash = hashToken(rawRefreshToken);
  const record = authRepo.findRefreshToken(tokenHash);

  if (!record || record.revoked_at || new Date(record.expires_at) < new Date()) {
    throw Errors.unauthorized('invalid_refresh_token', 'Недействительный refresh-токен');
  }

  const user = usersRepo.findById(record.user_id);
  if (!user) {
    throw Errors.unauthorized('user_not_found', 'Пользователь не найден');
  }

  // Ротация: старый токен помечаем использованным, выдаём новую пару.
  const tokens = await issueTokenPair(user, meta);
  const newHash = hashToken(tokens.refreshToken);
  authRepo.revokeRefreshToken(tokenHash, newHash);

  return { user: usersRepo.toPublicUser(user), ...tokens };
}

async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  authRepo.revokeRefreshToken(tokenHash, null);
}

async function logoutAll(userId) {
  authRepo.revokeAllUserTokens(userId);
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = usersRepo.findById(userId);
  if (!user) throw Errors.notFound('user_not_found');

  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) {
    throw Errors.unauthorized('invalid_credentials', 'Текущий пароль указан неверно');
  }
  const newHash = await hashPassword(newPassword);
  usersRepo.updatePasswordHash(userId, newHash);
  authRepo.revokeAllUserTokens(userId); // разлогиниваем все сессии кроме текущей на всякий случай
}

async function issueEmailVerification(user) {
  const { raw, hash, expiresAt } = generateOneTimeToken(60 * 24); // 24 часа
  authRepo.insertEmailVerificationToken({ userId: user.id, tokenHash: hash, expiresAt });

  const verifyUrl = `${env.PUBLIC_URL}/api/auth/verify-email?token=${raw}`;
  await sendMail({
    to: user.email,
    subject: 'Подтвердите email — Saran',
    text: `Подтвердите ваш email, перейдя по ссылке: ${verifyUrl}\nСсылка действует 24 часа.`,
    html: `<p>Подтвердите ваш email, перейдя по ссылке:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>Ссылка действует 24 часа.</p>`,
  });
}

async function verifyEmail(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = authRepo.findEmailVerificationToken(tokenHash);
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    throw Errors.badRequest('invalid_token', 'Ссылка подтверждения недействительна или устарела');
  }
  authRepo.markEmailVerificationUsed(tokenHash);
  usersRepo.setEmailVerified(record.user_id);
}

async function forgotPassword(email) {
  const user = usersRepo.findByEmail(email);
  // Не раскрываем, существует ли email — всегда отвечаем "ок" на уровне контроллера.
  if (!user) return;

  const { raw, hash, expiresAt } = generateOneTimeToken(60); // 1 час
  authRepo.insertPasswordResetToken({ userId: user.id, tokenHash: hash, expiresAt });

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${raw}`;
  await sendMail({
    to: user.email,
    subject: 'Восстановление пароля — Saran',
    text: `Для сброса пароля перейдите по ссылке: ${resetUrl}\nСсылка действует 1 час. Если вы не запрашивали сброс — просто игнорируйте это письмо.`,
    html: `<p>Для сброса пароля перейдите по ссылке:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Ссылка действует 1 час.</p>`,
  });
}

async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const record = authRepo.findPasswordResetToken(tokenHash);
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    throw Errors.badRequest('invalid_token', 'Ссылка сброса пароля недействительна или устарела');
  }
  const newHash = await hashPassword(newPassword);
  usersRepo.updatePasswordHash(record.user_id, newHash);
  authRepo.markPasswordResetUsed(tokenHash);
  authRepo.revokeAllUserTokens(record.user_id);
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  changePassword,
  issueEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
};

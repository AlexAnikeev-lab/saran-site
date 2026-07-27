'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
let smtpConfigured = false;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  smtpConfigured = true;
  return transporter;
}

/**
 * Отправляет письмо, если настроен SMTP (см. .env). Если SMTP не настроен —
 * не роняет запрос, а просто пишет ссылку/содержимое в лог сервера, чтобы
 * поток регистрации/восстановления пароля можно было использовать и тестировать
 * ещё до того, как на VPS будет настроена почта.
 */
async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.warn(
      `[mailer] SMTP не настроен — письмо для ${to} не отправлено. Тема: "${subject}".\n` +
        `[mailer] Содержимое:\n${text || html}`
    );
    return { delivered: false };
  }
  await t.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
  return { delivered: true };
}

module.exports = { sendMail, isConfigured: () => smtpConfigured };

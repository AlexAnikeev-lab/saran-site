'use strict';

const { z } = require('zod');

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Некорректный email');

const password = z
  .string()
  .min(8, 'Пароль должен быть не короче 8 символов')
  .max(128, 'Пароль слишком длинный');

const displayName = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .optional();

const registerSchema = z.object({
  email,
  password,
  displayName: displayName.optional(),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Введите пароль'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

const forgotPasswordSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: password,
});

const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

// Прогресс: структура повторяет данные, которые фронтенд ранее держал в localStorage.
const progressSchema = z.object({
  xpTotal: z.number().int().min(0).max(10_000_000).optional(),
  streakDays: z.number().int().min(0).max(100_000).optional(),
  tasksCorrect: z.number().int().min(0).max(10_000_000).optional(),
  lastActivityDate: z.string().max(20).optional().nullable(),
  lessonsDone: z.record(z.any()).optional(),
  dailyActivity: z.record(z.number()).optional(),
  onboardingDone: z.boolean().optional(),
  onboardingProfile: z.record(z.any()).optional(),
  displayName: z.string().trim().max(40).optional().nullable(),
  uiLang: z.string().max(10).optional().nullable(),
  soundEnabled: z.boolean().optional(),
});

function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    const err = new Error('validation_error');
    err.statusCode = 400;
    err.code = 'validation_error';
    err.details = details;
    throw err;
  }
  return result.data;
}

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  progressSchema,
  validate,
};

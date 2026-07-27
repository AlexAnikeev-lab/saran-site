'use strict';

const repo = require('./progress.repository');

function getProgress(userId) {
  repo.ensureRow(userId);
  return repo.toPublicProgress(repo.findByUserId(userId));
}

/** Полная перезапись (используется для обычного периодического сохранения с клиента). */
function saveProgress(userId, incoming) {
  const updated = repo.replace(userId, incoming);
  return repo.toPublicProgress(updated);
}

/**
 * "Умное" слияние — используется один раз сразу после входа/регистрации,
 * когда у пользователя уже накопился гостевой прогресс в localStorage,
 * а на сервере может быть свой (с другого устройства) или пустой прогресс.
 * Правило: по числовым метрикам берём максимум, по картам — объединяем
 * (для lessonsDone — "пройдено" побеждает; для dailyActivity — максимум за день),
 * профиль/настройки — предпочитаем непустые локальные, если на сервере ещё нет.
 */
function mergeProgress(userId, local) {
  repo.ensureRow(userId);
  const serverRow = repo.findByUserId(userId);
  const server = repo.toPublicProgress(serverRow);

  const mergedLessonsDone = { ...(server.lessonsDone || {}), ...(local.lessonsDone || {}) };

  const mergedDailyActivity = mergeDailyActivity(server.dailyActivity, local.dailyActivity);

  const merged = {
    xpTotal: Math.max(server.xpTotal || 0, local.xpTotal || 0),
    streakDays: Math.max(server.streakDays || 0, local.streakDays || 0),
    tasksCorrect: Math.max(server.tasksCorrect || 0, local.tasksCorrect || 0),
    lastActivityDate: pickLatestDate(server.lastActivityDate, local.lastActivityDate),
    lessonsDone: mergedLessonsDone,
    dailyActivity: mergedDailyActivity,
    onboardingDone: Boolean(server.onboardingDone || local.onboardingDone),
    onboardingProfile:
      Object.keys(server.onboardingProfile || {}).length > 0
        ? server.onboardingProfile
        : local.onboardingProfile || {},
    displayName: server.displayName || local.displayName || null,
    uiLang: server.uiLang || local.uiLang || null,
    soundEnabled:
      typeof server.soundEnabled === 'boolean' ? server.soundEnabled : !!local.soundEnabled,
  };

  const updated = repo.replace(userId, merged);
  return repo.toPublicProgress(updated);
}

/**
 * Значение за один день бывает либо числом, либо объектом вида { t: задачи, l: уроки }
 * (именно так хранит фронтенд в saran_daily_activity_v1). Сливаем по максимуму на
 * каждом уровне, чтобы данные с разных устройств не перетирали друг друга.
 */
function mergeDailyActivity(serverMap, localMap) {
  const merged = { ...(serverMap || {}) };
  for (const [date, localVal] of Object.entries(localMap || {})) {
    const serverVal = merged[date];
    if (typeof localVal === 'number' || typeof serverVal === 'number' || serverVal === undefined) {
      const a = typeof serverVal === 'number' ? serverVal : 0;
      const b = typeof localVal === 'number' ? localVal : 0;
      merged[date] =
        typeof localVal === 'object' && localVal !== null
          ? mergeDayCell(serverVal, localVal)
          : Math.max(a, b);
    } else {
      merged[date] = mergeDayCell(serverVal, localVal);
    }
  }
  return merged;
}

function mergeDayCell(serverCell, localCell) {
  const s = serverCell && typeof serverCell === 'object' ? serverCell : {};
  const l = localCell && typeof localCell === 'object' ? localCell : {};
  const keys = new Set([...Object.keys(s), ...Object.keys(l)]);
  const out = {};
  for (const k of keys) {
    out[k] = Math.max(Number(s[k]) || 0, Number(l[k]) || 0);
  }
  return out;
}

function pickLatestDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

module.exports = { getProgress, saveProgress, mergeProgress };

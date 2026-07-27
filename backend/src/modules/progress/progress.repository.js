'use strict';

const { getDb } = require('../../db');

function safeParseJson(str, fallback) {
  if (typeof str !== 'string') return fallback;
  try {
    const v = JSON.parse(str);
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

function toPublicProgress(row) {
  if (!row) return null;
  return {
    xpTotal: row.xp_total,
    streakDays: row.streak_days,
    tasksCorrect: row.tasks_correct,
    lastActivityDate: row.last_activity_date,
    lessonsDone: safeParseJson(row.lessons_done, {}),
    dailyActivity: safeParseJson(row.daily_activity, {}),
    onboardingDone: !!row.onboarding_done,
    onboardingProfile: safeParseJson(row.onboarding_profile, {}),
    displayName: row.display_name,
    uiLang: row.ui_lang,
    soundEnabled: !!row.sound_enabled,
    updatedAt: row.updated_at,
  };
}

function findByUserId(userId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM progress WHERE user_id = ?').get(userId);
  return row || null;
}

function ensureRow(userId) {
  const db = getDb();
  db.prepare(
    `INSERT INTO progress (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING`
  ).run(userId);
}

/** Полная перезапись прогресса (клиент присылает свою полную актуальную версию). */
function replace(userId, data) {
  const db = getDb();
  ensureRow(userId);
  const current = findByUserId(userId);

  const next = {
    xp_total: data.xpTotal ?? current.xp_total,
    streak_days: data.streakDays ?? current.streak_days,
    tasks_correct: data.tasksCorrect ?? current.tasks_correct,
    last_activity_date:
      data.lastActivityDate !== undefined ? data.lastActivityDate : current.last_activity_date,
    lessons_done:
      data.lessonsDone !== undefined ? JSON.stringify(data.lessonsDone) : current.lessons_done,
    daily_activity:
      data.dailyActivity !== undefined
        ? JSON.stringify(data.dailyActivity)
        : current.daily_activity,
    onboarding_done:
      data.onboardingDone !== undefined ? (data.onboardingDone ? 1 : 0) : current.onboarding_done,
    onboarding_profile:
      data.onboardingProfile !== undefined
        ? JSON.stringify(data.onboardingProfile)
        : current.onboarding_profile,
    display_name: data.displayName !== undefined ? data.displayName : current.display_name,
    ui_lang: data.uiLang !== undefined ? data.uiLang : current.ui_lang,
    sound_enabled:
      data.soundEnabled !== undefined ? (data.soundEnabled ? 1 : 0) : current.sound_enabled,
  };

  db.prepare(
    `UPDATE progress SET
       xp_total = @xp_total,
       streak_days = @streak_days,
       tasks_correct = @tasks_correct,
       last_activity_date = @last_activity_date,
       lessons_done = @lessons_done,
       daily_activity = @daily_activity,
       onboarding_done = @onboarding_done,
       onboarding_profile = @onboarding_profile,
       display_name = @display_name,
       ui_lang = @ui_lang,
       sound_enabled = @sound_enabled,
       updated_at = datetime('now')
     WHERE user_id = @user_id`
  ).run({ ...next, user_id: userId });

  return findByUserId(userId);
}

function remove(userId) {
  const db = getDb();
  db.prepare('DELETE FROM progress WHERE user_id = ?').run(userId);
}

module.exports = { toPublicProgress, findByUserId, ensureRow, replace, remove };

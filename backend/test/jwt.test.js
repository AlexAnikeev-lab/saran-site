'use strict';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { signAccessToken, verifyAccessToken, generateRefreshToken } = require('../src/utils/jwt');

test('подписывает и проверяет access-токен', () => {
  const token = signAccessToken({ id: 42, email: 'a@b.com' });
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, 42);
  assert.equal(payload.email, 'a@b.com');
});

test('генерирует уникальные refresh-токены с хешем', () => {
  const a = generateRefreshToken();
  const b = generateRefreshToken();
  assert.notEqual(a.raw, b.raw);
  assert.notEqual(a.hash, b.hash);
  assert.equal(a.hash.length, 64); // sha256 hex
});

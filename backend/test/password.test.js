'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/utils/password');

test('хеширует пароль и подтверждает его же', async () => {
  const hash = await hashPassword('correctPassword123');
  assert.notEqual(hash, 'correctPassword123');
  assert.equal(await verifyPassword('correctPassword123', hash), true);
});

test('отвергает неверный пароль', async () => {
  const hash = await hashPassword('correctPassword123');
  assert.equal(await verifyPassword('wrongPassword', hash), false);
});

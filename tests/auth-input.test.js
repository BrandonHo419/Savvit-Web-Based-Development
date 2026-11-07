const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateLogin, validateRegistration } = require('../middleware/authInput');

function run(handler, body) {
  const result = { code: 200, allowed: false, status(code) { this.code = code; return this; }, send(message) { this.message = message; } };
  handler({ body }, result, () => { result.allowed = true; });
  return result;
}
const valid = { username: 'user', email: 'user@example.test', password: 'password' };

test('registration validates types, required fields and database lengths', () => {
  for (const body of [null, [], {}, { ...valid, username: {} }, { ...valid, username: ' ' },
    { ...valid, username: 'x'.repeat(101) }, { ...valid, email: [] },
    { ...valid, email: 'bad email' }, { ...valid, email: 'x'.repeat(250) + '@x.test' },
    { ...valid, password: 12345678 }, { ...valid, password: 'short' }]) {
    const result = run(validateRegistration, body);
    assert.equal(result.code, 400);
    assert.equal(result.allowed, false);
  }
  assert.equal(run(validateRegistration, { ...valid, username: 'x'.repeat(100) }).allowed, true);
});

test('new password byte limit prevents bcrypt truncation including Unicode', () => {
  for (const password of ['x'.repeat(72), 'é'.repeat(36), '😀'.repeat(18)]) {
    assert.equal(run(validateRegistration, { ...valid, password }).allowed, true);
    assert.equal(run(validateRegistration, { ...valid, password: password + 'x' }).code, 400);
  }
});

test('login preserves legacy short and long passwords without coercing objects', () => {
  for (const password of ['a', 'x'.repeat(100)]) assert.equal(run(validateLogin, { ...valid, password }).allowed, true);
  for (const body of [null, {}, { ...valid, email: [] }, { ...valid, password: {} }, { ...valid, password: '' }]) {
    assert.equal(run(validateLogin, body).code, 400);
  }
});

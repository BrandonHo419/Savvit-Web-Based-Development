const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { SESSION_LIFETIME_MS, sessionOptions, completeLogin, enforceSessionLifetime } = require('../middleware/sessionLifecycle');

function response() {
  return { code: 200, headers: {}, cookies: [], status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, set(name, value) { this.headers[name] = value; },
    clearCookie(name, options) { this.cookies.push({ name, options }); } };
}

test('startup rejects missing, empty and whitespace secrets before starting the app', () => {
  for (const value of [undefined, '', '   ']) {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.toUpperCase() === 'SESSION_SECRET') delete env[key];
    if (value === undefined) delete env.SESSION_SECRET;
    else env.SESSION_SECRET = value;
    // dotenv.config() does not read DOTENV_CONFIG_PATH; never load the developer's .env.
    const result = spawnSync(process.execPath, ['-e', "require('dotenv').config = () => ({ parsed: {} }); require('./app');"], { cwd: require('node:path').join(__dirname, '..'), env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SESSION_SECRET must be configured/);
  }
});

test('session configuration avoids untouched sessions and keeps secure cookie policy', () => {
  const secret = process.env.SESSION_SECRET, mode = process.env.NODE_ENV;
  try {
    process.env.SESSION_SECRET = 'test-only-secret';
    for (const production of [true, false]) {
      process.env.NODE_ENV = production ? 'production' : 'development';
      const options = sessionOptions();
      assert.equal(options.saveUninitialized, false);
      assert.equal(options.resave, false);
      assert.equal(options.cookie.maxAge, 28_800_000);
      assert.equal(options.cookie.secure, production);
      assert.equal(options.cookie.httpOnly, true);
      assert.equal(options.cookie.sameSite, 'strict');
    }
  } finally {
    if (secret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = secret;
    if (mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = mode;
  }
});

test('login persists deadline and CSRF token before reporting success', () => {
  let saved;
  const req = { session: { cookie: {}, save(callback) { saved = callback; } } };
  const res = response();
  const before = Date.now();
  completeLogin(req, res, { message: 'logged in', redirect: '/home.html' });
  assert.equal(res.body, undefined);
  assert.ok(req.session.expiresAt >= before + SESSION_LIFETIME_MS);
  assert.ok(req.session.expiresAt <= Date.now() + SESSION_LIFETIME_MS);
  assert.match(req.session.csrfToken, /^[a-f0-9]{64}$/);
  saved();
  assert.equal(res.body.csrfToken, req.session.csrfToken);
  assert.equal(res.body.redirect, '/home.html');
});

test('login save failure destroys partial session and does not return a success token', () => {
  let destroyed = false;
  const req = { session: { cookie: {}, save(callback) { callback(Error('save failed')); },
    destroy(callback) { destroyed = true; callback(); } } };
  const res = response();
  completeLogin(req, res, { message: 'logged in' });
  assert.equal(destroyed, true);
  assert.equal(res.code, 500);
  assert.equal(res.body.csrfToken, undefined);
  assert.equal(res.cookies.length, 1);
});

test('activity preserves absolute deadline and anonymous requests remain untouched', () => {
  const deadline = Date.now() + 60_000;
  const req = { session: { passport: { user: 1 }, expiresAt: deadline, cookie: {} } };
  let next = 0;
  for (let i = 0; i < 2; i++) enforceSessionLifetime(req, response(), () => next++);
  assert.equal(next, 2);
  assert.equal(req.session.expiresAt, deadline);
  assert.ok(req.session.cookie.maxAge <= 60_000);
  const anonymous = { session: { cookie: {} } };
  enforceSessionLifetime(anonymous, response(), () => next++);
  assert.deepEqual(anonymous.session, { cookie: {} });
});

for (const deadline of [undefined, 'invalid', 0, Date.now() - 1, Number.MAX_SAFE_INTEGER]) {
  test(`expired or invalid deadline (${deadline}) removes identity before continuing`, () => {
    for (const [method, path, allowed] of [['GET', '/landingpage.html', true], ['POST', '/users/login', true],
      ['POST', '/users/signup', true], ['DELETE', '/pins/1', false]]) {
      let regenerated = false, continued = false;
      const req = { method, path, session: { passport: { user: 1 }, expiresAt: deadline,
        regenerate(callback) { regenerated = true; req.session = { cookie: {} }; callback(); } } };
      const res = response();
      enforceSessionLifetime(req, res, () => { continued = true; });
      assert.equal(regenerated, true);
      assert.equal(continued, allowed);
      assert.equal(req.session.passport, undefined);
      assert.equal(res.cookies.length, 1);
      if (!allowed) assert.equal(res.code, 401);
    }
  });
}

test('expiry store failure denies the request without clearing the cookie or continuing', () => {
  const req = { session: { passport: { user: 1 }, expiresAt: 0, regenerate(callback) { callback(Error('store failed')); } } };
  const res = response();
  enforceSessionLifetime(req, res, () => assert.fail('must not continue'));
  assert.equal(res.code, 500);
  assert.equal(res.cookies.length, 0);
});

test('server deadline denies a still-stored session even when its cookie expires later', async () => {
  const express = require('express');
  const session = require('express-session');
  const store = new session.MemoryStore();
  const app = express();
  app.use(session({ secret: 'isolated-test-secret', store, resave: false, saveUninitialized: false }));
  app.use(enforceSessionLifetime);
  let sessionId;
  app.post('/test-login', (req, res) => {
    sessionId = req.sessionID;
    req.session.passport = { user: 1 };
    completeLogin(req, res, { message: 'test login' });
  });
  app.get('/protected', (req, res) => res.sendStatus(req.session.passport?.user ? 200 : 401));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${baseUrl}/test-login`, { method: 'POST' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const data = await new Promise((resolve, reject) => store.get(sessionId, (error, value) => error ? reject(error) : resolve(value)));
    data.expiresAt = Date.now() - 1;
    data.cookie.expires = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
    await new Promise((resolve, reject) => store.set(sessionId, data, error => error ? reject(error) : resolve()));
    const denied = await fetch(`${baseUrl}/protected`, { headers: { Cookie: cookie } });
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('set-cookie'), /connect.sid=;/);
    assert.equal(await new Promise(resolve => store.get(sessionId, (error, value) => resolve(value))), undefined);
    assert.equal((await fetch(`${baseUrl}/protected`, { headers: { Cookie: cookie } })).status, 401);
  } finally {
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
});

test('startup secret test remains isolated even beside a valid local .env', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'savvit-startup-'));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'SESSION_SECRET') delete env[key];
  const dotenvPath = JSON.stringify(require.resolve('dotenv'));
  const appPath = JSON.stringify(path.join(__dirname, '../app.js'));
  try {
    fs.writeFileSync(path.join(directory, '.env'), 'SESSION_SECRET=disposable-test-fixture-only\n');
    const original = spawnSync(process.execPath, ['-e', `require(${appPath})`], { cwd: directory, env, encoding: 'utf8' });
    assert.equal(original.status, 0, 'reproduce valid .env making the original test pass startup');
    const isolated = spawnSync(process.execPath, ['-e', `require(${dotenvPath}).config = () => ({ parsed: {} }); require(${appPath});`], { cwd: directory, env, encoding: 'utf8' });
    assert.notEqual(isolated.status, 0);
    assert.match(isolated.stderr, /SESSION_SECRET must be configured/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

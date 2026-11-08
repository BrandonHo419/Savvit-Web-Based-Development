const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuthThrottle, ipKey } = require('../middleware/authThrottle');
const { createPasswordWork, PasswordBusyError, passwordWorkError } = require('../middleware/passwordWork');

function hit(handler, address = '192.0.2.1') {
  const res = { code: 200, headers: {}, allowed: false,
    set(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; }, send(body) { this.body = body; } };
  handler({ socket: { remoteAddress: address } }, res, () => { res.allowed = true; });
  return res;
}

test('IP keys normalize mapped IPv4 and equivalent IPv6, grouping /56 only', () => {
  assert.equal(ipKey('::ffff:192.0.2.1'), ipKey('192.0.2.1'));
  assert.equal(ipKey('::ffff:c000:201'), ipKey('192.0.2.1'));
  assert.equal(ipKey('2001:db8:abcd:1201::1'), ipKey('2001:0DB8:abcd:12ff:0:0:0:ffff'));
  assert.notEqual(ipKey('2001:db8:abcd:1201::1'), ipKey('2001:db8:abcd:1301::1'));
  assert.equal(ipKey('fe80::1%eth0'), ipKey('fe80::1'));
  assert.equal(ipKey('::1'), ipKey('0:0:0:0:0:0:0:1'));
  for (const bad of [undefined, '', 'garbage', '192.0.2.1:1234']) assert.equal(ipKey(bad), 'unknown');
});

for (const [name, limit, windowMs] of [['login', 30, 900000], ['signup', 5, 3600000], ['csrf', 60, 900000]]) {
  test(`${name} admits exact quota and resets at the original deadline without extending it`, () => {
    let time = 0;
    const handler = createAuthThrottle({ now: () => time }).middleware(name);
    for (let i = 0; i < limit; i++) assert.equal(hit(handler).allowed, true);
    const denied = hit(handler);
    assert.equal(denied.code, 429);
    assert.equal(denied.headers['Retry-After'], String(windowMs / 1000));
    assert.equal(denied.headers['Cache-Control'], 'private, no-store');
    time = windowMs - 1;
    assert.equal(hit(handler).headers['Retry-After'], '1');
    time = windowMs;
    assert.equal(hit(handler).allowed, true);
  });
}

test('endpoint and network keys are isolated; forwarded identities are not used', () => {
  const limiter = createAuthThrottle();
  const signup = limiter.middleware('signup');
  for (let i = 0; i < 5; i++) hit(signup);
  assert.equal(hit(signup).code, 429);
  assert.equal(hit(signup, '192.0.2.2').allowed, true);
  assert.equal(hit(limiter.middleware('login')).allowed, true);
  assert.equal(hit(signup, '::ffff:192.0.2.1').code, 429);
});

test('bounded maps fail closed for new keys, retain active limits, and reclaim expired keys', () => {
  let time = 0;
  const limiter = createAuthThrottle({ now: () => time, maxKeys: 1 });
  const signup = limiter.middleware('signup');
  for (let i = 0; i < 5; i++) hit(signup);
  assert.equal(hit(signup, '192.0.2.2').code, 503);
  assert.equal(hit(signup).code, 429);
  time = 3600000;
  assert.equal(hit(signup, '192.0.2.2').allowed, true);
  time += 3600000;
  limiter.sweep();
  assert.equal(hit(signup).allowed, true);
});

test('global gate spans endpoints and addresses and resets after one minute', () => {
  let time = 0;
  const limiter = createAuthThrottle({ now: () => time });
  for (let i = 0; i < 300; i++) {
    assert.equal(hit(limiter.middleware(['login', 'signup', 'csrf'][i % 3]), `192.0.${Math.floor(i / 250)}.${i % 250 + 1}`).allowed, true);
  }
  assert.equal(hit(limiter.middleware('csrf'), '198.51.100.1').code, 429);
  time = 60000;
  assert.equal(hit(limiter.middleware('csrf'), '198.51.100.1').allowed, true);
});

test('bcrypt work has four slots, no queue, and releases on success and both error forms', async () => {
  const work = createPasswordWork();
  const releases = [];
  const jobs = Array.from({ length: 4 }, () => work(() => new Promise(resolve => releases.push(resolve))));
  let called = false;
  await assert.rejects(work(() => { called = true; }), PasswordBusyError);
  assert.equal(called, false);
  releases.forEach(resolve => resolve('ok'));
  assert.deepEqual(await Promise.all(jobs), ['ok', 'ok', 'ok', 'ok']);
  await assert.rejects(work(() => { throw Error('sync'); }), /sync/);
  await assert.rejects(work(() => Promise.reject(Error('async'))), /async/);
  assert.equal(await work(() => 42), 42);
  const response = hit((req, res, next) => passwordWorkError(new PasswordBusyError(), req, res, next));
  assert.equal(response.code, 503);
  assert.equal(response.headers['Retry-After'], '5');
});

test('HTTP gate matches case, trailing slash and HEAD before parser/session/work; spoofed forwarding fails', async t => {
  const app = express();
  const limiter = createAuthThrottle();
  limiter.mount(app);
  let downstream = 0;
  app.use(express.json());
  app.use((req, res) => { downstream++; res.set('Set-Cookie', 'test=value'); res.sendStatus(204); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const requests = await Promise.all(Array.from({ length: 35 }, (_, i) => fetch(base + (i % 2 ? '/USERS/LOGIN/' : '/users/login'), {
    method: 'POST', headers: { 'X-Forwarded-For': `192.0.2.${i + 1}`, Forwarded: `for=192.0.2.${i + 1}` }
  })));
  assert.equal(requests.filter(r => r.status === 204).length, 30);
  assert.equal(requests.filter(r => r.status === 429).length, 5);
  const response = await fetch(base + '/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(downstream, 30);
  for (let i = 0; i < 60; i++) assert.equal((await fetch(base + '/USERS/CSRF/', { method: i % 2 ? 'HEAD' : 'GET' })).status, 204);
  assert.equal((await fetch(base + '/users/csrf', { method: 'HEAD' })).status, 429);
});

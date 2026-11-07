const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ signedIn = true, status = 200, failSession = false, pending = false } = {}) {
  let ready, resolveRequest;
  const calls = [];
  const elements = new Map();
  function get(id) {
    if (!elements.has(id)) elements.set(id, { value: id, style: {}, dataset: {}, innerText: '', events: {}, resets: 0,
      button: { disabled: false }, addEventListener(type, fn) { this.events[type] = fn; },
      reset() { this.resets++; }, querySelector() { return this.button; } });
    return elements.get(id);
  }
  const window = { location: { href: '' } };
  const context = vm.createContext({ window,
    document: { addEventListener: (type, fn) => { ready = fn; }, getElementById: get, querySelector: get },
    XMLHttpRequest: class { open() {} send() {} },
    getSession: async options => {
      calls.push({ type: 'session', refresh: options.refresh });
      if (failSession) throw Error('Session unavailable');
      return signedIn ? { csrfToken: 'current' } : null;
    },
    apiFetch: async (url, options) => {
      calls.push({ type: 'mutation', url, options });
      const response = { ok: status === 200, status, text: async () => 'Action rejected' };
      if (pending) return new Promise(resolve => { resolveRequest = () => resolve(response); });
      return response;
    }
  });
  const source = fs.readFileSync(path.join(__dirname, '../public/js/admin.js'), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source, context);
  ready();
  return { get, calls, window, finish: () => resolveRequest(),
    submit: id => get(id).events.submit({ preventDefault() {} }) };
}

for (const [form, message, endpoint] of [
  ['singleUserFormAdd', 'error-message', '/users/admin_add_user'],
  ['singleUserFormDel', 'del-message', '/users/admin_del_user']
]) {
  test(`${endpoint} refreshes the session and prevents duplicate requests`, async () => {
    const view = setup({ pending: true });
    const request = view.submit(form);
    await new Promise(resolve => setImmediate(resolve));
    await view.submit(form);
    assert.equal(view.calls.length, 2);
    assert.deepEqual(view.calls[0], { type: 'session', refresh: true });
    assert.equal(view.calls[1].url, endpoint);
    assert.equal(view.calls[1].options.method, 'POST');
    assert.equal(view.get(form).button.disabled, true);
    view.finish();
    await request;
    assert.equal(view.get(form).resets, 1);
    assert.equal(view.get(form).button.disabled, false);
  });

  test(`${endpoint} reports failure without retry or resetting input`, async () => {
    const view = setup({ status: 403 });
    await view.submit(form);
    assert.equal(view.calls.filter(call => call.type === 'mutation').length, 1);
    assert.equal(view.get(form).resets, 0);
    assert.equal(view.get(message).innerText, 'Action rejected');
    assert.equal(view.get(form).button.disabled, false);
  });

  test(`${endpoint} handles missing sessions and recoverable profile errors`, async () => {
    const anonymous = setup({ signedIn: false });
    await anonymous.submit(form);
    assert.equal(anonymous.window.location.href, '/login.html');
    assert.equal(anonymous.calls.length, 1);
    const failed = setup({ failSession: true });
    await failed.submit(form);
    assert.equal(failed.calls.length, 1);
    assert.equal(failed.get(message).innerText, 'Session unavailable');
    assert.equal(failed.get(form).button.disabled, false);
  });
}

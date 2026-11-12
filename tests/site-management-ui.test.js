const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function setup(role = 'owner') {
  const nodes = new Map();
  function get(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false, hidden: true, textContent: '', events: {}, addEventListener(type, fn) { this.events[type] = fn; } });
    return nodes.get(id);
  }
  get('account-access-form').elements = ['account-id','account-role','account-title'].map(get);
  get('account-id').value = '2'; get('account-role').value = 'admin'; get('account-title').value = 'Co-founder';
  const calls = [];
  let response = async () => ({ ok: true }), refreshes = 0;
  const ctx = vm.createContext({ document: { getElementById: get }, window: { confirm: () => true },
    getSession: async () => ({ role }),
    apiFetch: async (url, options) => {
      calls.push({ url, options });
      if (!options) return { ok: true, json: async () => ({ accounts: 2, boards: 0, originals: 0, saved_references: 0, comments: 0, replies: 0 }) };
      return response();
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/js/site-management.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function'),ctx);
  ctx.setupSiteManagement({ role }, () => refreshes++);
  await new Promise(resolve => setImmediate(resolve));
  return { get, calls, get refreshes() { return refreshes; }, respond(fn) { response = fn; }, submit: () => get('account-access-form').events.submit({ preventDefault() {} }) };
}
test('admins see statistics but cannot use owner controls', async () => {
  const ui = await setup('admin');
  assert.equal(ui.get('owner-controls').hidden, true);
  assert.equal(ui.get('account-access-form').events.submit, undefined);
  assert.match(ui.get('site-statistics').textContent, /2 accounts/);
});
test('owner updates prevent duplicates, retain failed selections and refresh after success', async () => {
  const ui = await setup();
  let finish;
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = ui.submit(); await new Promise(resolve => setImmediate(resolve)); await ui.submit();
  assert.equal(ui.calls.filter(c => c.options).length, 1);
  assert.deepEqual(JSON.parse(ui.calls.at(-1).options.body), { role: 'admin', team_title: 'Co-founder' });
  finish({ ok: false }); await pending;
  assert.match(ui.get('account-access-status').textContent, /Unable/);
  assert.equal(ui.get('account-role').value, 'admin');
  assert.equal(ui.get('account-role').disabled, false);
  ui.respond(async () => ({ ok: true })); await ui.submit();
  assert.equal(ui.refreshes, 1);
  assert.match(ui.get('account-access-status').textContent, /updated/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function editor(owner = true) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', disabled: false });
    return nodes.get(id);
  };
  node('#pin-edit-form').elements = ['#edit-pin-title', '#edit-pin-description', '#edit-pin-url'].map(node);
  const pin = { id: 1, title: 'Original', description: 'Notes', destination: 'https://example.test' };
  let response = async () => ({ ok: false });
  let calls = 0, saved = 0;
  const ctx = vm.createContext({ canDeleteOriginal: () => owner,
    apiFetch: async () => { calls++; return response(); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/boardstuff/pin_editing.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), ctx);
  ctx.setupPinEditing({ querySelector: node, dataset: { pinId: '1' } }, pin, {}, () => saved++);
  return { node, pin, get calls() { return calls; }, get saved() { return saved; },
    respond(fn) { response = fn; }, submit: () => node('#pin-edit-form').onsubmit({ preventDefault() {} }) };
}

test('pin editor blocks viewers and preserves failed edits for retry', async () => {
  const viewer = editor(false);
  await viewer.submit();
  assert.equal(viewer.calls, 0);
  const ui = editor();
  ui.node('#edit-pin-title').value = 'Changed';
  let finish;
  ui.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = ui.submit(); await ui.submit();
  assert.equal(ui.calls, 1);
  finish({ ok: false }); await pending;
  assert.equal(ui.node('#edit-pin-title').value, 'Changed');
  assert.equal(ui.pin.title, 'Original');
  assert.match(ui.node('#pin-edit-status').textContent, /Unable/);
  assert.equal(ui.node('#edit-pin-title').disabled, false);
  ui.respond(async () => ({ ok: true, json: async () => ({ title: 'Changed', description: 'New', link_url: 'https://example.test/new' }) }));
  await ui.submit();
  assert.equal(ui.pin.title, 'Changed');
  assert.equal(ui.saved, 1);
  ui.node('#edit-pin-title').value = 'Unsaved';
  ui.node('#pin-edit-form').onreset({ preventDefault() {} });
  assert.equal(ui.node('#edit-pin-title').value, 'Changed');
});

test('creation validates destinations, prevents duplicate saves and retains failed drafts', async () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', disabled: false, addEventListener(event, handler) { this.handler = handler; } });
    return nodes.get(id);
  };
  node('#pin_title').value = 'Draft';
  node('#pin_destination').value = 'javascript:alert(1)';
  node('board_id').value = '10';
  let calls = 0, feedback = '', finish;
  const ctx = vm.createContext({ URL, state: { uploaded_file: {}, activeBoardId: 10 },
    document: { querySelector: node, getElementById: node, querySelectorAll: () => [node('#pin_title')] },
    uploadError: () => '', pinFeedback: text => { feedback = text; },
    FormData: class { append() {} },
    apiFetch: () => { calls++; return new Promise(resolve => { finish = resolve; }); },
    reset_modal() {}, loadPinsForBoard() {}
  });
  const source = fs.readFileSync(path.join(__dirname, '../public/js/boardstuff/modal_and_pin_script.js'), 'utf8');
  vm.runInContext(source.slice(source.indexOf('const savePinButton'), source.indexOf('function createPinMetadataHTML')), ctx);
  node('.save_pin').handler();
  assert.equal(calls, 0);
  assert.match(feedback, /HTTP/);
  node('#pin_destination').value = 'https://example.test';
  node('.save_pin').handler(); node('.save_pin').handler();
  assert.equal(calls, 1);
  assert.equal(node('#pin_title').disabled, true);
  finish({ ok: false, json: async () => ({ error: 'Please retry' }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(feedback, 'Please retry');
  assert.equal(node('#pin_title').value, 'Draft');
  assert.equal(node('.save_pin').disabled, false);
  assert.equal(node('#pin_title').disabled, false);
});

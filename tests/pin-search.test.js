const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../public/js/boardstuff/pin_search.js'), 'utf8').replace('export function', 'function'), context);
const select = (pins, query, order) => Array.from(context.selectPins(pins, query, order), pin => pin.pin_id);
const pins = [
  { pin_id: 10, title: 'Alpha', description: null, created_at: '2026-01-01' },
  { pin_id: 2, title: 'alpha', description: 'Travel %_', created_at: '2026-01-01' },
  { pin_id: 3, title: 'Travel', description: '', created_at: '2025-01-01' },
  { pin_id: 4, title: null, created_at: null },
  { pin_id: 5, created_at: 'invalid' }
];
test('pin search matches title or description, ignores case and trims whitespace', () => {
  assert.deepEqual(select(pins, ' TRAVEL '), [2, 3]);
  assert.deepEqual(select(pins, '%_'), [2]);
  assert.deepEqual(select(pins, 'absent'), []);
  assert.deepEqual(select([], ''), []);
});
test('pin ordering uses deterministic ties and places unknown dates last', () => {
  assert.deepEqual(select(pins, '', 'newest'), [2, 10, 3, 4, 5]);
  assert.deepEqual(select(pins, '', 'oldest'), [3, 2, 10, 4, 5]);
  assert.deepEqual(select(pins, '', 'title'), [4, 5, 2, 10, 3]);
  assert.deepEqual(pins.map(pin => pin.pin_id), [10, 2, 3, 4, 5]);
});

test('board controls reset, recover from failures and ignore stale responses', async () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: false, disabled: true, textContent: '', events: {},
      replaceChildren() { rendered.length = 0; }, addEventListener(type, fn) { this.events[type] = fn; }, focus() {} });
    return nodes.get(id);
  };
  const rendered = [];
  let fetchPins = async () => ({ ok: true, json: async () => pins });
  const ui = vm.createContext({
    document: { getElementById: node, querySelector: node },
    state: { pinLikes: {}, activeBoardId: 1 }, selectPins: context.selectPins,
    onSessionReady() {}, create_pin(pin) { rendered.push(pin.id); },
    apiFetch: () => fetchPins()
  });
  const source = fs.readFileSync(require('node:path').join(__dirname, '../public/js/boardstuff/board.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export function/g, 'function');
  vm.runInContext(source, ui);
  await ui.loadPinsForBoard(1);
  assert.deepEqual(rendered, [2,10,3,4,5]);
  node('pin-query').value = 'travel'; node('pin-query').events.input();
  assert.deepEqual(rendered, [2,3]);
  node('pin-sort').value = 'oldest'; node('pin-sort').events.change();
  assert.deepEqual(rendered, [3,2]);
  node('pin-reset').events.click();
  assert.equal(node('pin-query').value, '');
  assert.equal(node('pin-sort').value, 'newest');
  let resolve;
  fetchPins = () => new Promise(done => { resolve = done; });
  const pending = ui.loadPinsForBoard(1);
  fetchPins = async () => ({ ok: false });
  await ui.loadPinsForBoard(1);
  resolve({ ok: true, json: async () => pins }); await pending;
  assert.deepEqual(rendered, []);
  assert.equal(node('pin-retry').hidden, false);
  assert.match(node('board-status').textContent, /Unable/);
  fetchPins = async () => ({ ok: true, json: async () => [] });
  await node('pin-retry').events.click();
  assert.match(node('board-status').textContent, /No visible pins yet/);
  assert.equal(node('pin-query').disabled, false);
});

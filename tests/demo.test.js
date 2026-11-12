const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create, valid, KEY } = require('../docs/demo-model');
function memory() { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; }
test('demo seeds independently, searches and sorts without mutating samples', () => {
  const a = create(memory()), b = create(memory());
  assert.ok(valid(a.state));
  assert.deepEqual(a.boards('  SLOW ').map(b => b.id), [1]);
  assert.deepEqual(a.boards('', 'oldest').map(b => b.id), [1, 2, 3]);
  assert.deepEqual(a.boards('', 'name').map(b => b.id), [1, 2, 3]);
  assert.deepEqual(a.boards().map(b => b.id), [3, 2, 1]);
  a.like(1); assert.equal(b.state.pins[0].liked, false);
});
test('demo creation, likes and comments survive reload; reset only replaces demo data', () => {
  const storage = memory(); storage.setItem('unrelated', 'keep'); const store = create(storage);
  const id = store.addBoard('My board'); const pin = store.addPin(id, 'A new idea', 'Details', 'forest');
  store.like(pin); store.comment(pin, 'A thought');
  const reloaded = create(storage); assert.ok(valid(reloaded.state));
  assert.deepEqual(reloaded.state.pins.find(p => p.id === pin).comments, ['A thought']);
  assert.equal(reloaded.state.pins.find(p => p.id === pin).liked, true);
  reloaded.reset(); assert.equal(create(storage).state.boards.length, 3);
  assert.equal(storage.getItem('unrelated'), 'keep');
});
test('saving is a reference and removal/undo preserves original and comments', () => {
  const store = create(memory()); assert.equal(store.save(1, 2), true); assert.equal(store.save(1, 2), false);
  store.comment(1, 'Shared reference'); const change = store.remove(1, 2);
  assert.ok(store.state.boards[0].pins.includes(1)); assert.equal(store.state.pins.length, 6);
  store.undo(change); store.undo(change);
  assert.equal(store.state.boards[1].pins.filter(id => id === 1).length, 1);
  assert.deepEqual(store.state.pins[0].comments, ['Shared reference']);
});
test('corrupt storage and unavailable storage recover with visible warnings', () => {
  const storage = memory(); storage.setItem(KEY, '{broken'); const recovered = create(storage);
  assert.equal(recovered.state.boards.length, 3); assert.match(recovered.warning, /could not be loaded/);
  const blocked = create({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  blocked.addBoard('Still usable'); assert.equal(blocked.state.boards.length, 4); assert.match(blocked.warning, /only for this visit/);
  const malformed = recovered.state; malformed.boards[0].pins.push(999); storage.setItem(KEY, JSON.stringify(malformed));
  assert.match(create(storage).warning, /could not be loaded/);
});
test('invalid creation and comments do not leave partial records', () => {
  const store = create(memory()); assert.throws(() => store.addPin(1, ' ', '', 'forest'));
  assert.throws(() => store.addPin(1, 'Title', '', 'unknown')); assert.throws(() => store.comment(1, ' '));
  assert.throws(() => store.save(1, 999)); assert.equal(store.state.pins.length, 6);
  assert.equal(store.state.pins[0].comments.length, 0);
});

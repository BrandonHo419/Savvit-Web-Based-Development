const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ fail = '', missing = false, rollbackFailure = false } = {}) {
  const events = [];
  const changes = [];
  const errors = [];
  let committed = false;
  const connection = {
    async beginTransaction() { events.push('begin'); if (fail === 'begin') throw Error('begin'); },
    async query(sql, params) {
      const q = sql.replace(/\s+/g, ' ').trim();
      events.push(q);
      if (q.includes('FOR UPDATE')) {
        assert.deepEqual(Array.from(params), ['10', 1, 1]);
        assert.match(q, /p.user_id = \? AND b.user_id = \? FOR UPDATE$/);
        if (fail === 'lock') throw Error('lock');
        return [missing ? [] : [{ pin_id: 10 }]];
      }
      assert.deepEqual(Array.from(params), ['10']);
      if (q.includes(fail) && fail) throw Error('write');
      changes.push(q);
      return [{ affectedRows: 1 }];
    },
    async commit() { events.push('commit'); if (fail === 'commit') throw Error('commit'); committed = true; },
    async rollback() { events.push('rollback'); changes.length = 0; if (rollbackFailure) throw Error('rollback'); },
    release() { events.push('release'); }
  };
  const context = vm.createContext({ module: { exports: {} }, console: { error: (...args) => errors.push(args) },
    require: () => ({ getConnection: async () => { if (fail === 'connect') throw Error('connect'); return connection; } }) });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../models/pinDeletion.js'), 'utf8'), context);
  return { events, changes, errors, committed: () => committed, run: () => context.module.exports('10', 1) };
}

test('original deletion locks owners, clears reply chains and deletes every dependent table before commit', async () => {
  const view = setup();
  assert.equal(await view.run(), true);
  assert.equal(view.events[0], 'begin');
  assert.match(view.events[1], /FOR UPDATE$/);
  assert.match(view.changes[0], /^UPDATE replies.*parent_reply_id = NULL/);
  assert.match(view.changes[1], /^DELETE r FROM replies/);
  const tables = view.changes.slice(2).map(q => q.split(' ')[2]);
  assert.deepEqual(tables, ['comments', 'engagements', 'board_pins', 'image_metadata', 'pin_categories', 'pin_tags', 'pin_views', 'pins']);
  assert.deepEqual(view.events.slice(-2), ['commit', 'release']);
});

test('missing or changed ownership at locked recheck produces no deletion', async () => {
  const view = setup({ missing: true });
  assert.equal(await view.run(), false);
  assert.deepEqual(view.changes, []);
  assert.deepEqual(view.events.slice(-2), ['rollback', 'release']);
});

for (const fail of ['connect', 'begin', 'lock', 'UPDATE replies', 'DELETE r',
  ...['comments', 'engagements', 'board_pins', 'image_metadata', 'pin_categories', 'pin_tags', 'pin_views', 'pins'].map(t => `DELETE FROM ${t} WHERE`), 'commit']) {
  test(`original deletion fails safely at ${fail}`, async () => {
    const view = setup({ fail });
    await assert.rejects(view.run());
    assert.equal(view.committed(), false);
    assert.deepEqual(view.changes, []);
    if (fail !== 'connect') assert.deepEqual(view.events.slice(-2), ['rollback', 'release']);
  });
}

test('rollback failure is reported and the connection is still released', async () => {
  const view = setup({ fail: 'DELETE FROM pins WHERE', rollbackFailure: true });
  await assert.rejects(view.run(), /write/);
  assert.equal(view.errors.length, 1);
  assert.equal(view.events.at(-1), 'release');
});

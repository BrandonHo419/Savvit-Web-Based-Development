const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { initializeEmptyDatabase, bootstrapOwner } = require('../models/freshInstall');

function database({ tables = 0, users = [], failCreate = false } = {}) {
  const calls = [];
  const connection = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === 'SELECT DATABASE() AS name') return [[{ name: 'savvit_fresh_test' }]];
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('information_schema.tables')) return [[{ total: tables }]];
      if (sql === 'SELECT user_id FROM users FOR UPDATE') return [users];
      if (sql.startsWith('CREATE TABLE') && failCreate) throw Error('DDL failed');
      return [{ insertId: 1 }];
    },
    async beginTransaction() { calls.push({ sql: 'BEGIN' }); },
    async commit() { calls.push({ sql: 'COMMIT' }); },
    async rollback() { calls.push({ sql: 'ROLLBACK' }); }
  };
  return { connection, calls };
}

test('fresh installer creates only empty tables in dependency order', async () => {
  const view = database();
  await initializeEmptyDatabase(view.connection);
  const statements = view.calls.filter(c => c.sql.startsWith('CREATE TABLE')).map(c => c.sql);
  assert.equal(statements.length, 16);
  assert.match(statements[0], /CREATE TABLE `users`/);
  assert.ok(statements.some(sql => sql.includes('team_title')));
  assert.ok(statements.some(sql => sql.includes("'semi-private'")));
  assert.ok(statements.some(sql => sql.includes('CREATE TABLE board_viewers')));
  assert.ok(view.calls.every(c => !/^(INSERT|DROP|DELETE|TRUNCATE|REPLACE)\b/i.test(c.sql)));
});

test('fresh installer refuses any existing tables and never drops a partially installed database', async () => {
  const existing = database({ tables: 1 });
  await assert.rejects(initializeEmptyDatabase(existing.connection), /not empty/);
  assert.ok(existing.calls.every(c => !c.sql.startsWith('CREATE')));
  const failed = database({ failCreate: true });
  await assert.rejects(initializeEmptyDatabase(failed.connection), /DDL failed/);
  assert.ok(failed.calls.every(c => !/DROP|DELETE|TRUNCATE/.test(c.sql)));
  assert.match(failed.calls.at(-1).sql, /RELEASE_LOCK/);
});

test('owner bootstrap hashes credentials, creates the sole owner and refuses existing accounts', async () => {
  const account = { username: 'owner-test', email: 'owner@example.test', password: 'temporary-test-password' };
  const fresh = database();
  await bootstrapOwner(fresh.connection, account);
  const insert = fresh.calls.find(c => c.sql.startsWith('INSERT'));
  assert.match(insert.sql, /'owner'/);
  assert.equal(await bcrypt.compare(account.password, insert.params[2]), true);
  assert.notEqual(insert.params[2], account.password);
  assert.ok(fresh.calls.some(c => c.sql === 'COMMIT'));
  const existing = database({ users: [{ user_id: 1 }] });
  await assert.rejects(bootstrapOwner(existing.connection, account), /zero accounts/);
  assert.ok(existing.calls.every(c => !c.sql.startsWith('INSERT')));
  assert.ok(existing.calls.some(c => c.sql === 'ROLLBACK'));
  await assert.rejects(bootstrapOwner(database().connection, { ...account, password: 'short' }), /valid owner/);
});

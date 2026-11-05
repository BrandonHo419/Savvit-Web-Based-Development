const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ lock = async () => [[{ board_id: 10 }]], fail = '' } = {}) {
    const events = [];
    const connection = {
        async beginTransaction() { events.push('begin'); },
        async query(sql, params) {
            if (sql.includes('FOR UPDATE')) {
                events.push('lock');
                assert.deepEqual(Array.from(params), [10, 1]);
                return lock();
            }
            events.push('write');
            if (fail === 'write') throw new Error('write failure');
            return [{ affectedRows: 1 }];
        },
        async commit() { events.push('commit'); if (fail === 'commit') throw new Error('commit failure'); },
        async rollback() { events.push('rollback'); },
        release() { events.push('release'); }
    };
    const context = vm.createContext({ module: { exports: {} }, console,
        require: () => ({ getConnection: async () => connection }) });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../models/boardWrite.js'), 'utf8'), context);
    return { events, run: () => context.module.exports(10, 1, 'INSERT INTO pins ...', []) };
}

test('board writes wait for destination lock and commit before releasing', async () => {
    let unlock;
    const view = setup({ lock: () => new Promise(resolve => { unlock = resolve; }) });
    const pending = view.run();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(view.events, ['begin', 'lock']);
    unlock([[{ board_id: 10 }]]);
    assert.equal((await pending).affectedRows, 1);
    assert.deepEqual(view.events, ['begin', 'lock', 'write', 'commit', 'release']);
});

test('missing locked destinations roll back without a write', async () => {
    const view = setup({ lock: async () => [[]] });
    assert.equal(await view.run(), null);
    assert.deepEqual(view.events, ['begin', 'lock', 'rollback', 'release']);
});

test('board write and commit failures roll back and release connections', async () => {
    for (const fail of ['write', 'commit']) {
        const view = setup({ fail });
        await assert.rejects(view.run(), new RegExp(`${fail} failure`));
        assert.deepEqual(view.events.slice(-2), ['rollback', 'release']);
    }
});

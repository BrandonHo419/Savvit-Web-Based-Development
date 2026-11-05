const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ owner = true, confirm = true, fetcher = async () => ({ ok: true }), lineEnding = '\n' } = {}) {
    const button = { hidden: true, disabled: false, addEventListener(type, fn) { this[type] = fn; } };
    const status = { textContent: '' };
    const calls = [];
    const redirects = [];
    const context = vm.createContext({ encodeURIComponent,
        window: { confirm: () => confirm, location: { assign: url => redirects.push(url) } },
        document: { getElementById: id => id === 'delete-board' ? button : status },
        apiFetch: async (...args) => { calls.push(args); return fetcher(); }
    });
    for (const file of ['delete.js', 'board_deletion.js']) {
        const source = fs.readFileSync(path.join(__dirname, '../public/js/boardstuff', file), 'utf8')
            .replace(/\r?\n/g, lineEnding).replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
        vm.runInContext(source, context);
    }
    context.setupBoardDeletion({ board_id: 30, is_owner: owner });
    return { button, status, calls, redirects };
}

test('board deletion control stays hidden and inactive for nonowners', () => {
    const view = setup({ owner: false });
    assert.equal(view.button.hidden, true);
    assert.equal(view.button.click, undefined);
});

test('cancelled board deletion sends no request or redirect', async () => {
    const view = setup({ confirm: false });
    await view.button.click();
    assert.equal(view.calls.length, 0);
    assert.equal(view.redirects.length, 0);
    assert.equal(view.button.disabled, false);
});

for (const lineEnding of ['\n', '\r\n']) {
    test(`successful board deletion handles empty 204 and returns home (${JSON.stringify(lineEnding)})`, async () => {
        const view = setup({ lineEnding });
        await view.button.click();
        assert.equal(view.calls[0][0], '/boards/30');
        assert.equal(view.calls[0][1].method, 'DELETE');
        assert.deepEqual(view.redirects, ['/home.html']);
    });
}

test('blocked, failed and offline board deletion retain the view and restore controls', async () => {
    for (const fetcher of [
        async () => ({ ok: false, json: async () => ({ error: 'This board contains original pins.' }) }),
        async () => ({ ok: false, json: async () => { throw new Error('not JSON'); } }),
        async () => { throw new Error('Network unavailable'); }
    ]) {
        const view = setup({ fetcher });
        await view.button.click();
        assert.ok(view.status.textContent);
        assert.equal(view.redirects.length, 0);
        assert.equal(view.button.disabled, false);
    }
});

test('board deletion prevents duplicate clicks while pending', async () => {
    let finish;
    const view = setup({ fetcher: () => new Promise(resolve => { finish = resolve; }) });
    const pending = view.button.click();
    await view.button.click();
    assert.equal(view.calls.length, 1);
    assert.equal(view.button.disabled, true);
    finish({ ok: true });
    await pending;
    assert.equal(view.redirects.length, 1);
});

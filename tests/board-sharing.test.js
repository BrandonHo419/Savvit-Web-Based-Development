const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ owner = true, confirm = true, fetcher, lineEnding = '\n' } = {}) {
    const element = () => ({ hidden: true, disabled: false, value: '', textContent: '', children: [], handlers: {},
        addEventListener(type, fn) { this.handlers[type] = fn; },
        setAttribute() {}, replaceChildren() { this.children = []; },
        append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); }
    });
    const ids = ['board-sharing', 'board-sharing-form', 'viewer-username', 'board-viewers', 'sharing-status', 'reload-viewers', 'add-viewer'];
    const elements = Object.fromEntries(ids.map(id => [id, element()]));
    const calls = [];
    const context = vm.createContext({ encodeURIComponent, window: { confirm: () => confirm },
        document: { getElementById: id => elements[id], createElement: element },
        apiFetch: async (...args) => { calls.push(args); return fetcher ? fetcher(...args) : { ok: true, json: async () => ({ viewers: [] }) }; }
    });
    const source = fs.readFileSync(path.join(__dirname, '../public/js/boardstuff/board_sharing.js'), 'utf8')
        .replace(/\r?\n/g, lineEnding).replace(/^import .*;\r?\n/, '').replace('export async function', 'async function');
    vm.runInContext(source, context);
    return { elements, calls, start: () => context.setupBoardSharing({ board_id: 10, is_owner: owner }),
        submit: () => elements['board-sharing-form'].handlers.submit({ preventDefault() {} }) };
}

test('sharing controls stay hidden for nonowners without fetching usernames', async () => {
    const view = setup({ owner: false });
    await view.start();
    assert.equal(view.calls.length, 0);
    assert.equal(view.elements['board-sharing'].hidden, true);
});

for (const lineEnding of ['\n', '\r\n']) {
    test(`sharing submits exact username and reloads after granting (${JSON.stringify(lineEnding)})`, async () => {
        const view = setup({ lineEnding });
        await view.start();
        view.elements['viewer-username'].value = '  UserTwo  ';
        await view.submit();
        assert.equal(view.calls[1][0], '/boards/10/viewers');
        assert.equal(view.calls[1][1].method, 'POST');
        assert.deepEqual(JSON.parse(view.calls[1][1].body), { username: 'UserTwo' });
        assert.equal(view.elements['viewer-username'].value, '');
        assert.match(view.elements['sharing-status'].textContent, /Viewer granted/);
    });
}

test('sharing renders usernames as text and honours revoke confirmation', async () => {
    for (const confirm of [false, true]) {
        const view = setup({ confirm, fetcher: async () => ({ ok: true, json: async () => ({ viewers: [{ user_id: 2, username: '<img onerror=x>' }] }) }) });
        await view.start();
        const item = view.elements['board-viewers'].children[0];
        assert.equal(item.children[0].textContent, '<img onerror=x>');
        await item.children[1].handlers.click();
        const deletes = view.calls.filter(call => call[1]?.method === 'DELETE');
        assert.equal(deletes.length, confirm ? 1 : 0);
        if (confirm) assert.equal(deletes[0][0], '/boards/10/viewers/2');
    }
});

test('sharing failures report errors, restore controls and support retry', async () => {
    let fail = true;
    const view = setup({ fetcher: async () => {
        if (fail) throw new Error('Network unavailable');
        return { ok: true, json: async () => ({ viewers: [] }) };
    } });
    await view.start();
    assert.equal(view.elements['sharing-status'].textContent, 'Network unavailable');
    assert.equal(view.elements['reload-viewers'].disabled, false);
    fail = false;
    await view.elements['reload-viewers'].handlers.click();
    assert.match(view.elements['sharing-status'].textContent, /No viewers/);
});

test('sharing serializes pending actions to prevent duplicate grants', async () => {
    let finish;
    const view = setup({ fetcher: async (url, options) => options?.method === 'POST'
        ? new Promise(resolve => { finish = resolve; }) : { ok: true, json: async () => ({ viewers: [] }) } });
    await view.start();
    view.elements['viewer-username'].value = 'user2';
    const pending = view.submit();
    await view.submit();
    assert.equal(view.calls.filter(call => call[1]?.method === 'POST').length, 1);
    finish({ ok: true });
    await pending;
    assert.equal(view.elements['add-viewer'].disabled, false);
});

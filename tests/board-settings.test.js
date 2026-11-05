const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise form behaviour with a small DOM substitute, not a browser renderer.
function setup({ owner = true, confirm = true, response, lineEnding } = {}) {
    const ids = ['board-settings', 'board-settings-form', 'board-name', 'board-description',
        'board-visibility', 'board-settings-status', 'welcome-title', 'welcome-subtitle', 'board_select', 'board_id'];
    const elements = Object.fromEntries(ids.map(id => [id, {
        value: '', textContent: '', hidden: true, disabled: false, handlers: {},
        addEventListener(type, handler) { this.handlers[type] = handler; },
        focus() { this.focused = true; }
    }]));
    elements['board-settings-form'].elements = [elements['board-name'], elements['board-description'], elements['board-visibility']];
    elements.board_select.options = [{ value: '10', textContent: 'Original' }];
    elements.board_id.options = [{ value: '10', textContent: 'Original' }];
    const calls = [];
    const context = vm.createContext({
        document: { getElementById: id => elements[id] },
        window: { confirm: () => confirm },
        apiFetch: async (...args) => { calls.push(args); return response ? response() : { ok: true }; }
    });
    let source = fs.readFileSync(path.join(__dirname, '../public/js/boardstuff/board_settings.js'), 'utf8');
    if (lineEnding) source = source.replace(/\r?\n/g, lineEnding);
    source = source.replace(/^import .*;\r?\n/, '').replace('export function', 'function');
    vm.runInContext(source, context);
    context.setupBoardSettings({ board_id: 10, name: 'Original', description: 'Notes', visibility: 'private', is_owner: owner });
    const submit = () => elements['board-settings-form'].handlers.submit({ preventDefault() {} });
    const reset = () => elements['board-settings-form'].handlers.reset({ preventDefault() {} });
    return { elements, calls, submit, reset };
}

test('settings remain hidden and have no handlers for nonowners', () => {
    const { elements } = setup({ owner: false });
    assert.equal(elements['board-settings'].hidden, true);
    assert.equal(elements['board-settings-form'].handlers.submit, undefined);
});

test('settings submit edited fields only and render returned local text safely', async () => {
    const { elements, calls, submit, reset } = setup();
    elements['board-name'].value = '  <img onerror=alert(1)>  ';
    await submit();
    assert.equal(calls[0][0], '/boards/10');
    assert.equal(calls[0][1].method, 'PATCH');
    assert.deepEqual(JSON.parse(calls[0][1].body), { name: '<img onerror=alert(1)>' });
    assert.equal(elements['welcome-title'].textContent, '<img onerror=alert(1)>');
    assert.equal(elements.board_select.options[0].textContent, '<img onerror=alert(1)>');
    elements['board-name'].value = 'Unsaved';
    reset();
    assert.equal(elements['board-name'].value, '<img onerror=alert(1)>');
    await submit();
    assert.equal(calls.length, 1);
});

test('settings reject blank names and honour cancellation before making a board public', async () => {
    const { elements, calls, submit } = setup({ confirm: false });
    elements['board-name'].value = '  ';
    await submit();
    assert.equal(elements['board-name'].focused, true);
    elements['board-name'].value = 'Original';
    elements['board-visibility'].value = 'public';
    await submit();
    assert.equal(calls.length, 0);
});

test('failed settings saves preserve edits, show errors and restore controls', async () => {
    for (const response of [
        async () => ({ ok: false, json: async () => ({ error: 'Resource not found' }) }),
        async () => { throw new Error('Network unavailable'); }
    ]) {
        const { elements, calls, submit, reset } = setup({ response });
        elements['board-name'].value = 'Unsaved';
        await submit();
        assert.equal(calls.length, 1);
        assert.equal(elements['board-name'].value, 'Unsaved');
        assert.match(elements['board-settings-status'].textContent, /Resource not found|Network unavailable/);
        assert.equal(elements['board-name'].disabled, false);
        reset();
        assert.equal(elements['board-name'].value, 'Original');
    }
});

test('settings prevent duplicate submissions while a request is pending', async () => {
    let finish;
    const { elements, calls, submit } = setup({ response: () => new Promise(resolve => { finish = resolve; }) });
    elements['board-name'].value = 'Updated';
    const pending = submit();
    assert.equal(elements['board-name'].disabled, true);
    await submit();
    assert.equal(calls.length, 1);
    finish({ ok: true });
    await pending;
    assert.equal(elements['board-name'].disabled, false);
});

for (const [label, lineEnding] of [['LF', '\n'], ['CRLF', '\r\n']]) {
    test(`settings loader supports ${label} source line endings`, async () => {
        const { elements, calls, submit } = setup({ lineEnding });
        elements['board-name'].value = 'Renamed';
        await submit();
        assert.equal(calls.length, 1);
        assert.equal(elements['board-settings-status'].textContent, 'Board settings saved.');
    });
}

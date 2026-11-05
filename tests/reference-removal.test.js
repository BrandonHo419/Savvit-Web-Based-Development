const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup({ confirm = true, fetcher = async () => ({ ok: true }), lineEnding = '\n' } = {}) {
    const status = { textContent: '' };
    const makeButton = () => ({ hidden: false, disabled: false, isConnected: true,
        cloneNode: makeButton,
        replaceWith(next) { this.isConnected = false; button = next; },
        addEventListener(type, handler) { this[type] = handler; }
    });
    let button = makeButton();
    const calls = [];
    let removed = 0;
    const modal = { querySelector: selector => selector === '#remove-reference' ? button : status };
    const context = vm.createContext({ encodeURIComponent,
        window: { confirm: () => confirm },
        apiFetch: async (...args) => { calls.push(args); return fetcher(...args); }
    });
    const source = fs.readFileSync(path.join(__dirname, '../public/js/boardstuff/reference_removal.js'), 'utf8')
        .replace(/\r?\n/g, lineEnding).replace(/^import .*;\r?\n/, '').replaceAll('export function', 'function');
    vm.runInContext(source, context);
    const state = { activeBoardId: '10', canEditBoard: true, userId: 1 };
    const pin = { id: 210, board_id: 21, user_id: 2 };
    const open = (p = pin, s = state) => context.setupReferenceRemoval(modal, p, s, () => { removed++; });
    open();
    return { get button() { return button; }, status, calls, get removed() { return removed; }, open,
        canDelete: context.canDeleteOriginal, state, pin };
}

test('removal controls distinguish saved references, original pins, guests and external previews', () => {
    const view = setup();
    assert.equal(view.button.hidden, false);
    assert.equal(view.canDelete(view.pin, view.state), false);
    const original = { id: 100, board_id: 10, user_id: 1 };
    assert.equal(view.canDelete(original, view.state), true);
    assert.equal(view.canDelete({ ...original, board_id: 11 }, view.state), false);
    for (const [pin, state] of [
        [original, view.state], [view.pin, { ...view.state, canEditBoard: false }],
        [{ ...view.pin, board_id: null }, view.state], [view.pin, { ...view.state, activeBoardId: null }]
    ]) {
        view.open(pin, state);
        assert.equal(view.button.hidden, true);
        assert.equal(view.button.click, undefined);
    }
    assert.equal(view.canDelete(original, { ...view.state, canEditBoard: false }), false);
});

for (const lineEnding of ['\n', '\r\n']) {
    test(`removal sends the captured board and pin IDs and handles empty success (${JSON.stringify(lineEnding)})`, async () => {
        const view = setup({ lineEnding });
        view.state.activeBoardId = 99;
        await view.button.click();
        assert.equal(view.calls[0][0], '/boards/10/pins/210/reference');
        assert.equal(view.calls[0][1].method, 'DELETE');
        assert.equal(view.removed, 1);
    });
}

test('cancelled removal sends no request', async () => {
    const view = setup({ confirm: false });
    await view.button.click();
    assert.equal(view.calls.length, 0);
});

test('failed removals retain the view, report failure and restore the control', async () => {
    for (const fetcher of [async () => ({ ok: false }), async () => { throw new Error('offline'); }]) {
        const view = setup({ fetcher });
        await view.button.click();
        assert.equal(view.removed, 0);
        assert.match(view.status.textContent, /Unable to remove/);
        assert.equal(view.button.disabled, false);
    }
});

test('pending removal blocks duplicate requests and cannot close a subsequently opened pin', async () => {
    let finish;
    const view = setup({ fetcher: () => new Promise(resolve => { finish = resolve; }) });
    const previous = view.button;
    const pending = previous.click();
    await previous.click();
    assert.equal(view.calls.length, 1);
    assert.equal(previous.disabled, true);
    view.open({ ...view.pin, id: 220 });
    finish({ ok: true });
    await pending;
    assert.equal(view.removed, 0);
    assert.equal(view.status.textContent, '');
    assert.equal(view.button.disabled, false);
});

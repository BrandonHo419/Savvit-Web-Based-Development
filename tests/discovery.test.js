const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup({ session = {}, fetcher } = {}) {
    const element = () => ({ children: [], handlers: {}, disabled: false, value: '', textContent: '',
        addEventListener(type, fn) { this.handlers[type] = fn; }, setAttribute() {},
        replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); },
        appendChild(item) { this.children.push(item); } });
    const ids = ['public-board-search', 'board-query', 'public-board-list', 'discovery-status', 'previous-page', 'next-page', 'page-label', 'discovery-retry'];
    const elements = Object.fromEntries(ids.map(id => [id, element()]));
    const calls = [];
    const window = { location: { href: '' } };
    const context = vm.createContext({ URLSearchParams, window,
        document: { getElementById: id => elements[id], createElement: element },
        getSession: async () => session,
        apiFetch: async url => { calls.push(url); return fetcher(url); }
    });
    const source = fs.readFileSync(path.join(__dirname, '../public/js/public-boards.js'), 'utf8')
        .replace(/^import .*;\r?\n/, '').replace('export async function', 'async function').replace(/\ninitDiscovery\(\);\s*$/, '');
    vm.runInContext(source, context);
    return { elements, calls, window, start: () => context.initDiscovery() };
}
const response = (boards, has_more = false) => ({ ok: true, json: async () => ({ boards, page: 1, has_more }) });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('discovery redirects anonymous visitors before querying boards', async () => {
    const view = setup({ session: null });
    await view.start();
    assert.equal(view.window.location.href, '/login.html');
    assert.equal(view.calls.length, 0);
});

test('discovery renders text safely and exposes pagination', async () => {
    const view = setup({ fetcher: async () => response([{ board_id: 11, name: '<img onerror=x>', owner_name: '<b>A</b>', description: '<script>x</script>' }], true) });
    await view.start();
    const card = view.elements['public-board-list'].children[0];
    assert.equal(card.href, '/board.html?board_id=11');
    assert.equal(card.children[0].textContent, '<img onerror=x>');
    assert.equal(card.children[1].textContent, 'By <b>A</b>');
    assert.equal(view.elements['previous-page'].disabled, true);
    assert.equal(view.elements['next-page'].disabled, false);
    view.elements['next-page'].handlers.click();
    await tick();
    assert.match(view.calls[1], /page=2/);
});

test('discovery reports failures and retry can recover with empty results', async () => {
    let fail = true;
    const view = setup({ fetcher: async () => { if (fail) throw new Error('Network failed'); return response([]); } });
    await view.start();
    assert.equal(view.elements['discovery-retry'].hidden, false);
    assert.equal(view.elements['discovery-status'].textContent, 'Network failed');
    fail = false;
    await view.elements['discovery-retry'].handlers.click();
    assert.equal(view.elements['discovery-retry'].hidden, true);
    assert.match(view.elements['discovery-status'].textContent, /No public boards/);
});

test('discovery ignores a slow response after a newer search completes', async () => {
    let finish;
    let count = 0;
    const view = setup({ fetcher: async () => {
        if (++count === 1) return new Promise(resolve => { finish = resolve; });
        return response([{ board_id: 21, name: 'New', owner_name: 'B' }]);
    } });
    const initial = view.start();
    await tick();
    view.elements['board-query'].value = 'New';
    view.elements['public-board-search'].handlers.submit({ preventDefault() {} });
    await tick();
    finish(response([{ board_id: 11, name: 'Old', owner_name: 'A' }]));
    await initial;
    assert.equal(view.elements['public-board-list'].children[0].children[0].textContent, 'New');
    assert.match(view.calls[1], /q=New&page=1/);
});

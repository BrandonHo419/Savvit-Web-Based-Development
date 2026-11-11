const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function view(file, { session = { user_id: 1, username: '<b>User</b>', email: 'user@example.test' }, boards = [], failSession = false } = {}) {
    const nodes = new Map();
    function element() {
        return { textContent: '', value: '', hidden: false, disabled: false, children: [], events: {},
            append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; },
            setAttribute() {}, focus() {}, addEventListener(type, fn) { this.events[type] = fn; } };
    }
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    const redirects = [], calls = [];
    let failure = failSession;
    let post = async () => Response.json({ board_id: 42 });
    let getBoards = async () => Response.json(boards);
    const context = vm.createContext({ document: { getElementById: get, createElement: element },
        window: { location: { replace: url => redirects.push(url), assign: url => redirects.push(url) } },
        getSession: async () => { if (failure) throw Error('offline'); return session; },
        apiFetch: async (url, options) => { calls.push({ url, options }); return options ? post() : getBoards(); }
    });
    const source = fs.readFileSync(path.join(__dirname, '../public/js', file), 'utf8').replace(/^import .*;\r?\n/gm, '');
    vm.runInContext(source, context);
    await new Promise(resolve => setImmediate(resolve));
    return { get, calls, redirects, recover() { failure = false; }, setPost(fn) { post = fn; }, setGet(fn) { getBoards = fn; } };
}

const boardIds = ui => ui.get('collections-grid').children.map(card => Number(card.href.split('=')[1]));
const changeSort = (ui, value) => { ui.get('collections-sort').value = value; ui.get('collections-sort').events.change(); };
const searchBoards = (ui, value) => { ui.get('collections-query').value = value; ui.get('collections-query').events.input(); };

test('home sorts dates and names deterministically, with missing values handled', async () => {
    const boards = [
        { board_id: 10, name: 'alpha', created_at: '2026-02-01T00:00:00Z' },
        { board_id: 2, name: 'Alpha', created_at: '2026-02-01T00:00:00Z' },
        { board_id: 3, name: 'Zebra', created_at: '2025-01-01T00:00:00Z' },
        { board_id: 4, name: null, created_at: null },
        { board_id: 5, created_at: 'invalid' }
    ];
    const ui = await view('collections.js', { boards });
    assert.deepEqual(boardIds(ui), [2, 10, 3, 4, 5]);
    changeSort(ui, 'oldest');
    assert.deepEqual(boardIds(ui), [3, 2, 10, 4, 5]);
    changeSort(ui, 'name');
    assert.deepEqual(boardIds(ui), [2, 10, 4, 5, 3]);
    assert.equal(ui.get('collections-grid').children[2].children[0].children[0].textContent, 'Untitled board');
    assert.equal(ui.calls.length, 1);
});

test('home filters names literally, counts matches and resets both controls without fetching', async () => {
    const ui = await view('collections.js', { boards: [
        { board_id: 1, name: 'Travel %_', created_at: '2025-01-01' },
        { board_id: 2, name: 'TRAVEL ideas', created_at: '2026-01-01' },
        { board_id: 3, name: 'Food', description: 'travel', created_at: '2024-01-01' }
    ] });
    changeSort(ui, 'oldest');
    searchBoards(ui, '  TrAvEl  ');
    assert.deepEqual(boardIds(ui), [1, 2]);
    assert.equal(ui.get('collections-status').textContent, '2 of 3 boards match your search.');
    searchBoards(ui, '%_');
    assert.deepEqual(boardIds(ui), [1]);
    searchBoards(ui, 'missing');
    assert.deepEqual(boardIds(ui), []);
    assert.match(ui.get('collections-status').textContent, /0 of 3 boards.*No boards match/);
    assert.doesNotMatch(ui.get('collections-status').textContent, /No boards yet/);
    ui.get('collections-reset').events.click();
    assert.equal(ui.get('collections-query').value, '');
    assert.equal(ui.get('collections-sort').value, 'newest');
    assert.deepEqual(boardIds(ui), [2, 1, 3]);
    assert.equal(ui.calls.length, 1);
});

test('home controls preserve loading and error feedback, and retry reapplies the current search', async () => {
    const ui = await view('collections.js', { boards: [{ board_id: 1, name: 'Ideas' }] });
    searchBoards(ui, 'ideas');
    let finish;
    ui.setGet(() => new Promise(resolve => { finish = resolve; }));
    const pending = ui.get('collections-retry').events.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ui.get('collections-query').disabled, true);
    searchBoards(ui, 'ideas');
    assert.match(ui.get('collections-status').textContent, /Loading/);
    finish(new Response('failed', { status: 500 }));
    await pending;
    assert.equal(ui.get('collections-reset').disabled, true);
    assert.equal(ui.get('collections-retry').hidden, false);
    searchBoards(ui, 'ideas');
    assert.match(ui.get('collections-status').textContent, /Unable/);
    ui.setGet(async () => Response.json([{ board_id: 2, name: 'Other' }, { board_id: 3, name: 'Ideas again' }]));
    await ui.get('collections-retry').events.click();
    assert.deepEqual(boardIds(ui), [3]);
    assert.equal(ui.get('collections-query').disabled, false);
    assert.equal(ui.get('collections-sort').disabled, false);
    assert.equal(ui.get('collections-reset').disabled, false);
    assert.equal(ui.get('collections-retry').hidden, true);
});

test('home renders board names as text, counts and destination links; empty state is useful', async () => {
    const empty = await view('collections.js');
    assert.match(empty.get('collections-status').textContent, /No boards yet/);
    const ui = await view('collections.js', { boards: [{ board_id: 7, name: '<img onerror=bad>', pin_count: 1 }] });
    const card = ui.get('collections-grid').children[0];
    assert.equal(card.href, '/board.html?board_id=7');
    assert.equal(card.children[0].children[0].textContent, '<img onerror=bad>');
    assert.equal(card.children[0].children[1].textContent, '1 pin');
});

test('home creation prevents duplicates, retains failed input and supports explicit retry', async () => {
    const ui = await view('collections.js');
    ui.get('new-board-name').value = 'Ideas';
    let resolve;
    ui.setPost(() => new Promise(done => { resolve = done; }));
    const submit = () => ui.get('create-board-form').events.submit({ preventDefault() {} });
    const pending = submit();
    await submit();
    assert.equal(ui.calls.filter(c => c.options).length, 1);
    assert.equal(ui.get('create-board-submit').disabled, true);
    resolve(new Response('failed', { status: 500 }));
    await pending;
    assert.equal(ui.get('new-board-name').value, 'Ideas');
    assert.equal(ui.get('create-board-submit').disabled, false);
    assert.match(ui.get('create-board-status').textContent, /Unable/);
    ui.setPost(async () => Response.json({ board_id: 42 }));
    await submit();
    assert.deepEqual(ui.redirects, ['/board.html?board_id=42']);
});

for (const [file, retry, status] of [['collections.js', 'collections-retry', 'collections-status'], ['profile.js', 'profile-retry', 'profile-status']]) {
    test(`${file} distinguishes signed-out state from recoverable service failure`, async () => {
        const anonymous = await view(file, { session: null });
        assert.deepEqual(anonymous.redirects, ['/login.html']);
        const ui = await view(file, { failSession: true });
        assert.deepEqual(ui.redirects, []);
        assert.equal(ui.get(retry).hidden, false);
        assert.match(ui.get(status).textContent, /Unable/);
        ui.recover();
        await ui.get(retry).events.click();
        assert.equal(ui.get(retry).hidden, true);
        if (file === 'profile.js') assert.equal(ui.get('username').textContent, '<b>User</b>');
    });
}

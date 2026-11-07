const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

test('API helper loads session once and sends CSRF for JSON and multipart mutations', async () => {
    const source = await readFile(path.join(__dirname, '../public/js/api.js'), 'utf8');
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, options });
        if (url === '/users/profile') return Response.json({ user_id: 2, csrfToken: 'session-token' });
        return Response.json({ ok: true });
    };
    try {
        const { apiFetch, getSession } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
        assert.equal((await getSession()).user_id, 2);
        await apiFetch('/boards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"Mine"}' });
        const multipart = new FormData();
        multipart.set('title', 'A pin');
        await apiFetch('/pins', { method: 'POST', body: multipart });
        await apiFetch('/boards/users/2/boards');
        assert.equal(calls.filter(call => call.url === '/users/profile').length, 1);
        assert.equal(calls[1].options.headers.get('X-CSRF-TOKEN'), 'session-token');
        assert.equal(calls[1].options.headers.get('Content-Type'), 'application/json');
        assert.equal(calls[2].options.headers.get('X-CSRF-TOKEN'), 'session-token');
        assert.equal(calls[2].options.headers.has('Content-Type'), false, 'browser must supply multipart boundary');
        assert.equal(calls[2].options.body, multipart);
        assert.equal(calls[3].options.headers.has('X-CSRF-TOKEN'), false);
    } finally { global.fetch = originalFetch; }
});

test('board initialization waits for the profile and redirects an anonymous session', async () => {
    const apiSource = await readFile(path.join(__dirname, '../public/js/api.js'), 'utf8');
    const stateSource = await readFile(path.join(__dirname, '../public/js/boardstuff/state.js'), 'utf8');
    const originalFetch = global.fetch;
    const originalDocument = global.document;
    const originalWindow = global.window;
    try {
        for (const signedIn of [true, false]) {
            let resolveProfile;
            let callbackRan = false;
            let redirected = false;
            let complete;
            const finished = new Promise(resolve => { complete = resolve; });
            global.fetch = () => new Promise(resolve => { resolveProfile = resolve; });
            global.document = { readyState: 'complete' };
            global.window = { location: { replace(url) {
                assert.equal(url, '/login.html');
                redirected = true;
                complete();
            } } };
            const apiUrl = `data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}#${signedIn}`;
            const source = stateSource.replace("'../api.js'", JSON.stringify(apiUrl));
            const { state, onSessionReady } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
            onSessionReady(() => {
                callbackRan = true;
                assert.equal(state.userId, 2);
                complete();
            });
            assert.equal(callbackRan, false);
            resolveProfile(signedIn ? Response.json({ user_id: 2 }) : new Response('', { status: 401 }));
            await finished;
            assert.equal(callbackRan, signedIn);
            assert.equal(redirected, !signedIn);
        }
    } finally {
        global.fetch = originalFetch;
        global.document = originalDocument;
        global.window = originalWindow;
    }
});

async function loadApi(fetchImpl, label) {
    const vm = require('node:vm');
    const source = (await readFile(path.join(__dirname, '../public/js/api.js'), 'utf8')).replace(/^export /gm, '');
    const context = vm.createContext({ fetch: fetchImpl, Headers });
    vm.runInContext(source, context, { filename: label });
    return context;
}

test('session lookup recovers from network, HTTP, parse and anonymous results', async () => {
    for (const mode of ['network', 'http', 'parse', 'anonymous']) {
        let calls = 0;
        const api = await loadApi(async () => {
            if (++calls > 1) return Response.json({ csrfToken: 'fresh' });
            if (mode === 'network') throw Error('offline');
            if (mode === 'http') return new Response('', { status: 500 });
            if (mode === 'parse') return new Response('invalid JSON');
            return new Response('', { status: 401 });
        }, mode);
        if (mode === 'anonymous') assert.equal(await api.getSession(), null);
        else await assert.rejects(api.getSession());
        assert.equal((await api.getSession()).csrfToken, 'fresh');
        assert.equal(calls, 2);
    }
});

test('401 and 403 invalidate session for the next action without replaying a mutation', async () => {
    for (const status of [401, 403]) {
        let profiles = 0;
        const tokens = [];
        const api = await loadApi(async (url, options) => {
            if (url === '/users/profile') return Response.json({ csrfToken: `token-${++profiles}` });
            tokens.push(options.headers.get('X-CSRF-TOKEN'));
            return new Response('', { status });
        }, 'invalidation');
        assert.equal((await api.apiFetch('/boards/1', { method: 'DELETE' })).status, status);
        assert.deepEqual(tokens, ['token-1']);
        await api.apiFetch('/boards/1', { method: 'DELETE' });
        assert.deepEqual(tokens, ['token-1', 'token-2']);
    }
});

test('stale failures cannot discard a newer profile request', async () => {
    let rejectOld;
    let calls = 0;
    const api = await loadApi(() => ++calls === 1 ? new Promise((resolve, reject) => { rejectOld = reject; })
        : Promise.resolve(Response.json({ csrfToken: 'new' })), 'stale');
    const old = api.getSession();
    assert.equal((await api.getSession({ refresh: true })).csrfToken, 'new');
    rejectOld(Error('old request failed'));
    await assert.rejects(old);
    assert.equal((await api.getSession()).csrfToken, 'new');
    assert.equal(calls, 2);
});

test('a delayed mutation rejection does not invalidate a newer session', async () => {
    let finishMutation;
    let calls = 0;
    const api = await loadApi(url => url === '/users/profile'
        ? Promise.resolve(Response.json({ csrfToken: `token-${++calls}` }))
        : new Promise(resolve => { finishMutation = resolve; }), 'delayed');
    const mutation = api.apiFetch('/boards/1', { method: 'DELETE' });
    await new Promise(resolve => setImmediate(resolve));
    await api.getSession({ refresh: true });
    finishMutation(new Response('', { status: 403 }));
    await mutation;
    assert.equal((await api.getSession()).csrfToken, 'token-2');
    assert.equal(calls, 2);
});

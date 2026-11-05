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

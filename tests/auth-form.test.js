const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const csrf = require('../controllers/csrfController');

function setup({ signup = false, status = 200, failBootstrap = false, pendingBootstrap = false, bootstrapStatus = 200 } = {}) {
    let submit, finishBootstrap;
    const calls = [];
    const button = { disabled: false };
    const error = { innerText: '' };
    const fields = { 'username-input': signup ? { value: 'new-user' } : null,
        'email-input': { value: 'user@example.test' }, 'login-pass': { value: 'password-only' },
        'signup-repeatedPass': { value: 'password-only' }, 'error-message': error,
        form: { querySelector: () => button, addEventListener: (type, handler) => { submit = handler; } } };
    const window = { location: { href: '' } };
    let tokenRequests = 0;
    const context = vm.createContext({ document: { getElementById: id => fields[id] }, window,
        fetch: async (url, options) => {
            calls.push({ url, options });
            if (url === '/users/csrf') {
                tokenRequests++;
                if (failBootstrap && tokenRequests === 1) throw Error('offline');
                const response = bootstrapStatus === 200 ? Response.json({ csrfToken: String(tokenRequests).repeat(64) }) : new Response('Busy', { status: bootstrapStatus, headers: { 'Retry-After': '5' } });
                if (pendingBootstrap && tokenRequests === 1) return new Promise(resolve => { finishBootstrap = () => resolve(response); });
                return response;
            }
            return status === 200 ? Response.json({ redirect: '/home.html' }) : new Response('Rejected', { status, headers: { 'Retry-After': '5' } });
        }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/login.js'), 'utf8'), context);
    return { calls, button, error, window, fields, finish: () => finishBootstrap(),
        submit: () => submit({ preventDefault() {} }) };
}

for (const signup of [false, true]) {
    test(`${signup ? 'signup' : 'login'} waits for bootstrap and sends one token-protected request`, async () => {
        const view = setup({ signup, pendingBootstrap: true });
        const pending = view.submit();
        await view.submit();
        assert.equal(view.calls.length, 1);
        assert.equal(view.button.disabled, true);
        view.finish();
        await pending;
        assert.equal(view.calls.length, 2);
        assert.equal(view.calls[1].url, signup ? '/users/signup' : '/users/login');
        assert.equal(view.calls[1].options.headers['X-CSRF-TOKEN'], '1'.repeat(64));
        assert.equal(view.calls[1].options.credentials, 'same-origin');
        assert.equal(JSON.parse(view.calls[1].options.body).password, 'password-only');
        assert.equal(view.window.location.href, '/home.html');
    });
}

test('bootstrap failure is recoverable without submitting credentials prematurely', async () => {
    const view = setup({ failBootstrap: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(view.calls.length, 1);
    assert.equal(view.window.location.href, '');
    await view.submit();
    assert.equal(view.calls.filter(c => c.url === '/users/login').length, 1);
    assert.equal(view.window.location.href, '/home.html');
});

for (const status of [401, 403, 429, 500, 503]) {
    test(`credential failure ${status} preserves input and never retries automatically`, async () => {
        const view = setup({ status });
        await view.submit();
        assert.equal(view.calls.filter(c => c.url === '/users/login').length, 1);
        assert.equal(view.window.location.href, '');
        assert.equal(view.button.disabled, false);
        assert.equal(view.fields['login-pass'].value, 'password-only');
        assert.ok(view.error.innerText);
        await view.submit();
        const posts = view.calls.filter(c => c.url === '/users/login');
        assert.equal(posts.length, 2);
        assert.equal(posts[1].options.headers['X-CSRF-TOKEN'], '2'.repeat(64));
    });
}

test('bootstrap returns no token before persistence and reports save failure', () => {
    for (const fails of [false, true]) {
        let saved;
        const req = { session: { save(callback) { saved = callback; } } };
        const res = { code: 200, set() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
        csrf(req, res);
        assert.equal(res.body, undefined);
        saved(fails ? Error('save failed') : undefined);
        assert.equal(res.code, fails ? 500 : 200);
        if (fails) assert.equal(res.body.csrfToken, undefined);
        else assert.match(res.body.csrfToken, /^[a-f0-9]{64}$/);
    }
});

for (const bootstrapStatus of [429, 503]) {
    test(`bootstrap capacity ${bootstrapStatus} shows retry delay and never posts credentials`, async () => {
        const view = setup({ bootstrapStatus });
        await view.submit();
        assert.equal(view.calls.filter(c => c.url === '/users/login').length, 0);
        assert.match(view.error.innerText, /Wait 5 seconds/);
        assert.equal(view.fields['login-pass'].value, 'password-only');
        assert.equal(view.button.disabled, false);
    });
}

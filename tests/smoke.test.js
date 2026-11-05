
    
  
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { before, after, test } = require('node:test');

// These checks must not depend on a developer's database or .env credentials.
process.env.DOTENV_CONFIG_PATH = '__smoke_test_no_env__';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_USER = 'smoke_test';
process.env.DB_PASSWORD = 'unused';
process.env.DB_NAME = 'smoke_test';

const app = require('../app');
let server;
let baseUrl;

before(async () => {
    server = await new Promise((resolve, reject) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        listener.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
            server.closeAllConnections();
        });
    }
});

test('root redirects to the landing page', async () => {
    const response = await fetch(baseUrl, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/landingpage.html');
});

test('landing page is served as HTML', async () => {
    const response = await fetch(`${baseUrl}/landingpage.html`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /Savvit/i);
});

for (const path of ['/users/profile', '/boards/users/1/boards', '/pins']) {
    test(`anonymous GET ${path} is rejected before database access`, async () => {
        const response = await fetch(`${baseUrl}${path}`);
        assert.equal(response.status, 401);
    });
}

test('a board mutation without a CSRF token is rejected', async () => {
    const response = await fetch(`${baseUrl}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Smoke test', user_id: 1 })
    });
    assert.equal(response.status, 403);
    assert.equal(await response.text(), 'Invalid CSRF Token');
});


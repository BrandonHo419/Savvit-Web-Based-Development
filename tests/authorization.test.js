const assert = require('node:assert/strict');
const { before, beforeEach, after, test } = require('node:test');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const fs = require('node:fs');
const path = require('node:path');

// Exercise real HTTP routing, Passport, sessions and CSRF with a deterministic
// database substitute. This suite does not validate MySQL SQL execution.
process.env.DOTENV_CONFIG_PATH = '__authorization_test_no_env__';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = require('node:crypto').randomBytes(32).toString('hex');

const password = 'test-password-only';
const users = [1, 2, 3].map(id => ({
    user_id: id, username: `user${id}`, email: `user${id}@example.test`,
    password_hash: bcrypt.hashSync(password, 4), role: id === 3 ? 'admin' : 'user'
}));
const boards = [
    { board_id: 10, user_id: 1, visibility: 'private' },
    { board_id: 11, user_id: 1, visibility: 'public' },
    { board_id: 20, user_id: 2, visibility: 'private' },
    { board_id: 21, user_id: 2, visibility: 'public' }
];
const pins = boards.map(b => ({
    pin_id: b.board_id * 10, board_id: b.board_id, user_id: b.user_id,
    image_url: `/uploads/${b.board_id}.png`
}));
const imageFixtures = require('./image-fixtures.cjs');
const validPng = imageFixtures.png;
let failPinInsert = false;
let missingDeletionLock = false;
let failPinDeletion = false;
const writes = [];
const savedPins = new Set();
let failSaveEngagement = false;
let failReferenceRemoval = false;
let failBoardDeletion = '';
let missingLockedBoard = false;
const boardFollows = new Set();
const boardViewers = new Set();
let failSharing = false;
const readable = (b, id) => b.user_id === id || b.visibility === 'public' || (b.visibility === 'semi-private' && boardViewers.has(`${b.board_id}:${id}`));
let failBoardUpdate = false;
const uploadDirectory = path.join(__dirname, '../public/uploads');
const uploadFilename = `authorization-test-${require('node:crypto').randomUUID()}.png`;
const uploadPath = path.join(uploadDirectory, uploadFilename);
const hadUploadDirectory = fs.existsSync(uploadDirectory);
pins[0].image_url = `/uploads/${uploadFilename}`;
let failLookup = false;
let failUserLookup = false;

async function query(sql, params = []) {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.startsWith('UPDATE pins p JOIN boards b')) {
        assert.match(q, /WHERE p.pin_id = \? AND p.user_id = \? AND b.user_id = \?$/);
        const pin = pins.find(p => p.pin_id === Number(params[3]) && p.user_id === params[4]
            && boards.some(b => b.board_id === p.board_id && b.user_id === params[5]));
        if (pin) Object.assign(pin, { title: params[0], description: params[1], link_url: params[2] });
        return [{ affectedRows: pin ? 1 : 0 }];
    }
    if (failPinInsert && q.startsWith('INSERT INTO pins')) throw new Error('Simulated pin insert failure');
    if (failLookup) throw new Error('Simulated database outage');
    if (q.startsWith('SELECT b.board_id, b.name, b.description, b.visibility, u.username AS owner_name')) {
        assert.match(q, /b.visibility = 'semi-private' AND b.user_id <> \?/);
        assert.match(q, /access.board_id = b.board_id AND access.user_id = \?/);
        assert.equal(params[0], params[1]);
        return [boards.filter(b => b.visibility === 'semi-private' && b.user_id !== params[0]
            && boardViewers.has(`${b.board_id}:${params[1]}`) && (b.name || '').includes(params[2]))
            .sort((a,b) => b.board_id - a.board_id).slice(params[4], params[4] + params[3])
            .map(b => ({ board_id: b.board_id, name: b.name, visibility: b.visibility, owner_name: `user${b.user_id}` }))];
    }
    if (q.startsWith('SELECT b.board_id, b.name, b.description, u.username AS owner_name')) {
        assert.match(q, /WHERE b.visibility = 'public' AND LOCATE\(\?, b.name\) > 0/);
        assert.match(q, /ORDER BY b.created_at DESC, b.board_id DESC LIMIT \? OFFSET \?/);
        assert.equal(params[1], 21);
        return [boards.filter(b => b.visibility === 'public' && (b.name || '').includes(params[0]))
            .sort((a, b) => b.board_id - a.board_id).slice(params[2], params[2] + params[1])
            .map(b => ({ board_id: b.board_id, name: b.name, description: b.description, owner_name: `user${b.user_id}` }))];
    }
    if (q.startsWith('UPDATE boards SET')) {
        if (failBoardUpdate) throw new Error('Simulated board update failure');
        assert.match(q, /WHERE board_id = \? AND user_id = \?$/);
        const board = boards.find(b => b.board_id === Number(params.at(-2)) && b.user_id === params.at(-1));
        const fields = q.slice('UPDATE boards SET '.length, q.indexOf(' WHERE')).split(', ').map(field => field.split(' = ')[0]);
        assert.ok(fields.every(field => ['name', 'description', 'visibility'].includes(field)));
        if (board) fields.forEach((field, i) => { board[field] = params[i]; });
        writes.push({ sql: q, params });
        return [{ affectedRows: board ? 1 : 0 }];
    }
    if (q.includes('board_viewers') && !q.includes('EXISTS')) {
        if (failSharing) throw new Error('Simulated sharing failure');
        if (q.startsWith('INSERT IGNORE INTO board_viewers')) {
            boardViewers.add(`${params[0]}:${params[1]}`);
            return [{ affectedRows: 1 }];
        }
        if (q.startsWith('DELETE FROM board_viewers')) {
            boardViewers.delete(`${params[0]}:${params[1]}`);
            return [{ affectedRows: 1 }];
        }
        if (q.startsWith('SELECT u.user_id, u.username')) {
            return [users.filter(u => boardViewers.has(`${params[0]}:${u.user_id}`)).map(({ user_id, username }) => ({ user_id, username }))];
        }
        if (q.startsWith('SELECT user_id FROM board_viewers')) return [boardViewers.has(`${params[0]}:${params[1]}`) ? [{ user_id: params[1] }] : []];
        throw new Error(`Unexpected sharing query: ${q}`);
    }
    if (q.startsWith('SELECT user_id FROM users WHERE CAST(username AS BINARY)')) return [users.filter(u => u.username === params[0])];
    if (failPinDeletion && q === 'DELETE FROM image_metadata WHERE pin_id = ?') throw new Error('Private SQL failure');
    if (q.startsWith('SELECT p.pin_id FROM pins p JOIN boards b')) {
        if (missingDeletionLock) return [[]];
        assert.match(q, /p.user_id = \? AND b.user_id = \? FOR UPDATE$/);
        return [pins.filter(p => p.pin_id === Number(params[0]) && p.user_id === params[1]
            && boards.some(b => b.board_id === p.board_id && b.user_id === params[2]))];
    }
    if (q === 'SELECT board_id FROM boards WHERE board_id = ? AND user_id = ? FOR UPDATE') {
        return [missingLockedBoard ? [] : boards.filter(b => b.board_id === Number(params[0]) && b.user_id === params[1])];
    }
    if (q === 'SELECT pin_id FROM pins WHERE board_id = ? LIMIT 1 FOR UPDATE') {
        return [pins.filter(p => p.board_id === Number(params[0])).slice(0, 1)];
    }
    if (['DELETE FROM board_pins WHERE board_id = ?', 'DELETE FROM board_follows WHERE board_id = ?',
        'DELETE FROM boards WHERE board_id = ? AND user_id = ?'].includes(q)) {
        if (q.includes(failBoardDeletion) && failBoardDeletion) throw new Error('Simulated board deletion failure');
        if (q.startsWith('DELETE FROM boards ')) {
            const index = boards.findIndex(b => b.board_id === Number(params[0]) && b.user_id === params[1]);
            if (index >= 0) boards.splice(index, 1);
            for (const key of boardViewers) if (key.startsWith(`${params[0]}:`)) boardViewers.delete(key);
        } else {
            const target = q.includes('board_pins') ? savedPins : boardFollows;
            for (const key of target) if (key.startsWith(`${params[0]}:`)) target.delete(key);
        }
        writes.push({ sql: q, params });
        return [{ affectedRows: 1 }];
    }
    if (q.startsWith('DELETE saved FROM board_pins saved')) {
        if (failReferenceRemoval) throw new Error('Simulated reference removal failure');
        assert.match(q, /destination.user_id = \?/);
        assert.match(q, /original.board_id <> saved.board_id/);
        const board = boards.find(b => b.board_id === Number(params[0]) && b.user_id === params[2]);
        const pin = pins.find(p => p.pin_id === Number(params[1]));
        const removed = board && pin && pin.board_id !== board.board_id
            && savedPins.delete(`${board.board_id}:${pin.pin_id}`);
        writes.push({ sql: q, params });
        return [{ affectedRows: removed ? 1 : 0 }];
    }
    if (q.startsWith('INSERT IGNORE INTO board_pins')) {
        const key = `${params[0]}:${params[1]}`;
        const exists = savedPins.has(key);
        savedPins.add(key);
        writes.push({ sql: q, params });
        return [{ affectedRows: exists ? 0 : 1 }];
    }
    if (failSaveEngagement && q.includes("VALUES (?, ?, 'save')")) throw new Error('Simulated engagement failure');
    if (/^(INSERT|UPDATE|DELETE)/.test(q)) {
        writes.push({ sql: q, params });
        return [{ insertId: 900, affectedRows: 1 }];
    }
    if (q.startsWith('SELECT board_id, user_id, visibility, name, description FROM boards')) {
        return [boards.filter(b => b.board_id === Number(params[0]))];
    }
    if (q.startsWith('SELECT p.pin_id, p.user_id, b.user_id')) {
        return [pins.filter(p => p.pin_id === Number(params[0])).map(p => {
            const board = boards.find(b => b.board_id === p.board_id);
            return { ...p, board_owner_id: board.user_id, visibility: board.visibility };
        })];
    }
    if (q.startsWith('SELECT b.user_id, b.visibility, b.board_id FROM pins')) {
        return [pins.filter(p => p.image_url === params[0]).map(p => boards.find(b => b.board_id === p.board_id))];
    }
    if (q.startsWith('SELECT pin_id FROM comments')) {
        return [Number(params[0]) === 1000 ? [{ pin_id: 100 }] : []];
    }
    if (q.startsWith('SELECT reply_id FROM replies')) {
        return [Number(params[0]) === 1001 && Number(params[1]) === 1000 ? [{ reply_id: 1001 }] : []];
    }
    if (q.startsWith('SELECT * FROM engagements')) return [[]];
    if (q.startsWith('SELECT COUNT(*) AS like_count')) return [[{ like_count: 1 }]];
    if (q.startsWith('SELECT * FROM pins WHERE pin_id')) {
        return [pins.filter(p => p.pin_id === Number(params[0]) && p.user_id === Number(params[1]))];
    }
    if (q.startsWith('SELECT p.*, u.username, COUNT')) {
        assert.equal(params[0], params[3], 'like and visibility identities must match');
        assert.match(q, /EXISTS \( SELECT 1 FROM board_pins/);
        return [pins.filter(p => {
            const original = boards.find(b => b.board_id === p.board_id);
            return (p.board_id === Number(params[1]) || savedPins.has(`${params[2]}:${p.pin_id}`))
                && readable(original, params[3]);
        })];
    }
    if (q.startsWith('SELECT p.*, u.username')) {
        if (q.includes('WHERE p.pin_id = ?')) return [pins.filter(p => p.pin_id === Number(params[0]))];
        assert.match(q, /JOIN boards b ON b.board_id = p.board_id/);
        assert.match(q, /WHERE b.user_id = \? OR b.visibility = 'public'/);
        return [pins.filter(p => {
            const b = boards.find(b => b.board_id === p.board_id);
            return readable(b, params[0]);
        })];
    }
    if (q.startsWith('SELECT b.board_id,')) {
        assert.match(q, /b.user_id = \? AND \(b.user_id = \? OR b.visibility = 'public'/);
        assert.match(q, /EXISTS \( SELECT 1 FROM board_pins/);
        return [boards.filter(b => b.user_id === Number(params[4]) && readable(b, params[5])).map(b => ({
            ...b,
            pin_count: pins.filter(p => {
                const original = boards.find(board => board.board_id === p.board_id);
                return (p.board_id === b.board_id || savedPins.has(`${b.board_id}:${p.pin_id}`))
                    && readable(original, params[1]);
            }).length
        }))];
    }
    if (q.startsWith('SELECT c.*, u.username')) return [[]];
    throw new Error(`Unexpected test database query: ${q}`);
}

require.cache[require.resolve('../models/db')] = {
    id: require.resolve('../models/db'), filename: require.resolve('../models/db'),
    loaded: true, exports: { query, async getConnection() {
        let snapshot;
        let writeCount;
        let boardSnapshot;
        let followSnapshot;
        let viewerSnapshot;
        return {
            async beginTransaction() { snapshot = new Set(savedPins); writeCount = writes.length; boardSnapshot = boards.map(b => ({ ...b })); followSnapshot = new Set(boardFollows); viewerSnapshot = new Set(boardViewers); },
            query,
            async commit() {},
            async rollback() { savedPins.clear(); snapshot.forEach(key => savedPins.add(key)); writes.length = writeCount; boards.splice(0, boards.length, ...boardSnapshot); boardFollows.clear(); followSnapshot.forEach(key => boardFollows.add(key)); boardViewers.clear(); viewerSnapshot.forEach(key => boardViewers.add(key)); },
            release() {}
        };
    } }
};
const originalCreatePool = mysql.createPool;
mysql.createPool = () => ({
    query(sql, params, callback) {
        if (failUserLookup) return callback(new Error('Simulated user lookup outage'));
        const field = sql.includes('email =') ? 'email' : 'user_id';
        callback(null, users.filter(user => user[field] === params[0]));
    },
    getConnection(callback) {
        callback(null, {
            release() {},
            query(sql, params, done) {
                if (typeof params === 'function') return params(null, users.map(({ password_hash, ...user }) => user));
                if (sql.startsWith('SELECT')) return done(null, []);
                writes.push({ sql, params });
                done(null, { affectedRows: 1, insertId: 900 });
            }
        });
    }
});
// Isolate throttle windows between tests without changing session wall-clock time
// or disabling the production limiter. Each test still exercises real quotas.
const throttleModule = require('../middleware/authThrottle');
const originalThrottleFactory = throttleModule.createAuthThrottle;
let throttleTime = 0;
throttleModule.createAuthThrottle = () => originalThrottleFactory({ now: () => throttleTime });
const app = require('../app');
throttleModule.createAuthThrottle = originalThrottleFactory;
beforeEach(() => { throttleTime += 3600000; });
mysql.createPool = originalCreatePool;
let server;
let baseUrl;
let alice;
let bob;
let admin;

async function request(path, { actor, method = 'GET', body, token = actor?.token, authCsrf = true } = {}) {
    // Normal credential tests perform the same bootstrap as the browser form.
    // Negative CSRF tests opt out explicitly.
    if (authCsrf && method === 'POST' && ['/users/login', '/users/signup'].includes(path)) {
        const bootstrap = await request('/users/csrf', { actor });
        const cookie = bootstrap.headers.getSetCookie().at(-1)?.split(';')[0] || actor?.cookie;
        token = (await bootstrap.json()).csrfToken;
        actor = { cookie, token };
    }
    const headers = {};
    if (actor) headers.Cookie = actor.cookie;
    if (token) headers['X-CSRF-TOKEN'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(`${baseUrl}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual'
    });
}

async function login(id) {
    const response = await request('/users/login', {
        method: 'POST', body: { email: `user${id}@example.test`, password }
    });
    assert.equal(response.status, 200);
    return { cookie: response.headers.get('set-cookie').split(';')[0], token: (await response.json()).csrfToken };
}

before(async () => {
    fs.mkdirSync(uploadDirectory, { recursive: true });
    fs.writeFileSync(uploadPath, validPng, { flag: 'wx' });
    server = await new Promise((resolve, reject) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        listener.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    alice = await login(1);
    bob = await login(2);
    admin = await login(3);
});

after(async () => {
    if (server) await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
    });
    fs.unlinkSync(uploadPath);
    if (!hadUploadDirectory) fs.rmdirSync(uploadDirectory);
});

test('profile provides session identity and CSRF without password data', async () => {
    for (const [actor, id] of [[alice, 1], [bob, 2]]) {
        const response = await request('/users/profile', { actor });
        assert.match(response.headers.get('cache-control'), /no-store/);
        const profile = await response.json();
        assert.equal(profile.user_id, id);
        assert.equal(profile.csrfToken, actor.token);
        assert.equal(profile.password_hash, undefined);
    }
});

test('private boards, pins and comments reject the other account without writes', async () => {
    const count = writes.length;
    for (const [actor, board, pin] of [[alice, 20, 200], [bob, 10, 100]]) {
        for (const path of [`/boards/${board}/pins?user_id=2`, `/pins/${pin}`, `/pins/${pin}/comments`]) {
            assert.equal((await request(path, { actor })).status, 404, path);
        }
        for (const suffix of ['like', 'comments', 'save']) {
            assert.equal((await request(`/pins/${pin}/${suffix}`, {
                actor, method: 'POST', body: { user_id: 2, content: 'forged', board_id: 10 }
            })).status, 404);
        }
    }
    assert.equal(writes.length, count);
});

test('public reads and owner reads work, while lists exclude other private content', async () => {
    assert.equal((await request('/pins/100', { actor: alice })).status, 200);
    assert.equal((await request('/pins/210', { actor: alice })).status, 200);
    assert.equal((await request('/boards/10/pins?user_id=2', { actor: alice })).status, 200);
    const own = await (await request('/boards/users/1/boards', { actor: alice })).json();
    assert.deepEqual(own.map(b => b.board_id), [10, 11]);
    const other = await (await request('/boards/users/2/boards', { actor: alice })).json();
    assert.deepEqual(other.map(b => b.board_id), [21]);
    const visible = await (await request('/pins', { actor: alice })).json();
    assert.deepEqual(visible.map(p => p.pin_id), [100, 110, 210]);
});

test('forged identity cannot create boards or pins as another account', async () => {
    let response = await request('/boards', { actor: alice, method: 'POST', body: { name: 'Mine', user_id: 2 } });
    assert.equal(response.status, 201);
    assert.deepEqual(writes.at(-1).params, ['Mine', 1]);
    assert.match(writes.at(-1).sql, /'private'/);
    for (const provider of ['youtube', 'pixabay']) {
        const body = { title: 'Pin', destination: 'https://example.test', img_blob: 'https://example.test/image.png', board_id: 10, user_id: 2 };
        response = await request(`/pins/${provider}`, { actor: alice, method: 'POST', body });
        assert.equal(response.status, 201);
        assert.equal(writes.at(-1).params[4], 1);
        const count = writes.length;
        response = await request(`/pins/${provider}`, { actor: alice, method: 'POST', body: { ...body, board_id: 21 } });
        assert.equal(response.status, 404);
        assert.equal(writes.length, count);
    }
});

test('public visibility never grants mutation rights or destination ownership', async () => {
    const count = writes.length;
    for (const [path, method, body] of [
        ['/pins/210', 'DELETE', { user_id: 2 }],
        ['/pins/210/move', 'PUT', { user_id: 2, board_id: 10 }],
        ['/pins/100/move', 'PUT', { board_id: 21 }],
        ['/pins/110/save', 'POST', { board_id: 21 }]
    ]) {
        assert.equal((await request(path, { actor: alice, method, body })).status, 404, path);
    }
    assert.equal(writes.length, count);
    assert.equal((await request('/pins/210/save', { actor: alice, method: 'POST', body: { board_id: 10 } })).status, 200);
    assert.equal((await request('/pins/100/move', { actor: alice, method: 'PUT', body: { board_id: 11 } })).status, 200);
    assert.deepEqual(writes.at(-1).params, [11, '100', 1]);
    assert.equal((await request('/pins/100', { actor: alice, method: 'DELETE', body: { user_id: 2 } })).status, 200);
});

test('imports cannot claim a private local upload as their own image', async () => {
    const count = writes.length;
    for (const provider of ['youtube', 'pixabay']) {
        const response = await request(`/pins/${provider}`, {
            actor: bob, method: 'POST', body: {
                title: 'Forged image', destination: 'https://example.test',
                img_blob: pins[0].image_url, board_id: 21
            }
        });
        assert.equal(response.status, 400);
    }
    assert.equal(writes.length, count);
});

test('multipart pins use session ownership and clean up rejected foreign-board uploads', async () => {
    const beforeFiles = fs.readdirSync(uploadDirectory).sort();
    for (const [boardId, expectedStatus] of [[21, 404], [10, 201]]) {
        const form = new FormData();
        form.set('title', 'Uploaded pin');
        form.set('link_url', 'https://example.test');
        form.set('board_id', String(boardId));
        form.set('user_id', '2');
        form.set('image', new Blob([validPng], { type: 'image/png' }), 'test.png');
        const count = writes.length;
        const response = await fetch(`${baseUrl}/pins`, {
            method: 'POST', headers: { Cookie: alice.cookie, 'X-CSRF-TOKEN': alice.token }, body: form
        });
        assert.equal(response.status, expectedStatus);
        if (expectedStatus === 201) {
            const result = await response.json();
            try {
                assert.equal(writes.at(-1).params[4], 1);
                assert.equal(writes.at(-1).params[5], 'private');
            } finally { fs.unlinkSync(path.join(uploadDirectory, result.fileName)); }
        } else {
            assert.equal(writes.length, count);
        }
        assert.deepEqual(fs.readdirSync(uploadDirectory).sort(), beforeFiles);
    }
});

test('likes, comments and replies use the authenticated identity', async () => {
    assert.equal((await request('/pins/210/like', { actor: alice, method: 'POST', body: { user_id: 2 } })).status, 200);
    assert.deepEqual(writes.at(-1).params, [1, '210']);
    assert.equal((await request('/pins/210/comments', { actor: alice, method: 'POST', body: { user_id: 2, content: 'Hello' } })).status, 201);
    assert.equal(writes.at(-1).params[0], 1);
    assert.equal((await request('/pins/comments/1000/replies', { actor: alice, method: 'POST', body: { user_id: 2, content: 'Reply', parent_reply_id: 1001 } })).status, 201);
    assert.equal(writes.at(-1).params[2], 1);
    const count = writes.length;
    assert.equal((await request('/pins/comments/1000/replies', { actor: bob, method: 'POST', body: { content: 'Forbidden' } })).status, 404);
    assert.equal((await request('/pins/comments/1000/replies', { actor: alice, method: 'POST', body: { content: 'Wrong thread', parent_reply_id: 9999 } })).status, 404);
    assert.equal(writes.length, count);
});

test('administration requires a server-side admin role', async () => {
    const count = writes.length;
    for (const actor of [alice, bob]) {
        assert.equal((await request('/users/user_info', { actor })).status, 403);
        for (const path of ['/users/admin_add_user', '/users/admin_del_user']) {
            assert.equal((await request(path, { actor, method: 'POST', body: { user_id: 2 } })).status, 403);
        }
    }
    assert.equal(writes.length, count);
    assert.equal((await request('/users/user_info', { actor: admin })).status, 200);
    assert.equal((await request('/users/admin_del_user', { actor: admin, method: 'POST', body: { user_id: 2 } })).status, 200);
    assert.equal((await request('/users/admin_del_user', { actor: admin, method: 'POST', body: { user_id: 3 } })).status, 403);
});

test('a CSRF token from another session cannot authorize a mutation', async () => {
    const count = writes.length;
    assert.equal((await request('/boards', { actor: alice, token: bob.token, method: 'POST', body: { name: 'No' } })).status, 403);
    assert.equal(writes.length, count);
});

test('pin editing requires ownership and CSRF, validates metadata and preserves original membership', async () => {
    const body = { title: '  Updated title  ', description: 'Notes', link_url: 'https://example.test/page' };
    const original = { ...pins[0] };
    try {
        assert.equal((await request('/pins/100', { method: 'PATCH', body })).status, 403);
        assert.equal((await request('/pins/100', { actor: alice, method: 'PATCH', body, token: 'invalid' })).status, 403);
        for (const actor of [bob, admin]) {
            assert.equal((await request('/pins/100', { actor, method: 'PATCH', body })).status, 404);
        }
        for (const change of [{ title: '' }, { title: 'x'.repeat(256) }, { description: null }, { description: 'x'.repeat(10001) }, { link_url: 'javascript:alert(1)' }, { link_url: 'https://user:pass@example.test' }]) {
            assert.equal((await request('/pins/100', { actor: alice, method: 'PATCH', body: { ...body, ...change } })).status, 400);
        }
        const response = await request('/pins/100', { actor: alice, method: 'PATCH', body: { ...body, user_id: 2, board_id: 20 } });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).title, 'Updated title');
        assert.equal(pins[0].board_id, original.board_id);
        assert.equal(pins[0].user_id, original.user_id);
        assert.equal(pins[0].image_url, original.image_url);
    } finally { Object.keys(pins[0]).forEach(key => delete pins[0][key]); Object.assign(pins[0], original); }
});

test('private upload URLs reject other accounts before static delivery', async () => {
    const url = `/uploads/${uploadFilename}`;
    const response = await request(url, { actor: alice });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), validPng);
    assert.match(response.headers.get('cache-control'), /no-store/);
    for (const candidate of [url, `/%75ploads/${uploadFilename}`, `/uploads%2F${uploadFilename}`]) {
        assert.equal((await request(candidate, { actor: bob })).status, 404, candidate);
        assert.equal((await request(candidate)).status, 401, candidate);
    }
});

test('invalid IDs and missing resources fail closed', async () => {
    for (const path of ['/pins/abc', '/pins/-1', '/pins/999', '/boards/20x/pins']) {
        assert.equal((await request(path, { actor: alice })).status, 404);
    }
    assert.equal((await request('/boards/users/2x/boards', { actor: alice })).status, 400);
});

test('database failures return an error without granting access or hanging login', async () => {
    try {
        failLookup = true;
        assert.equal((await request('/pins/100', { actor: alice })).status, 500);
    } finally { failLookup = false; }
    try {
        failUserLookup = true;
        assert.equal((await request('/users/login', { method: 'POST', body: { email: users[0].email, password } })).status, 500);
        assert.equal((await request('/users/profile', { actor: alice })).status, 500);
    } finally { failUserLookup = false; }
});


test('saved references appear once without moving the original and inherit its privacy', async () => {
    savedPins.clear();
    const count = writes.length;
    for (let i = 0; i < 2; i++) {
        assert.equal((await request('/pins/100/save', { actor: alice, method: 'POST', body: { board_id: 11 } })).status, 200);
    }
    assert.equal(pins.find(p => p.pin_id === 100).board_id, 10);
    assert.equal(writes.slice(count).filter(w => w.sql.includes("VALUES (?, ?, 'save')")).length, 1);
    const ownerPins = await (await request('/boards/11/pins', { actor: alice })).json();
    assert.deepEqual(ownerPins.map(p => p.pin_id), [100, 110]);
    const guestPins = await (await request('/boards/11/pins', { actor: bob })).json();
    assert.deepEqual(guestPins.map(p => p.pin_id), [110]);
    const ownerBoards = await (await request('/boards/users/1/boards', { actor: alice })).json();
    const guestBoards = await (await request('/boards/users/1/boards', { actor: bob })).json();
    assert.equal(ownerBoards.find(b => b.board_id === 11).pin_count, 2);
    assert.equal(guestBoards.find(b => b.board_id === 11).pin_count, 1);
});

test('saved references stop appearing when the original board becomes private', async () => {
    assert.equal((await request('/pins/210/save', { actor: alice, method: 'POST', body: { board_id: 10 } })).status, 200);
    const originalBoard = boards.find(b => b.board_id === 21);
    assert.ok((await (await request('/boards/10/pins', { actor: alice })).json()).some(p => p.pin_id === 210));
    try {
        originalBoard.visibility = 'private';
        assert.ok(!(await (await request('/boards/10/pins', { actor: alice })).json()).some(p => p.pin_id === 210));
        assert.equal((await request('/pins/210', { actor: alice })).status, 404);
    } finally { originalBoard.visibility = 'public'; }
});

test('failed reference saves roll back membership', async () => {
    savedPins.delete('11:210');
    try {
        failSaveEngagement = true;
        assert.equal((await request('/pins/210/save', { actor: alice, method: 'POST', body: { board_id: 11 } })).status, 500);
        assert.equal(savedPins.has('11:210'), false);
    } finally { failSaveEngagement = false; }
});

test('board details respect visibility and report ownership', async () => {
    assert.equal((await request('/boards/10', { actor: bob })).status, 404);
    const ownerBoard = await (await request('/boards/10', { actor: alice })).json();
    const publicBoard = await (await request('/boards/11', { actor: bob })).json();
    assert.equal(ownerBoard.is_owner, true);
    assert.equal(publicBoard.is_owner, false);
});


test('owners can edit settings partially, clear descriptions and repeat updates', async () => {
    const original = { ...boards[0] };
    try {
        for (let i = 0; i < 2; i++) {
            const response = await request('/boards/10', { actor: alice, method: 'PATCH', body: { name: '  <b>My board</b>  ', description: '  Notes  ' } });
            assert.equal(response.status, 200);
        }
        const board = await (await request('/boards/10', { actor: alice })).json();
        assert.equal(board.name, '<b>My board</b>');
        assert.equal(board.description, 'Notes');
        assert.equal(board.visibility, 'private');
        assert.equal(board.user_id, 1);
        assert.equal((await request('/boards/10', { actor: alice, method: 'PATCH', body: { description: '' } })).status, 200);
        assert.equal(boards[0].description, '');
    } finally { boards[0] = original; }
});

test('board settings reject nonowners, forged identities, invalid IDs and CSRF failures without writes', async () => {
    const count = writes.length;
    for (const actor of [bob, admin]) {
        for (const id of [10, 11]) {
            assert.equal((await request(`/boards/${id}`, { actor, method: 'PATCH', body: { name: 'Hijack' } })).status, 404);
        }
    }
    for (const id of ['abc', '-1', '999', '10x']) {
        assert.equal((await request(`/boards/${id}`, { actor: alice, method: 'PATCH', body: { name: 'No' } })).status, 404);
    }
    for (const token of [undefined, bob.token]) {
        assert.equal((await request('/boards/10', { actor: alice, token: token || '', method: 'PATCH', body: { name: 'No' } })).status, 403);
    }
    assert.equal((await request('/boards/10', { method: 'PATCH', body: { name: 'No' } })).status, 403);
    assert.equal((await request('/boards/10', { actor: alice, method: 'PATCH', body: { user_id: 2, name: 'No' } })).status, 400);
    assert.equal(writes.length, count);
});

test('board settings validate the complete request before writing', async () => {
    const count = writes.length;
    for (const body of [{}, [], { name: null }, { name: '  ' }, { name: 'x'.repeat(256) },
        { description: null }, { description: {} }, { description: 'x'.repeat(10001) },
        { visibility: 'unknown' }, { visibility: 'PUBLIC' }, { visibility: null },
        { name: 'Valid', visibility: 'invalid' }, { board_id: 20 }, { extra: true }]) {
        assert.equal((await request('/boards/10', { actor: alice, method: 'PATCH', body })).status, 400);
    }
    assert.equal(writes.length, count);
});

test('visibility updates enforce original-pin privacy across references and uploads', async () => {
    const original = { ...boards[0] };
    savedPins.add('21:100');
    try {
        assert.equal((await request('/boards/10', { actor: alice, method: 'PATCH', body: { visibility: 'public' } })).status, 200);
        assert.equal((await request('/boards/10', { actor: bob })).status, 200);
        assert.equal((await request('/pins/100', { actor: bob })).status, 200);
        assert.equal((await request(`/uploads/${uploadFilename}`, { actor: bob })).status, 200);
        assert.ok((await (await request('/boards/21/pins', { actor: bob })).json()).some(pin => pin.pin_id === 100));
        assert.equal((await request('/boards/10', { actor: alice, method: 'PATCH', body: { visibility: 'private' } })).status, 200);
        for (const url of ['/boards/10', '/boards/10/pins', '/pins/100', '/pins/100/comments', `/uploads/${uploadFilename}`]) {
            assert.equal((await request(url, { actor: bob })).status, 404);
        }
        assert.ok(!(await (await request('/boards/21/pins', { actor: bob })).json()).some(pin => pin.pin_id === 100));
        assert.equal((await request('/pins/100', { actor: alice })).status, 200);
    } finally { boards[0] = original; savedPins.delete('21:100'); }
});

test('failed board updates return a generic error without altering settings', async () => {
    const original = { ...boards[0] };
    try {
        failBoardUpdate = true;
        const response = await request('/boards/10', { actor: alice, method: 'PATCH', body: { name: 'No' } });
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: 'Failed to update board' });
        assert.deepEqual(boards[0], original);
    } finally { failBoardUpdate = false; }
});


test('public discovery lists public boards from all owners without private metadata', async () => {
    const response = await request('/boards/public', { actor: bob });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const result = await response.json();
    assert.deepEqual(result.boards.map(b => b.board_id), [21, 11]);
    assert.equal(result.has_more, false);
    assert.equal(result.page, 1);
    assert.ok(result.boards.every(b => !('user_id' in b) && !('image_url' in b)));
    assert.equal((await request('/boards/public')).status, 401);
});

test('discovery searches literal names, paginates, and removes newly private boards', async () => {
    const original = boards.length;
    try {
        for (let i = 0; i < 25; i++) boards.push({ board_id: 1000 + i, user_id: 1, visibility: 'public', name: 'Find %_ board' });
        boards.push({ board_id: 2000, user_id: 1, visibility: 'private', name: 'Find %_ board' });
        const url = '/boards/public?q=' + encodeURIComponent('%_');
        const first = await (await request(url, { actor: bob })).json();
        const second = await (await request(url + '&page=2', { actor: bob })).json();
        assert.equal(first.boards.length, 20);
        assert.equal(first.has_more, true);
        assert.equal(second.boards.length, 5);
        assert.equal(second.has_more, false);
        assert.equal(new Set([...first.boards, ...second.boards].map(b => b.board_id)).size, 25);
        assert.equal((await request('/boards/1024', { actor: alice, method: 'PATCH', body: { visibility: 'private' } })).status, 200);
        const updated = await (await request(url, { actor: bob })).json();
        assert.ok(!updated.boards.some(b => b.board_id === 1024));
        const empty = await (await request('/boards/public?q=unmatched', { actor: bob })).json();
        assert.deepEqual(empty.boards, []);
    } finally { boards.length = original; }
});

test('discovery rejects malformed queries and fails closed on database errors', async () => {
    for (const suffix of ['page=0', 'page=-1', 'page=1.5', 'page=10001', 'page=1&page=2', 'q=a&q=b', 'q=' + 'a'.repeat(101)]) {
        assert.equal((await request('/boards/public?' + suffix, { actor: alice })).status, 400);
    }
    try {
        failLookup = true;
        const response = await request('/boards/public', { actor: alice });
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: 'Unable to load public boards' });
    } finally { failLookup = false; }
});


test('reference removal preserves originals, other memberships and historical engagements', async () => {
    savedPins.clear();
    savedPins.add('10:210');
    savedPins.add('11:210');
    savedPins.add('20:210');
    const original = { ...pins.find(p => p.pin_id === 210) };
    const count = writes.length;
    for (let i = 0; i < 2; i++) {
        const response = await request('/boards/10/pins/210/reference', { actor: alice, method: 'DELETE' });
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
    }
    assert.equal(savedPins.has('10:210'), false);
    assert.ok(savedPins.has('11:210'));
    assert.ok(savedPins.has('20:210'));
    assert.deepEqual(pins.find(p => p.pin_id === 210), original);
    assert.ok(writes.slice(count).every(w => w.sql.startsWith('DELETE saved FROM board_pins saved')));
    assert.ok(!(await (await request('/boards/10/pins', { actor: alice })).json()).some(p => p.pin_id === 210));
    assert.equal((await request('/pins/210', { actor: bob })).status, 200);
});

test('reference removal permits cleanup after original access is revoked without exposing it', async () => {
    savedPins.add('10:210');
    const board = boards.find(b => b.board_id === 21);
    try {
        board.visibility = 'private';
        assert.equal((await request('/pins/210', { actor: alice })).status, 404);
        for (const pinId of [210, 999999]) {
            const response = await request(`/boards/10/pins/${pinId}/reference`, { actor: alice, method: 'DELETE' });
            assert.equal(response.status, 204);
            assert.equal(await response.text(), '');
        }
        assert.equal(savedPins.has('10:210'), false);
    } finally { board.visibility = 'public'; }
});

test('reference removal cannot remove original-board membership', async () => {
    savedPins.add('10:100');
    assert.equal((await request('/boards/10/pins/100/reference', { actor: alice, method: 'DELETE' })).status, 204);
    assert.ok(savedPins.has('10:100'));
    assert.equal((await request('/pins/100', { actor: alice })).status, 200);
});

test('reference removal rejects nonowners, invalid IDs and missing CSRF without writes', async () => {
    const count = writes.length;
    for (const actor of [bob, admin]) {
        assert.equal((await request('/boards/11/pins/210/reference', { actor, method: 'DELETE' })).status, 404);
    }
    assert.equal((await request('/boards/10/pins/210/reference', { method: 'DELETE' })).status, 403);
    assert.equal((await request('/boards/10/pins/210/reference', { actor: alice, token: bob.token, method: 'DELETE' })).status, 403);
    for (const id of ['0', '-1', 'abc', '9007199254740992']) {
        assert.equal((await request(`/boards/10/pins/${id}/reference`, { actor: alice, method: 'DELETE' })).status, 400);
        assert.equal((await request(`/boards/${id}/pins/210/reference`, { actor: alice, method: 'DELETE' })).status, 404);
    }
    assert.equal(writes.length, count);
});

test('reference removal database failures preserve membership and return generic errors', async () => {
    savedPins.add('10:210');
    try {
        failReferenceRemoval = true;
        const response = await request('/boards/10/pins/210/reference', { actor: alice, method: 'DELETE' });
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: 'Unable to remove saved reference' });
        assert.ok(savedPins.has('10:210'));
    } finally { failReferenceRemoval = false; }
});


test('owners can delete empty and reference-only boards without touching originals or other boards', async () => {
    for (const boardId of [30, 31]) {
        boards.push({ board_id: boardId, user_id: 1, visibility: 'private' });
        if (boardId === 31) savedPins.add('31:210');
        savedPins.add('20:210');
        boardFollows.add(`${boardId}:2`);
        boardFollows.add('20:1');
        const originalPins = JSON.stringify(pins);
        const response = await request(`/boards/${boardId}`, { actor: alice, method: 'DELETE' });
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
        assert.ok(!boards.some(b => b.board_id === boardId));
        assert.equal(savedPins.has(`${boardId}:210`), false);
        assert.equal(boardFollows.has(`${boardId}:2`), false);
        assert.ok(savedPins.has('20:210'));
        assert.ok(boardFollows.has('20:1'));
        assert.equal(JSON.stringify(pins), originalPins);
        assert.equal((await request(`/boards/${boardId}`, { actor: alice, method: 'DELETE' })).status, 404);
    }
});

test('deleting a board with originals is blocked before mutations', async () => {
    const count = writes.length;
    const response = await request('/boards/10', { actor: alice, method: 'DELETE' });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /contains original pins/);
    assert.equal(writes.length, count);
    assert.ok(boards.some(b => b.board_id === 10));
});

test('board deletion rejects nonowners, admins, invalid IDs and CSRF failures', async () => {
    const count = writes.length;
    for (const actor of [bob, admin]) assert.equal((await request('/boards/11', { actor, method: 'DELETE' })).status, 404);
    for (const id of ['0', 'abc', '9999']) assert.equal((await request(`/boards/${id}`, { actor: alice, method: 'DELETE' })).status, 404);
    assert.equal((await request('/boards/10', { method: 'DELETE' })).status, 403);
    assert.equal((await request('/boards/10', { actor: alice, token: bob.token, method: 'DELETE' })).status, 403);
    assert.equal(writes.length, count);
});

test('board deletion rolls back removed references and follows on subsequent failures', async () => {
    boards.push({ board_id: 32, user_id: 1, visibility: 'private' });
    savedPins.add('32:210');
    boardFollows.add('32:2');
    try {
        for (const failingTable of ['board_pins', 'board_follows', 'boards']) {
            failBoardDeletion = `DELETE FROM ${failingTable} `;
            const response = await request('/boards/32', { actor: alice, method: 'DELETE' });
            assert.equal(response.status, 500);
            assert.deepEqual(await response.json(), { error: 'Unable to delete board' });
            assert.ok(boards.some(b => b.board_id === 32));
            assert.ok(savedPins.has('32:210'));
            assert.ok(boardFollows.has('32:2'));
        }
    } finally { failBoardDeletion = ''; }
});

test('deleted destinations are rechecked under lock for deletion, imports and moves', async () => {
    const count = writes.length;
    try {
        missingLockedBoard = true;
        assert.equal((await request('/boards/10', { actor: alice, method: 'DELETE' })).status, 404);
        for (const provider of ['youtube', 'pixabay']) {
            assert.equal((await request(`/pins/${provider}`, { actor: alice, method: 'POST', body: {
                title: 'Pin', destination: 'https://example.test', img_blob: 'https://example.test/image.png', board_id: 10
            } })).status, 404);
        }
        assert.equal((await request('/pins/100/move', { actor: alice, method: 'PUT', body: { board_id: 11 } })).status, 404);
        assert.equal(writes.length, count);
    } finally { missingLockedBoard = false; }
});

test('upload is cleaned up if the destination disappears before its locked recheck', async () => {
    const beforeFiles = fs.readdirSync(uploadDirectory).sort();
    const count = writes.length;
    const form = new FormData();
    form.set('title', 'Uploaded pin');
    form.set('link_url', 'https://example.test');
    form.set('board_id', '10');
    form.set('image', new Blob([validPng], { type: 'image/png' }), 'test.png');
    try {
        missingLockedBoard = true;
        const response = await fetch(`${baseUrl}/pins`, {
            method: 'POST', headers: { Cookie: alice.cookie, 'X-CSRF-TOKEN': alice.token }, body: form
        });
        assert.equal(response.status, 404);
        assert.equal(writes.length, count);
        assert.deepEqual(fs.readdirSync(uploadDirectory).sort(), beforeFiles);
    } finally { missingLockedBoard = false; }
});

test('owners grant exact usernames idempotently and list only viewer IDs and usernames', async () => {
    boardViewers.clear();
    for (let i = 0; i < 2; i++) {
        assert.equal((await request('/boards/10/viewers', { actor: alice, method: 'POST', body: { username: 'user2' } })).status, 204);
    }
    assert.equal(boardViewers.size, 1);
    const response = await request('/boards/10/viewers', { actor: alice });
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.deepEqual(await response.json(), { viewers: [{ user_id: 2, username: 'user2' }] });
    for (const username of ['User2', 'missing', 'user1']) {
        assert.equal((await request('/boards/10/viewers', { actor: alice, method: 'POST', body: { username } })).status, 404);
    }
});

test('semi-private grants propagate to board, pin, comments, upload and saved references; revocation removes access', async () => {
    const original = { ...boards[0] };
    boardViewers.clear();
    savedPins.add('20:100');
    try {
        assert.equal((await request('/boards/10', { actor: alice, method: 'PATCH', body: { visibility: 'semi-private' } })).status, 200);
        const urls = ['/boards/10', '/boards/10/pins', '/pins/100', '/pins/100/comments', `/uploads/${uploadFilename}`];
        for (const url of urls) assert.equal((await request(url, { actor: bob })).status, 404);
        await request('/boards/10/viewers', { actor: alice, method: 'POST', body: { username: 'user2' } });
        for (const url of urls) assert.equal((await request(url, { actor: bob })).status, 200);
        assert.equal((await (await request('/boards/10', { actor: bob })).json()).is_owner, false);
        assert.ok((await (await request('/boards/20/pins', { actor: bob })).json()).some(p => p.pin_id === 100));
        assert.ok((await (await request('/pins', { actor: bob })).json()).some(p => p.pin_id === 100));
        assert.ok((await (await request('/boards/users/1/boards', { actor: bob })).json()).some(b => b.board_id === 10));
        for (let i = 0; i < 2; i++) assert.equal((await request('/boards/10/viewers/2', { actor: alice, method: 'DELETE' })).status, 204);
        for (const url of urls) assert.equal((await request(url, { actor: bob })).status, 404);
        assert.ok(!(await (await request('/boards/20/pins', { actor: bob })).json()).some(p => p.pin_id === 100));
        assert.ok(!(await (await request('/pins', { actor: bob })).json()).some(p => p.pin_id === 100));
        const listed = await (await request('/boards/users/2/boards', { actor: bob })).json();
        assert.equal(listed.find(b => b.board_id === 20).pin_count, 2); // Original 200 plus public saved 210.
        assert.equal((await request('/pins/100', { actor: alice })).status, 200);
    } finally { boards[0] = original; boardViewers.clear(); savedPins.delete('20:100'); }
});

test('private overrides retained grants and public discovery never lists semi-private boards', async () => {
    const original = { ...boards[0] };
    boardViewers.add('10:2');
    try {
        boards[0].visibility = 'private';
        assert.equal((await request('/boards/10', { actor: bob })).status, 404);
        boards[0].visibility = 'semi-private';
        assert.equal((await request('/boards/10', { actor: bob })).status, 200);
        assert.equal((await request('/boards/10', { actor: admin })).status, 404);
        for (const actor of [alice, bob]) {
            assert.ok(!(await (await request('/boards/public', { actor })).json()).boards.some(b => b.board_id === 10));
        }
        boards[0].visibility = 'public';
        boardViewers.delete('10:2');
        assert.equal((await request('/boards/10', { actor: bob })).status, 200);
    } finally { boards[0] = original; boardViewers.clear(); }
});

test('shared destination access does not disclose inaccessible original references', async () => {
    const original = { ...boards[1] };
    savedPins.add('11:100');
    boardViewers.add('11:2');
    try {
        boards[1].visibility = 'semi-private';
        assert.deepEqual((await (await request('/boards/11/pins', { actor: bob })).json()).map(p => p.pin_id), [110, 210]);
        assert.equal((await request('/pins/100', { actor: bob })).status, 404);
    } finally { boards[1] = original; boardViewers.clear(); }
});

test('viewers cannot edit boards, originals, destination references or viewer grants', async () => {
    const original = { ...boards[0] };
    boards[0].visibility = 'semi-private';
    boardViewers.add('10:2');
    try {
        for (const [path, method, body] of [
            ['/boards/10', 'PATCH', { name: 'No' }], ['/boards/10', 'DELETE'],
            ['/pins/100', 'DELETE'], ['/pins/100/move', 'PUT', { board_id: 20 }],
            ['/pins/210/save', 'POST', { board_id: 10 }],
            ['/boards/10/pins/210/reference', 'DELETE'], ['/boards/10/viewers', 'GET'],
            ['/boards/10/viewers', 'POST', { username: 'user3' }], ['/boards/10/viewers/2', 'DELETE']
        ]) assert.equal((await request(path, { actor: bob, method, body })).status, 404, path);
        assert.equal((await request('/pins/100/save', { actor: bob, method: 'POST', body: { board_id: 20 } })).status, 200);
    } finally { boards[0] = original; boardViewers.clear(); savedPins.delete('20:100'); }
});

test('viewer mutations validate input and reject cross-session CSRF', async () => {
    for (const body of [{}, { username: '' }, { username: [] }, { username: 'x'.repeat(101) }, { username: 'user2', user_id: 3 }]) {
        assert.equal((await request('/boards/10/viewers', { actor: alice, method: 'POST', body })).status, 400);
    }
    assert.equal((await request('/boards/10/viewers/abc', { actor: alice, method: 'DELETE' })).status, 400);
    assert.equal((await request('/boards/10/viewers', { actor: alice, token: bob.token, method: 'POST', body: { username: 'user2' } })).status, 403);
    assert.equal((await request('/boards/10/viewers/2', { actor: alice, token: bob.token, method: 'DELETE' })).status, 403);
    assert.equal((await request('/boards/10/viewers')).status, 401);
});

test('sharing database failures fail closed and leave existing grants intact', async () => {
    const original = { ...boards[0] };
    boards[0].visibility = 'semi-private';
    boardViewers.add('10:2');
    try {
        failSharing = true;
        assert.equal((await request('/boards/10', { actor: bob })).status, 500);
        assert.equal((await request('/boards/10/viewers', { actor: alice })).status, 500);
        assert.equal((await request('/boards/10/viewers/2', { actor: alice, method: 'DELETE' })).status, 500);
        assert.equal((await request('/boards/10/viewers', { actor: alice, method: 'POST', body: { username: 'user3' } })).status, 500);
        assert.ok(boardViewers.has('10:2'));
        assert.ok(!boardViewers.has('10:3'));
    } finally { failSharing = false; boards[0] = original; boardViewers.clear(); }
});

test('owners can upload to semi-private boards using the legacy private pin enum', async () => {
    const original = { ...boards[0] };
    boards[0].visibility = 'semi-private';
    const form = new FormData();
    form.set('title', 'Shared original');
    form.set('link_url', 'https://example.test');
    form.set('board_id', '10');
    form.set('image', new Blob([validPng], { type: 'image/png' }), 'test.png');
    try {
        const response = await fetch(`${baseUrl}/pins`, { method: 'POST', headers: { Cookie: alice.cookie, 'X-CSRF-TOKEN': alice.token }, body: form });
        assert.equal(response.status, 201);
        const result = await response.json();
        try { assert.equal(writes.at(-1).params[5], 'private'); }
        finally { fs.unlinkSync(path.join(uploadDirectory, result.fileName)); }
    } finally { boards[0] = original; }
});

test('deleting a reference-only shared board removes its grants without affecting other grants', async () => {
    boards.push({ board_id: 33, user_id: 1, visibility: 'semi-private' });
    boardViewers.add('33:2');
    boardViewers.add('10:2');
    try {
        assert.equal((await request('/boards/33', { actor: alice, method: 'DELETE' })).status, 204);
        assert.equal(boardViewers.has('33:2'), false);
        assert.equal(boardViewers.has('10:2'), true);
    } finally { boardViewers.clear(); }
});

test('logout GET preserves authentication; POST requires CSRF and invalidates the old cookie', async () => {
    const actor = await login(1);
    const get = await request('/users/logout', { actor });
    assert.equal(get.status, 302);
    assert.equal(get.headers.get('location'), '/logout.html');
    assert.equal((await request('/users/profile', { actor })).status, 200);
    assert.equal((await request('/users/logout', { actor, method: 'POST', token: bob.token })).status, 403);
    assert.equal((await request('/users/profile', { actor })).status, 200);
    const logout = await request('/users/logout', { actor, method: 'POST' });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /connect.sid=;/);
    for (const url of ['/users/profile', '/pins', '/boards/10', `/uploads/${uploadFilename}`]) {
        assert.equal((await request(url, { actor })).status, 401);
    }
    assert.equal((await request('/users/logout', { actor, method: 'POST' })).status, 403);
    assert.equal((await request('/users/profile', { actor: bob })).status, 200);
});

async function postImage(bytes, { name = 'test.png', type = 'image/png', title = 'Upload', extra = false, token = alice.token, cookie = alice.cookie } = {}) {
    const form = new FormData();
    form.set('title', title);
    form.set('link_url', 'https://example.test');
    form.set('board_id', '10');
    form.set('image', new Blob([bytes], { type }), name);
    if (extra) form.append('image', new Blob([validPng], { type: 'image/png' }), 'second.png');
    return fetch(`${baseUrl}/pins`, { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-TOKEN': token }, body: form });
}

test('upload rejection returns JSON and leaves no new files or pin writes', async () => {
    const beforeFiles = fs.readdirSync(uploadDirectory).sort();
    const beforeWrites = writes.length;
    for (const [bytes, options, status] of [
        [Buffer.alloc(0), {}, 415],
        [Buffer.from('<svg/>'), { name: 'image.svg', type: 'image/svg+xml' }, 415],
        [Buffer.from('<html>not an image</html>'), {}, 415],
        [validPng, { name: 'image.jpg', type: 'image/jpeg' }, 415],
        [validPng, { type: 'image/jpeg' }, 415],
        [validPng, { name: 'image.html' }, 415],
        [validPng, { extra: true }, 400],
        [validPng, { title: '' }, 400],
        [Buffer.alloc(10_000_001), {}, 413],
        [Buffer.alloc(10_000_002), {}, 413],
        [validPng, { token: 'wrong' }, 403]
    ]) {
        const response = await postImage(bytes, options);
        assert.equal(response.status, status);
        // Global CSRF errors retain their existing text response.
        if (status !== 403) assert.equal(typeof (await response.json()).error, 'string');
        assert.deepEqual(fs.readdirSync(uploadDirectory).sort(), beforeFiles);
        assert.equal(writes.length, beforeWrites);
    }
});

test('image size boundary is inclusive and concurrent uploads have distinct controlled names', async () => {
    const boundary = Buffer.alloc(10_000_000);
    validPng.copy(boundary);
    const results = [];
    try {
        for (const response of await Promise.all([
            postImage(boundary), postImage(validPng),
            postImage(validPng, { name: 'UPPER.PNG', type: 'application/octet-stream' })
        ])) {
            assert.equal(response.status, 201);
            results.push(await response.json());
        }
        assert.equal(new Set(results.map(result => result.fileName)).size, 3);
        for (const result of results) assert.match(result.fileName, /^[0-9a-f-]{36}\.png$/);
        assert.equal(fs.statSync(path.join(uploadDirectory, results[0].fileName)).size, 10_000_000);
    } finally {
        for (const result of results) fs.unlinkSync(path.join(uploadDirectory, result.fileName));
    }
});

test('failed pin insertion cleans up the image without exposing database errors', async () => {
    const beforeFiles = fs.readdirSync(uploadDirectory).sort();
    try {
        failPinInsert = true;
        const response = await postImage(validPng);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: 'Failed to create pin' });
        assert.deepEqual(fs.readdirSync(uploadDirectory).sort(), beforeFiles);
    } finally { failPinInsert = false; }
});

test('protected image delivery uses image MIME, no-store and nosniff headers', async () => {
    const response = await request(`/uploads/${uploadFilename}`, { actor: alice });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('JPEG and WebP uploads preserve bytes and receive controlled extensions', async () => {
    for (const [format, name, type, extension] of [
        ['jpeg', 'photo.jpeg', 'image/jpeg', '.jpg'],
        ['webp', 'photo.webp', 'image/webp', '.webp']
    ]) {
        const response = await postImage(imageFixtures[format], { name, type });
        assert.equal(response.status, 201);
        const result = await response.json();
        const filename = path.join(uploadDirectory, result.fileName);
        try {
            assert.equal(path.extname(result.fileName), extension);
            assert.deepEqual(fs.readFileSync(filename), imageFixtures[format]);
        } finally { fs.unlinkSync(filename); }
    }
});


test('pin deletion preserves CSRF and owner checks and handles locked recheck and write failures', async () => {
    const count = writes.length;
    assert.equal((await request('/pins/100', { actor: alice, method: 'DELETE', token: 'wrong' })).status, 403);
    assert.equal((await request('/pins/100', { actor: bob, method: 'DELETE' })).status, 404);
    try {
        missingDeletionLock = true;
        assert.equal((await request('/pins/100', { actor: alice, method: 'DELETE' })).status, 404);
        assert.equal(writes.length, count);
    } finally { missingDeletionLock = false; }
    try {
        failPinDeletion = true;
        const response = await request('/pins/100', { actor: alice, method: 'DELETE' });
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: 'Failed to delete pin' });
        assert.equal(writes.length, count);
    } finally { failPinDeletion = false; }
});

test('malformed login and registration bodies are rejected before credential/database work', async () => {
    const count = writes.length;
    try {
        failUserLookup = true;
        for (const body of [null, {}, { email: [], password: 'password' }, { email: 'user@example.test', password: {} }]) {
            assert.equal((await request('/users/login', { method: 'POST', body })).status, 400);
        }
    } finally { failUserLookup = false; }
    for (const body of [{}, { username: 'x', email: 'bad', password: 'password' },
        { username: 'x', email: 'x@example.test', password: 'short' },
        { username: 'x', email: 'x@example.test', password: 'é'.repeat(37) }]) {
        assert.equal((await request('/users/signup', { method: 'POST', body })).status, 400);
        assert.equal((await request('/users/admin_add_user', { actor: admin, method: 'POST', body })).status, 400);
    }
    assert.equal(writes.length, count);
});

test('user responses are no-store for anonymous, privileged, validation and CSRF outcomes', async () => {
    for (const [url, options, status] of [
        ['/users/profile', {}, 401],
        ['/users/profile', { actor: alice }, 200],
        ['/users/user_info', { actor: admin }, 200],
        ['/users/user_info', { actor: alice }, 403],
        ['/users/login', { method: 'POST', body: {} }, 400],
        ['/users/signup', { method: 'POST', body: {} }, 400],
        ['/users/admin_add_user', { actor: admin, method: 'POST', token: 'wrong', body: {} }, 403]
    ]) {
        const response = await request(url, options);
        assert.equal(response.status, status);
        assert.match(response.headers.get('cache-control'), /private, no-store/);
    }
});

test('valid signup and admin creation retain success responses and ignore role escalation', async () => {
    for (const [url, actor] of [['/users/signup', undefined], ['/users/admin_add_user', admin]]) {
        const response = await request(url, { actor, method: 'POST', body: {
            username: 'newuser', email: 'newuser@example.test', password: 'test-password-only', role: 'admin'
        } });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('cache-control'), /no-store/);
        const result = await response.json();
        if (!actor) {
            assert.equal(result.redirect, '/home.html');
            assert.match(result.csrfToken, /^[a-f0-9]{64}$/);
        } else assert.equal(result.user_id, 900);
        assert.equal(writes.at(-1).params[3], 'user');
    }
});

test('anonymous browsing and rejected credentials do not create session cookies', async () => {
    for (const [url, options] of [['/landingpage.html', {}], ['/users/profile', {}],
        ['/users/login', { method: 'POST', body: { email: 'user1@example.test', password: 'incorrect' } }]]) {
        const response = await request(url, options);
        assert.equal(response.headers.get('set-cookie'), null);
    }
});

test('absolute session expiry blocks mutations at eight hours while other sessions remain usable', async () => {
    const actor = await login(1);
    const originalNow = Date.now;
    const now = Date.now();
    const count = writes.length;
    try {
        Date.now = () => now + 8 * 60 * 60 * 1000 - 1000;
        assert.equal((await request('/users/profile', { actor })).status, 200);
        Date.now = () => now + 8 * 60 * 60 * 1000;
        const expired = await request('/pins/100', { actor, method: 'DELETE' });
        // MemoryStore may evict first, leaving the existing anonymous-CSRF 403.
        assert.ok([401, 403].includes(expired.status));
        if (expired.status === 401) assert.match(expired.headers.get('set-cookie'), /connect.sid=;/);
        assert.equal(writes.length, count);
        for (const url of ['/users/profile', '/boards/10', '/pins', `/uploads/${uploadFilename}`]) {
            assert.equal((await request(url, { actor })).status, 401);
        }
        assert.equal((await request('/landingpage.html', { actor })).status, 200);
    } finally { Date.now = originalNow; }
    assert.equal((await request('/users/profile', { actor: bob })).status, 200);
    const fresh = await login(1);
    assert.equal((await request('/users/profile', { actor: fresh })).status, 200);
});

test('login accepts an expired cookie and replaces it with a new authenticated session', async () => {
    const actor = await login(1);
    const originalNow = Date.now;
    const now = Date.now();
    try {
        Date.now = () => now + 8 * 60 * 60 * 1000;
        const response = await request('/users/login', { actor, method: 'POST', body: {
            email: 'user1@example.test', password
        } });
        assert.equal(response.status, 200);
        const cookies = response.headers.getSetCookie();
        const newCookie = cookies.at(-1).split(';')[0];
        assert.notEqual(newCookie, actor.cookie);
        assert.match(cookies.at(-1), /Expires=/);
        assert.equal((await request('/users/profile', { actor: { cookie: newCookie } })).status, 200);
    } finally { Date.now = originalNow; }
});

test('credential routes reject missing, wrong and foreign-session CSRF tokens', async () => {
    const first = await request('/users/csrf');
    const second = await request('/users/csrf');
    const actor = { cookie: first.headers.getSetCookie().at(-1).split(';')[0] };
    const ownToken = (await first.json()).csrfToken;
    const foreignToken = (await second.json()).csrfToken;
    assert.notEqual(ownToken, foreignToken);
    const count = writes.length;
    for (const url of ['/users/login', '/users/signup']) {
        for (const token of [undefined, 'incorrect', foreignToken]) {
            const response = await request(url, { actor, method: 'POST', token, authCsrf: false, body: {
                username: 'csrf-test', email: users[0].email, password
            } });
            assert.equal(response.status, 403);
            assert.match(response.headers.get('cache-control'), /no-store/);
        }
    }
    assert.equal(writes.length, count);
    assert.equal((await request('/users/profile', { actor })).status, 401);
});

test('CSRF bootstrap is stable and login replaces both anonymous cookie and token', async () => {
    const bootstrap = await request('/users/csrf');
    const anonymous = { cookie: bootstrap.headers.getSetCookie().at(-1).split(';')[0], token: (await bootstrap.json()).csrfToken };
    assert.match(anonymous.token, /^[a-f0-9]{64}$/);
    assert.match(bootstrap.headers.get('cache-control'), /no-store/);
    assert.equal(bootstrap.headers.get('access-control-allow-origin'), null);
    assert.equal((await (await request('/users/csrf', { actor: anonymous })).json()).csrfToken, anonymous.token);
    const response = await request('/users/login', { actor: anonymous, authCsrf: false, method: 'POST', body: { email: users[0].email, password } });
    assert.equal(response.status, 200);
    const actor = { cookie: response.headers.getSetCookie().at(-1).split(';')[0], token: (await response.json()).csrfToken };
    assert.notEqual(actor.cookie, anonymous.cookie);
    assert.notEqual(actor.token, anonymous.token);
    assert.equal((await request('/users/profile', { actor: anonymous })).status, 401);
    assert.equal((await request('/users/csrf', { actor }).then(r => r.json())).csrfToken, actor.token);
    assert.equal((await request('/boards', { actor, token: anonymous.token, method: 'POST', body: { name: 'Must not create' } })).status, 403);
    assert.equal((await request('/users/profile', { actor })).status, 200);
});


test('actual app throttles credential floods before CSRF, session allocation and password work', async () => {
    const originalCompare = bcrypt.compare;
    let comparisons = 0;
    bcrypt.compare = async () => { comparisons++; return false; };
    try {
        for (let i = 0; i < 30; i++) {
            assert.equal((await request('/users/login', { method: 'POST', authCsrf: false, body: {} })).status, 403);
        }
        const response = await fetch(`${baseUrl}/USERS/LOGIN/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.99' }, body: '{invalid'
        });
        assert.equal(response.status, 429);
        assert.equal(response.headers.get('retry-after'), '900');
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(comparisons, 0);
    } finally { bcrypt.compare = originalCompare; }
});

test('actual login, signup and admin creation share bcrypt capacity and recover after release', async () => {
    const { passwordWork } = require('../middleware/passwordWork');
    const releases = [];
    const jobs = Array.from({ length: 4 }, () => passwordWork(() => new Promise(resolve => releases.push(resolve))));
    const count = writes.length;
    try {
        for (const [url, actor] of [['/users/login', undefined], ['/users/signup', undefined], ['/users/admin_add_user', admin]]) {
            const response = await request(url, { actor, method: 'POST', body: {
                username: 'capacity-test', email: users[0].email, password
            } });
            assert.equal(response.status, 503, url);
            assert.equal(response.headers.get('retry-after'), '5');
            assert.match(response.headers.get('cache-control'), /no-store/);
            assert.match(await response.text(), /temporarily busy/);
        }
        assert.equal(writes.length, count);
    } finally {
        releases.forEach(resolve => resolve());
        await Promise.all(jobs);
    }
    assert.ok((await login(1)).cookie);
});


test('shared discovery isolates grants, visibility and ownership, then reflects revocation', async () => {
    const original = boards.length;
    try {
        for (let i = 0; i < 25; i++) {
            boards.push({ board_id: 3000+i, user_id: 1, visibility: 'semi-private', name: 'Shared %_' });
            boardViewers.add(`${3000+i}:2`);
        }
        boards.push({ board_id: 4000, user_id: 1, visibility: 'private', name: 'Hidden' });
        boards.push({ board_id: 4001, user_id: 1, visibility: 'public', name: 'Public' });
        boards.push({ board_id: 4002, user_id: 2, visibility: 'semi-private', name: 'Owned' });
        boards.push({ board_id: 4003, user_id: 1, visibility: 'semi-private', name: 'No grant' });
        for (const id of [4000,4001,4002]) boardViewers.add(`${id}:2`);
        assert.equal((await request('/boards/shared')).status, 401);
        const first = await request('/boards/shared?user_id=1', { actor: bob });
        assert.match(first.headers.get('cache-control'), /no-store/);
        const result = await first.json();
        assert.equal(result.boards.length, 20);
        assert.equal(result.has_more, true);
        assert.ok(result.boards.every(b => b.board_id >= 3000 && b.board_id < 3025));
        assert.equal((await (await request('/boards/shared?q=%25_&page=2', { actor: bob })).json()).boards.length, 5);
        assert.deepEqual((await (await request('/boards/shared', { actor: alice })).json()).boards, []);
        boardViewers.delete('3024:2');
        boards.find(b => b.board_id === 3023).visibility = 'private';
        const updated = await (await request('/boards/shared', { actor: bob })).json();
        assert.ok(updated.boards.every(b => b.board_id !== 3024 && b.board_id !== 3023));
        assert.equal((await request('/boards/3024', { actor: bob })).status, 404);
    } finally {
        boards.length = original;
        for (const key of [...boardViewers]) if (Number(key.split(':')[0]) >= 3000) boardViewers.delete(key);
    }
});

test('shared discovery validates pagination and hides database error detail', async () => {
    for (const query of ['page=0','page=10001','page=1&page=2','q=a&q=b','q='+'x'.repeat(101)]) {
        assert.equal((await request('/boards/shared?'+query,{actor:bob})).status,400);
    }
    try {
        failLookup=true;
        const result=await request('/boards/shared',{actor:bob});
        assert.equal(result.status,500);
        assert.deepEqual(await result.json(),{error:'Unable to load shared boards'});
    } finally { failLookup=false; }
});

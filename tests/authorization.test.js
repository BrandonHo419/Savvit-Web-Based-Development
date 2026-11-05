const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
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
const writes = [];
const savedPins = new Set();
let failSaveEngagement = false;
let failReferenceRemoval = false;
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
    if (failLookup) throw new Error('Simulated database outage');
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
    if (q.startsWith('SELECT b.user_id, b.visibility FROM pins')) {
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
                && (original.user_id === params[3] || original.visibility === 'public');
        })];
    }
    if (q.startsWith('SELECT p.*, u.username')) {
        if (q.includes('WHERE p.pin_id = ?')) return [pins.filter(p => p.pin_id === Number(params[0]))];
        assert.match(q, /JOIN boards b ON b.board_id = p.board_id/);
        assert.match(q, /WHERE b.user_id = \? OR b.visibility = 'public'/);
        return [pins.filter(p => {
            const b = boards.find(b => b.board_id === p.board_id);
            return b.user_id === params[0] || b.visibility === 'public';
        })];
    }
    if (q.startsWith('SELECT b.board_id,')) {
        assert.match(q, /b.user_id = \? AND \(b.user_id = \? OR b.visibility = 'public'\)/);
        assert.match(q, /EXISTS \( SELECT 1 FROM board_pins/);
        return [boards.filter(b => b.user_id === Number(params[2]) && (b.user_id === params[3] || b.visibility === 'public')).map(b => ({
            ...b,
            pin_count: pins.filter(p => {
                const original = boards.find(board => board.board_id === p.board_id);
                return (p.board_id === b.board_id || savedPins.has(`${b.board_id}:${p.pin_id}`))
                    && (original.user_id === params[1] || original.visibility === 'public');
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
        return {
            async beginTransaction() { snapshot = new Set(savedPins); writeCount = writes.length; },
            query,
            async commit() {},
            async rollback() { savedPins.clear(); snapshot.forEach(key => savedPins.add(key)); writes.length = writeCount; },
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
const app = require('../app');
mysql.createPool = originalCreatePool;
let server;
let baseUrl;
let alice;
let bob;
let admin;

async function request(path, { actor, method = 'GET', body, token = actor?.token } = {}) {
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
    fs.writeFileSync(uploadPath, 'private test image', { flag: 'wx' });
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
        form.set('image', new Blob(['test image'], { type: 'image/png' }), 'test.png');
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

test('private upload URLs reject other accounts before static delivery', async () => {
    const url = `/uploads/${uploadFilename}`;
    const response = await request(url, { actor: alice });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'private test image');
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
        { visibility: 'semi-private' }, { visibility: 'PUBLIC' }, { visibility: null },
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

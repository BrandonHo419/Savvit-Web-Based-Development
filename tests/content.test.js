const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

test('display URLs allow HTTP(S) and local media but reject executable schemes', async () => {
    const source = await readFile(path.join(__dirname, '../public/js/content.js'), 'utf8');
    const { safeHttpUrl } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const previousWindow = global.window;
    global.window = { location: { origin: 'http://localhost:3000' } };
    try {
        assert.equal(safeHttpUrl('/uploads/photo.png'), 'http://localhost:3000/uploads/photo.png');
        assert.equal(safeHttpUrl('https://example.test/image.jpg'), 'https://example.test/image.jpg');
        for (const unsafe of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///tmp/image', '', null]) {
            assert.equal(safeHttpUrl(unsafe), null);
        }
    } finally { global.window = previousWindow; }
});

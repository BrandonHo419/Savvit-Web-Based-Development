const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { imageFormat } = require('../middleware/imageUpload');
const fixtures = require('./image-fixtures.cjs');
const source = fs.readFileSync(path.join(__dirname, '../public/js/upload-policy.js'), 'utf8').replace('export function', 'function');
const context = vm.createContext({});
vm.runInContext(source, context);

test('image signatures distinguish supported containers and reject truncated or unrelated headers', () => {
    for (const [format, bytes] of Object.entries(fixtures)) {
        assert.equal(imageFormat(bytes, bytes.length), format === 'jpeg' ? 'jpg' : format);
        assert.equal(imageFormat(bytes.subarray(0, 2), 2), null);
    }
    assert.equal(imageFormat(Buffer.from('GIF89a'), 6), null);
    assert.equal(imageFormat(fixtures.webp, fixtures.webp.length + 1), null);
});

test('browser upload policy matches formats and inclusive decimal size limit', () => {
    for (const name of ['a.jpg', 'a.JPEG', 'a.png', 'a.webp']) {
        assert.equal(context.uploadError({ name, type: '', size: 10_000_000 }), '');
        assert.match(context.uploadError({ name, type: '', size: 10_000_001 }), /10 MB/);
    }
    for (const file of [null, { name: 'a.png', size: 0 }, { name: 'a.svg', size: 1 },
        { name: 'a.gif', size: 1 }, { name: 'a.png', type: 'image/jpeg', size: 1 }]) {
        assert.ok(context.uploadError(file));
    }
});

test('invalid selection clears prior upload; delayed preview cannot replace a newer selection', () => {
    const script = fs.readFileSync(path.join(__dirname, '../public/js/boardstuff/modal_and_pin_script.js'), 'utf8')
        .split('// -----------------Save Pin Button')[0].replace(/^import .*;\r?\n/gm, '');
    let change;
    const readers = [];
    const images = [];
    const state = { uploaded_file: { name: 'old.png' }, pin_image_blob: 'old' };
    const elements = new Map();
    const element = selector => {
        if (!elements.has(selector)) elements.set(selector, { style: {}, replaceChildren() {}, appendChild() {} });
        return elements.get(selector);
    };
    const alerts = [];
    const ctx = vm.createContext({ state, uploadError: context.uploadError, alert: message => alerts.push(message),
        document: { getElementById: () => ({ addEventListener: (event, fn) => { change = fn; } }), querySelector: element },
        FileReader: class { constructor() { readers.push(this); } readAsDataURL() {} },
        Image: class { constructor() { images.push(this); this.style = {}; } }
    });
    vm.runInContext(script, ctx);
    const select = file => change({ target: { files: [file], value: 'selected' } });
    select({ name: 'bad.svg', size: 10, type: 'image/svg+xml' });
    assert.equal(state.uploaded_file, null);
    assert.equal(state.pin_image_blob, null);
    assert.equal(alerts.length, 1);
    select({ name: 'first.png', size: 10, type: 'image/png' });
    readers[0].result = 'first';
    readers[0].onload();
    select({ name: 'second.png', size: 10, type: 'image/png' });
    images[0].onload();
    assert.equal(state.pin_image_blob, null);
    readers[1].result = 'second';
    readers[1].onload();
    images[1].onerror();
    assert.equal(state.uploaded_file, null);
    assert.equal(state.pin_image_blob, null);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/js/appearance.js'), 'utf8');

function boot(saved, unavailable = false) {
  const dataset = {};
  vm.runInNewContext(source, { document: { documentElement: { dataset }, addEventListener() {} },
    localStorage: { getItem() { if (unavailable) throw Error('blocked'); return saved; } } });
  return dataset;
}
test('appearance accepts only supported settings and survives unavailable or corrupt storage', () => {
  const defaults = { theme: 'system', density: 'comfortable', textSize: 'standard', motion: 'system' };
  for (const saved of ['bad json', 'null', '42', '[]', '"text"', '{"theme":"neon","density":"tiny"}']) assert.deepEqual(boot(saved), defaults);
  assert.deepEqual(boot(null, true), defaults);
  assert.deepEqual(boot('{"theme":"dark","density":"compact","textSize":"large","motion":"reduce"}'), { theme: 'dark', density: 'compact', textSize: 'large', motion: 'reduce' });
});

function luminance(hex) {
  const values = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
test('both theme palettes meet AA text contrast for primary, muted and accent text', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/stylesheets/design-system.css'), 'utf8');
  for (const selector of [':root {', ':root[data-theme="dark"] {']) {
    const block = css.slice(css.indexOf(selector)).split('}')[0];
    const colors = Object.fromEntries([...block.matchAll(/--([a-z-]+): (#[a-f0-9]{6})/g)].map(match => [match[1], match[2]]));
    for (const surface of ['canvas', 'surface', 'surface-soft']) {
      for (const text of ['ink', 'muted', 'accent']) assert.ok(contrast(colors[text], colors[surface]) >= 4.5, `${selector} ${text} on ${surface}`);
    }
    assert.ok(contrast(colors['on-accent'], colors.accent) >= 4.5);
    assert.ok(contrast(colors.focus, colors.surface) >= 3);
  }
});

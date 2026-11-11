// Uses installed Chrome and fixture responses; no application database is touched.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../public');
const boards = [{ board_id: 10, name: 'Weekend inspiration', description: 'A collection of useful ideas.', visibility: 'private', pin_count: 2, created_at: '2026-01-01' }, { board_id: 20, name: 'Places to explore', visibility: 'public', pin_count: 0 }];
const pins = [{ pin_id: 100, board_id: 10, user_id: 1, username: 'Demo', title: 'A little inspiration', description: 'A full description with room to breathe.', image_url: '/img/image1.jpg', link_url: 'https://example.test', is_liked: 0, like_count: 2 }];
let chrome, socket, server, profile;
async function main() {
  const artifacts = process.argv.includes('--screenshots') ? await fs.mkdtemp(path.join(os.tmpdir(), 'savvit-design-review-')) : null;
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:3000');
    const fixtures = {
      '/users/profile': { user_id: 1, username: 'Demo', email: 'demo@example.test', role: 'admin' },
      '/users/user_info': [],
      '/users/csrf': { csrfToken: '0'.repeat(64) },
      '/boards/users/1/boards': boards,
      '/boards/10': { ...boards[0], is_owner: true },
      '/boards/10/pins': pins,
      '/boards/public': { boards, page: 1, has_more: false },
      '/boards/shared': { boards: [{ ...boards[1], owner_name: 'Another member', visibility: 'semi-private' }], page: 1, has_more: false },
      '/boards/10/viewers': [], '/pins/100/comments': []
    };
    if (url.pathname in fixtures) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(fixtures[url.pathname])); }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(404); return res.end(); }
    try {
      const bytes = await fs.readFile(file);
      res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3000, 'localhost', resolve); });
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'savvit-ui-'));
  chrome = spawn(process.env.SAVVIT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Chrome startup timed out')), 15000);
    let output = '';
    chrome.stderr.on('data', bytes => { output += bytes; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    chrome.once('error', error => { clearTimeout(timer); reject(error); });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', event => { const msg = JSON.parse(event.data); if (pending.has(msg.id)) pending.get(msg.id)(msg); });
  async function send(method, params = {}, sessionId) {
    const key = ++id;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(key); reject(Error(`Browser command timed out: ${method}`)); }, 15000);
      pending.set(key, msg => { clearTimeout(timer); pending.delete(key); msg.error ? reject(Error(msg.error.message)) : resolve(msg.result); });
    });
    socket.send(JSON.stringify({ id: key, method, params, sessionId })); return response;
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params = {}) => send(method, params, sessionId);
  await call('Page.enable');
  await call('Network.enable');
  await call('Network.setBlockedURLs', { urls: ['https://*'] });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw Error(`Page condition timed out: ${expression}`);
  }
  async function navigate(page) {
    await call('Page.navigate', { url: `http://localhost:3000/${page}.html${page === 'board' ? '?board_id=10' : ''}` });
    await until(`location.pathname === '/${page}.html' && document.readyState === 'complete' && !!document.querySelector('.appearance')`);
  }
  for (const page of ['landingpage', 'home', 'board', 'profile', 'explore', 'public-boards', 'shared-boards', 'login', 'signup', 'logout', 'admin']) {
    await navigate(page);
    if (page === 'board') await until(`!!document.querySelector('.pin_card')`);
    for (const width of [1440, 768, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      const overflow = await evaluate(`({width: innerWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(el=>el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 1).slice(0,6).map(el=>el.tagName+'.'+el.className)})`);
      assert.ok(overflow.scroll <= width + 1, `${page} at ${width}px overflows: ${JSON.stringify(overflow)}`);
      if (artifacts && ['home', 'board', 'login', 'landingpage'].includes(page) && width !== 768) {
        const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await fs.writeFile(path.join(artifacts, `${page}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      }
    }
    assert.equal(await evaluate(`document.querySelectorAll('main').length`), 1, `${page} main landmark`);
    assert.equal(await evaluate(`!!document.querySelector('.skip-link')`), true);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('input, select, textarea')].filter(el => el.getClientRects().length && !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).map(el => el.id)`), [], `${page} field labels`);
    if (page === 'home') {
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.collection-info h3')).color === getComputedStyle(document.body).color`), true, 'Board titles use readable theme text');
    }
    await evaluate(`document.documentElement.style.fontSize = '200%'`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true, `${page} enlarged-text reflow`);
    await evaluate(`document.documentElement.style.fontSize = ''`);
    console.log(`PASS ${page}: desktop/tablet/320px reflow and landmarks`);
  }
  await navigate('board');
  await until(`!!document.querySelector('.pin_card')`);
  await evaluate(`document.querySelector('.pin_card').focus(); document.querySelector('.pin_card').click()`);
  await until(`!!document.querySelector('#viewModal') && document.querySelector('#viewModal').contains(document.activeElement)`);
  assert.equal(await evaluate(`document.querySelector('#savvit_home').inert`), true);
  if (artifacts) {
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, 'pin-details-320.png'), Buffer.from(screenshot.data, 'base64'));
  }
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 });
  assert.equal(await evaluate(`document.querySelector('#viewModal').contains(document.activeElement)`), true);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await until(`getComputedStyle(document.querySelector('#viewModal')).display === 'none'`);
  assert.equal(await evaluate(`document.querySelector('#savvit_home').inert`), false);
  await evaluate(`document.querySelector('.add_pin').click()`);
  await until(`document.querySelector('.add_pin_modal').contains(document.activeElement)`);
  assert.equal(await evaluate(`document.querySelector('.add_pin_container').getBoundingClientRect().right <= innerWidth + 1`), true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#upload_img')).opacity`), '1');
  if (artifacts) {
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, 'create-pin-320.png'), Buffer.from(screenshot.data, 'base64'));
  }
  await evaluate(`document.querySelector('.upload_link').click()`);
  await until(`document.querySelector('#uploadLinkPopup').contains(document.activeElement)`);
  assert.equal(await evaluate(`document.querySelector('.popup-panel').getBoundingClientRect().right <= innerWidth + 1`), true);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await until(`document.querySelector('.add_pin_modal').contains(document.activeElement)`);
  assert.equal(await evaluate(`document.activeElement.classList.contains('upload_link')`), true, 'Nested dialog restores its trigger');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await until(`getComputedStyle(document.querySelector('.add_pin_modal')).display === 'none'`);
  assert.equal(await evaluate(`document.activeElement.classList.contains('add_pin')`), true);
  await evaluate(`const s=document.querySelector('.appearance select'); s.value='dark'; s.dispatchEvent(new Event('change'))`);
  await navigate('home');
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
  if (artifacts) {
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(artifacts, 'home-dark-1440.png'), Buffer.from(screenshot.data, 'base64'));
    console.log(`Screenshots: ${artifacts}`);
  }
  console.log('PASS modal keyboard containment, Escape, inert background, focus return and persisted theme');
  await send('Browser.close');
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  socket?.close(); chrome?.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (profile && path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('savvit-ui-')) {
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

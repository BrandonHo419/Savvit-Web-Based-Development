// Serve only the public demo, including the repository path used on Pages.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../docs');
const prefix = '/Savvit-Web-Based-Development/';
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3000');
  if (url.pathname === '/') { res.writeHead(302, { Location: prefix }); return res.end(); }
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.resolve(root, url.pathname.slice(prefix.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(404); return res.end('Not found'); }
  try { const data = await fs.readFile(file); res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' }[path.extname(file)] || 'application/octet-stream'); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 3000 is busy. Stop the app or browser tests first.' : 'Unable to start the demo preview.'); process.exitCode = 1; });
server.listen(3000, 'localhost', () => console.log(`Demo: http://localhost:3000${prefix}`));

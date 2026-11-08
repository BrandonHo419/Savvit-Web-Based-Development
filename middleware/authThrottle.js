const { isIP } = require('node:net');
const { performance } = require('node:perf_hooks');

// Use socket identity, never client-supplied forwarding headers. No proxy is trusted.
function ipKey(address) {
  if (isIP(address) === 4) return address;
  if (isIP(address) !== 6) return 'unknown';
  // Socket addresses may include an interface zone for link-local IPv6.
  address = address.split('%')[0];
  // WHATWG URL canonicalization handles embedded IPv4 and compressed IPv6.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const words = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill('0'), ...end];
  const values = words.map(word => parseInt(word, 16));
  if (values.slice(0, 5).every(value => value === 0) && values[5] === 0xffff) {
    return [values[6] >> 8, values[6] & 255, values[7] >> 8, values[7] & 255].join('.');
  }
  return `${values[0].toString(16)}:${values[1].toString(16)}:${values[2].toString(16)}:${(values[3] & 0xff00).toString(16)}::/56`;
}

function reject(res, status, seconds) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Retry-After', String(Math.max(1, Math.ceil(seconds))));
  return res.status(status).send(status === 429
    ? 'Too many attempts. Please wait before trying again.'
    : 'Authentication is temporarily busy. Please try again shortly.');
}

function createAuthThrottle({ now = () => performance.now(), maxKeys = 10000 } = {}) {
  const policies = {
    login: { limit: 30, windowMs: 15 * 60000, keys: new Map() },
    signup: { limit: 5, windowMs: 60 * 60000, keys: new Map() },
    csrf: { limit: 60, windowMs: 15 * 60000, keys: new Map() }
  };
  let globalWindow;
  function sweep(time = now()) {
    for (const policy of Object.values(policies)) {
      for (const [key, entry] of policy.keys) if (entry.until <= time) policy.keys.delete(key);
    }
  }
  function middleware(name) {
    const policy = policies[name];
    if (!policy) throw new Error('Unknown authentication throttle policy');
    return (req, res, next) => {
      const time = now();
      if (!globalWindow || globalWindow.until <= time) globalWindow = { count: 0, until: time + 60000 };
      if (globalWindow.count >= 300) return reject(res, 429, (globalWindow.until - time) / 1000);
      // Count endpoint rejections too, preventing them from bypassing the global gate.
      globalWindow.count++;
      const key = ipKey(req.socket?.remoteAddress);
      let entry = policy.keys.get(key);
      if (entry && entry.until <= time) { policy.keys.delete(key); entry = undefined; }
      if (!entry) {
        if (policy.keys.size >= maxKeys) sweep(time);
        if (policy.keys.size >= maxKeys) return reject(res, 503, 5);
        entry = { count: 0, until: time + policy.windowMs };
        policy.keys.set(key, entry);
      }
      if (entry.count >= policy.limit) return reject(res, 429, (entry.until - time) / 1000);
      entry.count++;
      next();
    };
  }
  // Use the same Express routing semantics as the active endpoints (including HEAD).
  function mount(app) {
    app.post('/users/login', middleware('login'));
    app.post('/users/signup', middleware('signup'));
    app.get('/users/csrf', middleware('csrf'));
  }
  return { middleware, mount, sweep };
}

module.exports = { createAuthThrottle, ipKey, reject };

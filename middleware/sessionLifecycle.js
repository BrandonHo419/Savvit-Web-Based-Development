const crypto = require('node:crypto');
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

function cookieOptions() {
  return { path: '/', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' };
}

function sessionOptions() {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('SESSION_SECRET must be configured before starting Savvit.');
  }
  return {
    secret, resave: false, saveUninitialized: false,
    cookie: { ...cookieOptions(), maxAge: SESSION_LIFETIME_MS }
  };
}

function completeLogin(req, res, body) {
  req.session.expiresAt = Date.now() + SESSION_LIFETIME_MS;
  req.session.cookie.maxAge = SESSION_LIFETIME_MS;
  const csrfToken = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = csrfToken;
  // Passport saves before its callback; save our deadline and token before success.
  req.session.save(error => {
    if (!error) return res.status(200).json({ ...body, csrfToken });
    req.session.destroy(cleanupError => {
      if (!cleanupError) res.clearCookie('connect.sid', cookieOptions());
      else console.error('Failed-login session cleanup failed:', cleanupError.code || cleanupError.name);
      res.status(500).json({ error: 'Unable to establish your session. Please retry.' });
    });
  });
}

function enforceSessionLifetime(req, res, next) {
  if (req.session?.passport?.user == null) return next();
  const now = Date.now();
  const deadline = req.session.expiresAt;
  if (Number.isSafeInteger(deadline) && deadline > now && deadline <= now + SESSION_LIFETIME_MS) {
    // Keep cookie/store expiry near the absolute deadline despite session touching.
    req.session.cookie.maxAge = deadline - now;
    return next();
  }
  res.set('Cache-Control', 'private, no-store');
  // Regeneration removes the expired identity and leaves a fresh, unsaved session.
  req.session.regenerate(error => {
    if (error) return res.status(500).json({ error: 'Unable to expire your session. Please retry.' });
    res.clearCookie('connect.sid', cookieOptions());
    const loginRequest = req.method === 'POST' && ['/users/login', '/users/signup'].includes(req.path);
    if (loginRequest || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  });
}

module.exports = { SESSION_LIFETIME_MS, cookieOptions, sessionOptions, completeLogin, enforceSessionLifetime };

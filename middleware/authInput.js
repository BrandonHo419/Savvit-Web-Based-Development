function text(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && [...value].length <= max;
}

function validateLogin(req, res, next) {
  const body = req.body;
  // Preserve legacy credentials: registration policy is not a login requirement.
  if (!body || !text(body.email, 255) || typeof body.password !== 'string' || !body.password.length) {
    return res.status(400).send('Email and password must be nonempty strings.');
  }
  next();
}

function validateRegistration(req, res, next) {
  const body = req.body;
  if (!body || !text(body.username, 100)) {
    return res.status(400).send('Username must contain 1–100 characters and cannot be blank.');
  }
  if (!text(body.email, 255) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return res.status(400).send('Enter a valid email address of at most 255 characters.');
  }
  if (typeof body.password !== 'string' || [...body.password].length < 8 || Buffer.byteLength(body.password, 'utf8') > 72) {
    return res.status(400).send('Password must contain at least 8 characters and at most 72 UTF-8 bytes.');
  }
  next();
}

module.exports = { validateLogin, validateRegistration };

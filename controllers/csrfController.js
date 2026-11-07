const { randomBytes } = require('node:crypto');

module.exports = function csrfToken(req, res) {
  res.set('Cache-Control', 'private, no-store');
  // Keep the token stable for open forms; successful login regenerates the session.
  if (req.session.csrfToken) return res.json({ csrfToken: req.session.csrfToken });
  const token = randomBytes(32).toString('hex');
  req.session.csrfToken = token;
  req.session.save(error => {
    if (error) return res.status(500).json({ error: 'Unable to prepare the form. Please retry.' });
    res.json({ csrfToken: token });
  });
};

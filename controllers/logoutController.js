module.exports = function logout(req, res) {
  res.set('Cache-Control', 'no-store');
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Authentication required' });
  req.logout(error => {
    if (error) return res.status(500).json({ error: 'Unable to log out. Please retry.' });
    req.session.destroy(error => {
      if (error) return res.status(500).json({ error: 'Unable to end your session. Please retry.' });
      res.clearCookie('connect.sid', { path: '/', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
      res.status(204).end();
    });
  });
};

const pool = require('../models/db');
const boardWrite = require('../models/boardWrite');
const { validId } = require('../middleware/authorization');

exports.listViewers = async (req, res) => {
  try {
    const [viewers] = await pool.query(
      `SELECT u.user_id, u.username FROM board_viewers access
       JOIN users u ON u.user_id = access.user_id
       WHERE access.board_id = ? ORDER BY u.username, u.user_id`, [req.params.board_id]
    );
    res.json({ viewers });
  } catch (error) {
    console.error('Unable to list board viewers:', error);
    res.status(500).json({ error: 'Unable to load board viewers' });
  }
};

exports.addViewer = async (req, res) => {
  const body = req.body;
  if (!body || Object.keys(body).length !== 1 || typeof body.username !== 'string'
      || !body.username.trim() || body.username.trim().length > 100) {
    return res.status(400).json({ error: 'Provide one exact username of 1 to 100 characters' });
  }
  try {
    // Binary comparison makes the supplied username exact regardless of database collation.
    const [users] = await pool.query(
      'SELECT user_id FROM users WHERE CAST(username AS BINARY) = CAST(? AS BINARY)', [body.username.trim()]
    );
    if (!users.length || Number(users[0].user_id) === Number(req.user.user_id)) {
      return res.status(404).json({ error: 'No eligible account matches that username' });
    }
    const result = await boardWrite(req.params.board_id, req.user.user_id,
      'INSERT IGNORE INTO board_viewers (board_id, user_id) VALUES (?, ?)',
      [req.params.board_id, users[0].user_id]);
    if (!result) return res.status(404).json({ error: 'Resource not found' });
    res.status(204).end();
  } catch (error) {
    console.error('Unable to add board viewer:', error);
    res.status(500).json({ error: 'Unable to add board viewer' });
  }
};

exports.removeViewer = async (req, res) => {
  if (!validId(req.params.user_id)) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    const result = await boardWrite(req.params.board_id, req.user.user_id,
      'DELETE FROM board_viewers WHERE board_id = ? AND user_id = ?',
      [req.params.board_id, req.params.user_id]);
    if (!result) return res.status(404).json({ error: 'Resource not found' });
    res.status(204).end();
  } catch (error) {
    console.error('Unable to remove board viewer:', error);
    res.status(500).json({ error: 'Unable to remove board viewer' });
  }
};

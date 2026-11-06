const pool = require('../models/db');
const { validId } = require('../middleware/authorization');

exports.getBoardsForUser = async (req, res) => {
  const { user_id } = req.params;
  if (!validId(user_id)) return res.status(400).json({ error: 'Invalid user ID' });
  try {
    const [rows] = await pool.query(
      `SELECT
  b.board_id,
  b.name,
  b.description,
  b.visibility,
  b.created_at,
  (
    SELECT p.image_url
    FROM pins p JOIN boards original ON original.board_id = p.board_id
    WHERE (p.board_id = b.board_id OR EXISTS (
      SELECT 1 FROM board_pins saved WHERE saved.board_id = b.board_id AND saved.pin_id = p.pin_id
    )) AND (original.user_id = ? OR original.visibility = 'public' OR (original.visibility = 'semi-private' AND EXISTS (SELECT 1 FROM board_viewers access WHERE access.board_id = original.board_id AND access.user_id = ?)))
    ORDER BY p.created_at DESC
    LIMIT 1
  ) AS thumbnail,
  (
    SELECT COUNT(*) FROM pins p JOIN boards original ON original.board_id = p.board_id
    WHERE (p.board_id = b.board_id OR EXISTS (
      SELECT 1 FROM board_pins saved WHERE saved.board_id = b.board_id AND saved.pin_id = p.pin_id
    )) AND (original.user_id = ? OR original.visibility = 'public' OR (original.visibility = 'semi-private' AND EXISTS (SELECT 1 FROM board_viewers access WHERE access.board_id = original.board_id AND access.user_id = ?)))
  ) AS pin_count
FROM boards b
WHERE b.user_id = ? AND (b.user_id = ? OR b.visibility = 'public' OR (b.visibility = 'semi-private' AND EXISTS (SELECT 1 FROM board_viewers access WHERE access.board_id = b.board_id AND access.user_id = ?)))
ORDER BY b.created_at DESC;`,
      [req.user.user_id, req.user.user_id, req.user.user_id, req.user.user_id, user_id, req.user.user_id, req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to get boards:', err);

    res.status(500).json({
        error: 'Failed to get boards'
    });
}
};

exports.createBoard = async (req, res) => {
  const { name } = req.body || {};
  const user_id = req.user.user_id;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
    return res.status(400).json({ error: 'Board name must contain 1 to 255 characters' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO boards (name, user_id, visibility) VALUES (?, ?, 'private')`,
      [name.trim(), user_id]
    );
    res.status(201).json({ message: 'Board created', board_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create board', details: err });
  }
};

exports.getPinsForBoard = async (req, res) => {
  const boardId = req.params.board_id;
  const userId = req.user.user_id;

  try {
    const [pins] = await pool.query(
      `
SELECT
  p.*,
  u.username,
  COUNT(DISTINCT e2.engagement_id) AS like_count,
  IF(COUNT(DISTINCT e1.engagement_id) > 0, 1, 0) AS is_liked
FROM pins p
JOIN users u ON u.user_id = p.user_id
JOIN boards original ON original.board_id = p.board_id
LEFT JOIN engagements e1 ON e1.pin_id = p.pin_id AND e1.user_id = ? AND e1.type = 'like'
LEFT JOIN engagements e2 ON e2.pin_id = p.pin_id AND e2.type = 'like'
WHERE (p.board_id = ? OR EXISTS (
  SELECT 1 FROM board_pins saved WHERE saved.board_id = ? AND saved.pin_id = p.pin_id
)) AND (original.user_id = ? OR original.visibility = 'public' OR (original.visibility = 'semi-private' AND EXISTS (SELECT 1 FROM board_viewers access WHERE access.board_id = original.board_id AND access.user_id = ?)))
GROUP BY p.pin_id, u.username
ORDER BY p.created_at DESC
      `,
      [userId, boardId, boardId, userId, userId]
    );

    res.status(200).json(pins);
  } catch (err) {
    console.error(' Error fetching pins with likes:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getBoard = (req, res) => {
  res.json({
    ...req.accessBoard,
    is_owner: Number(req.accessBoard.user_id) === Number(req.user.user_id)
  });
};

exports.updateBoard = async (req, res) => {
  const body = req.body;
  const allowed = ['name', 'description', 'visibility'];
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || !Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) {
    return res.status(400).json({ error: 'Provide name, description or visibility only' });
  }
  const changes = {};
  if (Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 255) {
      return res.status(400).json({ error: 'Board name must contain 1 to 255 characters' });
    }
    changes.name = body.name.trim();
  }
  if (Object.hasOwn(body, 'description')) {
    if (typeof body.description !== 'string' || body.description.length > 10000) {
      return res.status(400).json({ error: 'Description must be text of at most 10000 characters' });
    }
    changes.description = body.description.trim();
  }
  if (Object.hasOwn(body, 'visibility')) {
    if (!['private', 'public', 'semi-private'].includes(body.visibility)) {
      return res.status(400).json({ error: 'Visibility must be private, public or semi-private' });
    }
    changes.visibility = body.visibility;
  }
  try {
    // Column names come exclusively from the whitelist above; values are bound.
    const fields = Object.keys(changes);
    await pool.query(
      `UPDATE boards SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE board_id = ? AND user_id = ?`,
      [...Object.values(changes), req.params.board_id, req.user.user_id]
    );
    res.json({ message: 'Board settings saved' });
  } catch (err) {
    console.error('Failed to update board:', err);
    res.status(500).json({ error: 'Failed to update board' });
  }
};

exports.getPublicBoards = async (req, res) => {
  const q = req.query.q === undefined ? '' : req.query.q;
  const page = req.query.page === undefined ? '1' : req.query.page;
  if (typeof q !== 'string' || q.length > 100 || typeof page !== 'string'
      || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) > 10000) {
    return res.status(400).json({ error: 'Use a search of at most 100 characters and a page from 1 to 10000' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT b.board_id, b.name, b.description, u.username AS owner_name
       FROM boards b JOIN users u ON u.user_id = b.user_id
       WHERE b.visibility = 'public' AND LOCATE(?, b.name) > 0
       ORDER BY b.created_at DESC, b.board_id DESC LIMIT ? OFFSET ?`,
      [q.trim(), 21, (Number(page) - 1) * 20]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ boards: rows.slice(0, 20), page: Number(page), has_more: rows.length > 20 && Number(page) < 10000 });
  } catch (err) {
    console.error('Failed to discover boards:', err);
    res.status(500).json({ error: 'Unable to load public boards' });
  }
};

// Removing membership does not require permission to read the original pin.
exports.removeReference = async (req, res) => {
  if (!validId(req.params.pin_id)) return res.status(400).json({ error: 'Invalid pin ID' });
  try {
    // Recheck ownership in the mutation; never remove an original-board membership.
    await pool.query(
      `DELETE saved FROM board_pins saved
       JOIN boards destination ON destination.board_id = saved.board_id
       JOIN pins original ON original.pin_id = saved.pin_id
       WHERE saved.board_id = ? AND saved.pin_id = ? AND destination.user_id = ?
         AND original.board_id <> saved.board_id`,
      [req.params.board_id, req.params.pin_id, req.user.user_id]
    );
    res.status(204).end();
  } catch (err) {
    console.error('Failed to remove saved reference:', err);
    res.status(500).json({ error: 'Unable to remove saved reference' });
  }
};

exports.deleteBoard = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [boards] = await connection.query(
      'SELECT board_id FROM boards WHERE board_id = ? AND user_id = ? FOR UPDATE',
      [req.params.board_id, req.user.user_id]
    );
    if (!boards.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Resource not found' });
    }
    // A locking read sees committed pin writes that completed before our board lock.
    const [originals] = await connection.query(
      'SELECT pin_id FROM pins WHERE board_id = ? LIMIT 1 FOR UPDATE', [req.params.board_id]
    );
    if (originals.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'This board contains original pins. Move or delete them before deleting the board.' });
    }
    await connection.query('DELETE FROM board_pins WHERE board_id = ?', [req.params.board_id]);
    await connection.query('DELETE FROM board_follows WHERE board_id = ?', [req.params.board_id]);
    await connection.query('DELETE FROM boards WHERE board_id = ? AND user_id = ?', [req.params.board_id, req.user.user_id]);
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); }
      catch (rollbackError) { console.error('Board deletion rollback failed:', rollbackError); }
    }
    console.error('Failed to delete board:', error);
    res.status(500).json({ error: 'Unable to delete board' });
  } finally {
    if (connection) connection.release();
  }
};

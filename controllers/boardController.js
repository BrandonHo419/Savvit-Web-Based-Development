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
    )) AND (original.user_id = ? OR original.visibility = 'public')
    ORDER BY p.created_at DESC
    LIMIT 1
  ) AS thumbnail,
  (
    SELECT COUNT(*) FROM pins p JOIN boards original ON original.board_id = p.board_id
    WHERE (p.board_id = b.board_id OR EXISTS (
      SELECT 1 FROM board_pins saved WHERE saved.board_id = b.board_id AND saved.pin_id = p.pin_id
    )) AND (original.user_id = ? OR original.visibility = 'public')
  ) AS pin_count
FROM boards b
WHERE b.user_id = ? AND (b.user_id = ? OR b.visibility = 'public')
ORDER BY b.created_at DESC;`,
      [req.user.user_id, req.user.user_id, user_id, req.user.user_id]
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
)) AND (original.user_id = ? OR original.visibility = 'public')
GROUP BY p.pin_id, u.username
ORDER BY p.created_at DESC
      `,
      [userId, boardId, boardId, userId]
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

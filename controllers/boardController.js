const pool = require('../models/db');

exports.getBoardsForUser = async (req, res) => {
  const { user_id } = req.params;
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
    FROM pins p
    WHERE p.board_id = b.board_id
    ORDER BY p.created_at DESC
    LIMIT 1
  ) AS thumbnail,
  (
    SELECT COUNT(*) FROM pins WHERE board_id = b.board_id
  ) AS pin_count
FROM boards b
WHERE b.user_id = ?
ORDER BY b.created_at DESC;`,
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get boards', details: err });
  }
};

exports.createBoard = async (req, res) => {
  const { name, user_id } = req.body;
  try {
    const [result] = await pool.query(
      `INSERT INTO boards (name, user_id) VALUES (?, ?)`,
      [name, user_id]
    );
    res.status(201).json({ message: 'Board created', board_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create board', details: err });
  }
};

exports.getPinsForBoard = async (req, res) => {
  const boardId = req.params.board_id;
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id query param' });
  }

  try {
    const [pins] = await pool.query(
      `
SELECT
  p.*,
  COUNT(DISTINCT e2.engagement_id) AS like_count,
  IF(COUNT(DISTINCT e1.engagement_id) > 0, 1, 0) AS is_liked
FROM pins p
LEFT JOIN engagements e1 ON e1.pin_id = p.pin_id AND e1.user_id = ? AND e1.type = 'like'
LEFT JOIN engagements e2 ON e2.pin_id = p.pin_id AND e2.type = 'like'
WHERE p.board_id = ?
GROUP BY p.pin_id
ORDER BY p.created_at DESC
      `,
      [userId, boardId]
    );

    res.status(200).json(pins);
  } catch (err) {
    console.error(' Error fetching pins with likes:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

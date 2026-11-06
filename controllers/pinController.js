const pool = require('../models/db');
const boardWrite = require('../models/boardWrite');
const { unlink } = require('node:fs/promises');

function isRemoteImageUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
// POST /pins — Create a new pin
exports.createPin = async (req, res) => {
  const {
    title = '',
    description = '',
    link_url = '',
    board_id
  } = req.body;
  const user_id = req.user.user_id;
  // The legacy pin enum stays binary; access is always governed by its original board.
  const visibility = req.accessBoard.visibility === 'public' ? 'public' : 'private';

  if (typeof title !== 'string' || typeof link_url !== 'string' || !title.trim() || !link_url.trim()) {
    return res.status(400).json({ error: 'Title and link URL are required.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded.' });
  }

  const image_url = `/uploads/${req.file.filename}`;

  try {
    const result = await boardWrite(board_id, req.user.user_id,
      `INSERT INTO pins (title, description, image_url, link_url, user_id, visibility, board_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description, image_url, link_url, user_id, visibility, board_id]
    );

    if (!result) {
      await unlink(req.file.path);
      return res.status(404).json({ error: 'Destination board not found' });
    }

    res.status(201).json({
      message: 'Pin created',
      pin_id: result.insertId,
      fileName: req.file.filename
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create pin', details: err });
  }
};


// GET /pins — Get all pins
exports.getAllPins = async (req, res) => {
  try {
    const [pins] = await pool.query(
      `SELECT p.*, u.username
       FROM pins p
       JOIN users u ON p.user_id = u.user_id
       JOIN boards b ON b.board_id = p.board_id
       WHERE b.user_id = ? OR b.visibility = 'public' OR (b.visibility = 'semi-private' AND EXISTS (SELECT 1 FROM board_viewers access WHERE access.board_id = b.board_id AND access.user_id = ?))
       ORDER BY p.created_at DESC`,
       [req.user.user_id, req.user.user_id]
    );
    res.json(pins);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pins', details: err });
  }
};

// GET /pins/:id — Get a single pin
exports.getPinById = async (req, res) => {
  const { id } = req.params;
  try {
    const [pins] = await pool.query(
      `SELECT p.*, u.username
       FROM pins p
       JOIN users u ON p.user_id = u.user_id
       WHERE p.pin_id = ?`,
      [id]
    );

    if (pins.length === 0) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    res.json(pins[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching pin', details: err });
  }
};

// POST /pins/:id/like — Like/unlike a pin
exports.toggleLike = async (req, res) => {
  const user_id = req.user.user_id;
  const { id: pin_id } = req.params;

  try {
    const [existing] = await pool.query(
      `SELECT * FROM engagements WHERE user_id = ? AND pin_id = ? AND type = 'like'`,
      [user_id, pin_id]
    );

    let is_liked;

    if (existing.length > 0) {
      await pool.query(
        `DELETE FROM engagements WHERE user_id = ? AND pin_id = ? AND type = 'like'`,
        [user_id, pin_id]
      );
      is_liked = false;
    } else {
      await pool.query(
        `INSERT INTO engagements (user_id, pin_id, type) VALUES (?, ?, 'like')`,
        [user_id, pin_id]
      );
      is_liked = true;
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS like_count FROM engagements WHERE pin_id = ? AND type = 'like'`,
      [pin_id]
    );

    const like_count = countResult[0]?.like_count ?? 0;

    res.json({ is_liked, like_count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like', details: err });
  }
};

// POST /pins/:id/save — Save to a board
exports.saveToBoard = async (req, res) => {
  const { board_id } = req.body;
  const { id: pin_id } = req.params;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT IGNORE INTO board_pins (board_id, pin_id) VALUES (?, ?)`,
      [board_id, pin_id]
    );

    // Repeat saves are idempotent and do not duplicate engagement records.
    if (result.affectedRows > 0) {
      await connection.query(
        `INSERT INTO engagements (user_id, pin_id, type) VALUES (?, ?, 'save')`,
        [req.user.user_id, pin_id]
      );
    }
    await connection.commit();
    res.status(200).json({ message: 'Pin saved to board' });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); }
      catch (rollbackError) { console.error('Save rollback failed:', rollbackError); }
    }
    console.error('Failed to save pin:', err);
    res.status(500).json({ error: 'Failed to save pin' });
  } finally {
    if (connection) connection.release();
  }
};

exports.movePinToBoard = async (req, res) => {
  const { id: pin_id } = req.params;
  const { board_id } = req.body;

  if (!board_id) {
    return res.status(400).json({ error: 'Board ID is required.' });
  }

  try {
    const result = await boardWrite(board_id, req.user.user_id,
      `UPDATE pins SET board_id = ? WHERE pin_id = ? AND user_id = ?`,
      [board_id, pin_id, req.user.user_id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Destination board not found' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    res.status(200).json({ message: 'Pin moved successfully' });
  } catch (err) {
    console.error('Failed to move pin:', err);
    res.status(500).json({ error: 'Failed to move pin', details: err });
  }
};

exports.addComment = async (req, res) => {
  const { content } = req.body || {};
  const user_id = req.user.user_id;
  const { pin_id } = req.params;

  if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });

  try {
    const [result] = await pool.query(
      `INSERT INTO comments (user_id, pin_id, content) VALUES (?, ?, ?)`,
      [user_id, pin_id, content]
    );

    res.status(201).json({ message: 'Comment added', comment_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment', details: err });
  }
};


exports.addReply = async (req, res) => {
  const { content, parent_reply_id = null } = req.body || {};
  const user_id = req.user.user_id;
  const { comment_id } = req.params;

  if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Reply cannot be empty.' });

  try {
    const [result] = await pool.query(
      `INSERT INTO replies (comment_id, parent_reply_id, user_id, content) VALUES (?, ?, ?, ?)`,
      [comment_id, parent_reply_id, user_id, content]
    );

    res.status(201).json({ message: 'Reply added', reply_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add reply', details: err });
  }
};
exports.getCommentsWithReplies = async (req, res) => {
  const { pin_id } = req.params;

  try {
    const [comments] = await pool.query(
      `SELECT c.*, u.username, u.avatar_url
       FROM comments c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.pin_id = ? AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [pin_id]
    );

    const commentIds = comments.map(c => c.comment_id);

    const [replies] = commentIds.length
      ? await pool.query(
        `SELECT r.*, u.username, u.avatar_url
           FROM replies r
           JOIN users u ON r.user_id = u.user_id
           WHERE r.comment_id IN (?) AND r.is_deleted = false
           ORDER BY r.created_at ASC`,
        [commentIds]
      )
      : [[]];

    const commentMap = comments.map(comment => ({
      ...comment,
      user_username: comment.username,
      user_avatar_url: comment.avatar_url,
      replies: replies
        .filter(r => r.comment_id === comment.comment_id)
        .map(reply => ({
          ...reply,
          user_username: reply.username,
          user_avatar_url: reply.avatar_url
        }))
    }));

    res.json(commentMap);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments and replies', details: err });
  }
};

// POST /pins/youtube — Create a YouTube pin
exports.createYouTubePin = async (req, res) => {
  const { id, title, description, destination, img_blob, board_id } = req.body;
  const user_id = req.user.user_id;

  // Imported content must not claim ownership of another user's local upload.
  if (!isRemoteImageUrl(img_blob)) {
    return res.status(400).json({ error: 'Imported images require an HTTP(S) URL' });
  }

  // Validate required fields
  if (!title || !destination || !img_blob || !user_id || !board_id) {
    return res.status(400).json({ error: 'Missing required fields for YouTube pin.' });
  }

  try {
const result = await boardWrite(board_id, req.user.user_id,
  `INSERT INTO pins (title, description, image_url, link_url, user_id, board_id)
VALUES (?, ?, ?, ?, ?, ?)`,
  [title, description, img_blob, destination, user_id, board_id]
);

    if (!result) {
      return res.status(404).json({ error: 'Destination board not found' });
    }

    res.status(201).json({ pin_id: result.insertId });
  } catch (err) {
    console.error('Error saving YouTube pin:', err);
    res.status(500).json({ error: 'Failed to save YouTube pin.' });
  }
};

// POST /pins/pixabay — Create a Pixabay pin
exports.createPixabayPin = async (req, res) => {
  const { id, title, description, destination, img_blob, board_id } = req.body;
  const user_id = req.user.user_id;

  if (!isRemoteImageUrl(img_blob)) {
    return res.status(400).json({ error: 'Imported images require an HTTP(S) URL' });
  }

  // Validate required fields
  if (!title || !destination || !img_blob || !user_id || !board_id) {
    return res.status(400).json({ error: 'Missing required fields for Pixabay pin.' });
  }

  try {
    const result = await boardWrite(board_id, req.user.user_id,
      `INSERT INTO pins (title, description, image_url, link_url, user_id, board_id)
VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, img_blob, destination, user_id, board_id]
    );

    if (!result) {
      return res.status(404).json({ error: 'Destination board not found' });
    }

    res.status(201).json({ pin_id: result.insertId });
  } catch (err) {
    console.error('Error saving Pixabay pin:', err);
    res.status(500).json({ error: 'Failed to save Pixabay pin.' });
  }
};

// DELETE /pins/:id — Delete a pin
exports.deletePin = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.user_id;

  if (!user_id) return res.status(400).json({ error: 'Missing user ID' });

  try {
    // Check ownership
    const [rows] = await pool.query(
      'SELECT * FROM pins WHERE pin_id = ? AND user_id = ?',
      [id, user_id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized or pin not found.' });
    }

    // Step 1: Delete replies of comments related to the pin
    await pool.query(`
      DELETE r FROM replies r
      JOIN comments c ON r.comment_id = c.comment_id
      WHERE c.pin_id = ?`, [id]);

    // Step 2: Delete comments on the pin
    await pool.query('DELETE FROM comments WHERE pin_id = ?', [id]);

    // Step 3: Delete engagements and board-pins
    await pool.query('DELETE FROM engagements WHERE pin_id = ?', [id]);
    await pool.query('DELETE FROM board_pins WHERE pin_id = ?', [id]);

    // Step 4: Delete the pin itself
    await pool.query('DELETE FROM pins WHERE pin_id = ?', [id]);

    res.status(200).json({ message: 'Pin deleted successfully.' });

  } catch (err) {
    console.error('Error deleting pin:', err);
    // Prevent sending multiple responses
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to delete pin', details: err.message });
    }
  }
};

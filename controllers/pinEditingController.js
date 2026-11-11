const pool = require('../models/db');

exports.updatePin = async (req, res) => {
  const { title, description, link_url } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 255 ||
      typeof description !== 'string' || description.length > 10000 ||
      typeof link_url !== 'string' || link_url.length > 2048) {
    return res.status(400).json({ error: 'Use a title of 1–255 characters, description up to 10,000 and URL up to 2,048.' });
  }
  try {
    const url = new URL(link_url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {
    return res.status(400).json({ error: 'Enter a complete HTTP or HTTPS destination URL without credentials.' });
  }
  try {
    const [result] = await pool.query(
      `UPDATE pins p JOIN boards b ON b.board_id = p.board_id
       SET p.title = ?, p.description = ?, p.link_url = ?
       WHERE p.pin_id = ? AND p.user_id = ? AND b.user_id = ?`,
      [title.trim(), description.trim(), link_url.trim(), req.params.id, req.user.user_id, req.user.user_id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Pin not found' });
    res.json({ title: title.trim(), description: description.trim(), link_url: link_url.trim() });
  } catch {
    res.status(500).json({ error: 'Unable to update pin. Please try again.' });
  }
};

const pool = require('../models/db');
const { validId } = require('../middleware/authorization');
const titles = [null, 'Original Team Member', 'Co-developer', 'Co-founder'];

exports.updateAccount = async (req, res) => {
  const { role, team_title } = req.body || {};
  if (!validId(req.params.user_id) || !['admin', 'user'].includes(role) || !titles.includes(team_title)) {
    return res.status(400).json({ error: 'Choose a valid account, role and team title.' });
  }
  try {
    const [result] = await pool.query(
      "UPDATE users SET role = ?, team_title = ? WHERE user_id = ? AND role IN ('user', 'admin')",
      [role, team_title, req.params.user_id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Account not found or protected.' });
    res.json({ message: 'Account permissions and title updated.' });
  } catch { res.status(500).json({ error: 'Unable to update account.' }); }
};

exports.getSummary = async (req, res) => {
  try {
    const [[summary]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM users) AS accounts,
      (SELECT COUNT(*) FROM boards) AS boards,
      (SELECT COUNT(*) FROM pins) AS originals,
      (SELECT COUNT(*) FROM board_pins) AS saved_references,
      (SELECT COUNT(*) FROM comments WHERE is_deleted = false) AS comments,
      (SELECT COUNT(*) FROM replies WHERE is_deleted = false) AS replies`);
    res.json(summary);
  } catch { res.status(500).json({ error: 'Unable to load site statistics.' }); }
};

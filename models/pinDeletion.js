const pool = require('./db');

module.exports = async function deleteOwnedPin(pinId, userId) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Recheck both owners under locks: route authorization may precede a move.
    const [pins] = await connection.query(
      `SELECT p.pin_id FROM pins p JOIN boards b ON b.board_id = p.board_id
       WHERE p.pin_id = ? AND p.user_id = ? AND b.user_id = ? FOR UPDATE`,
      [pinId, userId, userId]
    );
    if (!pins.length) {
      await connection.rollback();
      return false;
    }

    // Detach internal reply chains before deletion: InnoDB checks self-FKs immediately.
    // An inconsistent external child still blocks deletion and rolls everything back.
    await connection.query(
      `UPDATE replies r JOIN comments c ON c.comment_id = r.comment_id
       SET r.parent_reply_id = NULL WHERE c.pin_id = ?`, [pinId]
    );
    await connection.query(
      `DELETE r FROM replies r JOIN comments c ON c.comment_id = r.comment_id
       WHERE c.pin_id = ?`, [pinId]
    );
    for (const table of ['comments', 'engagements', 'board_pins', 'image_metadata',
      'pin_categories', 'pin_tags', 'pin_views']) {
      await connection.query(`DELETE FROM ${table} WHERE pin_id = ?`, [pinId]);
    }
    await connection.query('DELETE FROM pins WHERE pin_id = ?', [pinId]);
    await connection.commit();
    // Files are intentionally retained; database authorization revokes access.
    return true;
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); }
      catch (rollbackError) { console.error('Pin deletion rollback failed:', rollbackError.code || rollbackError.name); }
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

const pool = require('./db');

// Board deletion takes the same row lock, preventing writes to a deleted destination.
module.exports = async function boardWrite(boardId, userId, sql, params) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [boards] = await connection.query(
      'SELECT board_id FROM boards WHERE board_id = ? AND user_id = ? FOR UPDATE',
      [boardId, userId]
    );
    if (!boards.length) {
      await connection.rollback();
      return null;
    }
    const [result] = await connection.query(sql, params);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); }
      catch (rollbackError) { console.error('Board write rollback failed:', rollbackError); }
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

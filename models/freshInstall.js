const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { validateRegistration } = require('../middleware/authInput');

async function initializeEmptyDatabase(connection) {
  const [[database]] = await connection.query('SELECT DATABASE() AS name');
  if (!database.name || ['mysql', 'sys', 'information_schema', 'performance_schema'].includes(database.name)) {
    throw new Error('Choose a dedicated empty Savvit database.');
  }
  const [[lock]] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [`savvit-install:${database.name}`]);
  if (Number(lock.acquired) !== 1) throw new Error('Another installation is running.');
  try {
    const [[result]] = await connection.query('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()');
    if (Number(result.total) !== 0) throw new Error('Database is not empty. No changes were made.');
    const schema = await fs.readFile(path.join(__dirname, '../database/schema.sql'), 'utf8');
    const statements = schema.replace(/^--.*$/gm, '').split(';').map(sql => sql.trim()).filter(Boolean);
    if (statements.some(sql => !/^CREATE TABLE\b/.test(sql))) throw new Error('Unexpected installation statement.');
    // DDL commits individually. On failure, keep the database for inspection; never drop it.
    for (const sql of statements) await connection.query(sql);
  } finally { await connection.query('SELECT RELEASE_LOCK(?)', [`savvit-install:${database.name}`]); }
}

async function bootstrapOwner(connection, account) {
  let valid = false;
  validateRegistration({ body: account }, { status() { return this; }, send() {} }, () => { valid = true; });
  if (!valid) throw new Error('Supply a valid owner username, email and password (8+ characters, at most 72 UTF-8 bytes).');
  const [[lock]] = await connection.query("SELECT GET_LOCK('savvit-owner-bootstrap', 0) AS acquired");
  if (Number(lock.acquired) !== 1) throw new Error('Another owner setup is running.');
  try {
    await connection.beginTransaction();
    const [users] = await connection.query('SELECT user_id FROM users FOR UPDATE');
    if (users.length) throw new Error('Owner setup requires zero accounts. Stop the app and use a fresh database.');
    const hash = await bcrypt.hash(account.password, 13);
    const [result] = await connection.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'owner')",
      [account.username, account.email, hash]
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { await connection.query("SELECT RELEASE_LOCK('savvit-owner-bootstrap')"); }
}

module.exports = { initializeEmptyDatabase, bootstrapOwner };

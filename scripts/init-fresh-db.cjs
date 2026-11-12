require('dotenv').config();
const mysql = require('mysql2/promise');
const { initializeEmptyDatabase, bootstrapOwner } = require('../models/freshInstall');

async function main() {
  const [mode, database] = process.argv.slice(2);
  if (!['schema', 'owner'].includes(mode) || !/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(database || '')) {
    throw new Error('Usage: node scripts/init-fresh-db.cjs <schema|owner> <new_database_name>');
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database, connectTimeout: 10000
  });
  try {
    if (mode === 'schema') {
      await initializeEmptyDatabase(connection);
      console.log('Empty schema installed. No accounts or content were seeded.');
    } else {
      await bootstrapOwner(connection, {
        username: process.env.SAVVIT_OWNER_USERNAME, email: process.env.SAVVIT_OWNER_EMAIL,
        password: process.env.SAVVIT_OWNER_PASSWORD
      });
      console.log('Owner account created. Remove the one-time owner setup variables before starting the app.');
    }
  } finally { await connection.end(); }
}
main().catch(error => {
  // Driver errors can contain connection details or statement parameters.
  console.error('Setup failed:', error.code || error.message);
  process.exitCode = 1;
});

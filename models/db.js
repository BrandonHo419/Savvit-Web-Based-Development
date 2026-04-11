
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    database: 'pinterest_clone'
});

module.exports = pool;

const sql = require("mssql");

const config = {
  port: parseInt(process.env.DB_PORT, 10),
  server: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustedConnection: true,
    trustServerCertificate: true,
    timeout: 30000,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const pool = new sql.ConnectionPool(config).connect();

module.exports = pool;
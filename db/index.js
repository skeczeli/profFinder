// db/index.js
const { Pool } = require("pg");

// Crear una pool de conexiones
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Exportar funciones de consulta
module.exports = {
  query: (text, params, callback) => {
    return pool.query(text, params, callback);
  },
  queryAll: (text, params) => {
    return new Promise((resolve, reject) => {
      pool.query(text, params, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res.rows);
        }
      });
    });
  },
  getPool: () => pool,
};

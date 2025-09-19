const sqlite3 = require("sqlite3").verbose();
// const { Pool } = require("pg"); // entfernt: Top-Level-Require von 'pg'

function convertPlaceholders(sql) {
  // naive: replace ? with $1.. outside single quotes
  let i = 0, out = "", inStr = false;
  for (let idx = 0; idx < sql.length; idx++) {
    const ch = sql[idx];
    if (ch === "'") {
      // handle escaped ''
      if (inStr && sql[idx + 1] === "'") {
        out += "''";
        idx++;
        continue;
      }
      inStr = !inStr;
      out += ch;
    } else if (ch === "?" && !inStr) {
      i += 1;
      out += `$${i}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function createPgDb(connectionString) {
  // Lazy-Require von 'pg' nur bei Bedarf
  let Pool;
  try {
    ({ Pool } = require("pg"));
  } catch (e) {
    throw new Error("PostgreSQL driver 'pg' is not installed. Run `npm i pg` in ./backend or unset DB_URL to use SQLite.");
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined
  });

  return {
    __driver: "pg",
    all(sql, params = [], cb) {
      pool.query(convertPlaceholders(sql), params)
        .then(r => cb(null, r.rows))
        .catch(err => cb(err));
    },
    get(sql, params = [], cb) {
      pool.query(convertPlaceholders(sql), params)
        .then(r => cb(null, r.rows[0] || null))
        .catch(err => cb(err));
    },
    run(sql, params = [], cb = () => {}) {
      pool.query(convertPlaceholders(sql), params)
        .then(r => cb.call({ changes: r.rowCount, lastID: undefined }, null))
        .catch(err => cb(err));
    },
    exec(sql, cb = () => {}) {
      pool.query(sql).then(() => cb(null)).catch(err => cb(err));
    },
    close(cb = () => {}) {
      pool.end().then(() => cb()).catch(cb);
    }
  };
}

function createSqliteDb(file) {
  const db = new sqlite3.Database(file || "database.sqlite");
  db.__driver = "sqlite";
  return db;
}

function createDb() {
  const url = process.env.DB_URL || process.env.DATABASE_URL;
  if (url) return createPgDb(url);
  return createSqliteDb(process.env.DB_FILE);
}

module.exports = { createDb };

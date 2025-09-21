const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const setupTables = require("../db-setup");

function initDb(DB_PATH) {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error("DB-Verbindungsfehler:", err.message);
    else console.log("📂 SQLite-Datenbank verbunden:", DB_PATH);
  });
  setupTables(db);
  return db;
}

function getDbSchema(db) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      (err, tables) => {
        if (err) return reject(err);
        const result = [];
        let pending = tables.length;
        if (pending === 0) return resolve({ tables: result });
        tables.forEach(({ name }) => {
          db.all(`PRAGMA table_info(${name})`, (e1, cols) => {
            if (e1) cols = [];
            db.all(`PRAGMA foreign_key_list(${name})`, (e2, fks) => {
              if (e2) fks = [];
              result.push({
                name,
                columns: cols.map(c => ({
                  name: c.name,
                  type: c.type,
                  pk: !!c.pk,
                  notnull: !!c.notnull,
                  dflt_value: c.dflt_value ?? null
                })),
                foreignKeys: fks.map(f => ({
                  from: f.from,
                  table: f.table,
                  to: f.to,
                  on_update: f.on_update,
                  on_delete: f.on_delete
                }))
              });
              if (--pending === 0) resolve({ tables: result });
            });
          });
        });
      }
    );
  });
}

function schemaToHtml(schema) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const now = new Date().toISOString();
  let html = `
    <div style="font-family: Arial, sans-serif; line-height:1.4">
      <h2>DB NEU VERBUNDEN – pTght Schema</h2>
      <p><small>${esc(now)}</small></p>
      <h3>SQLite Schema</h3>
  `;
  for (const t of schema.tables) {
    html += `<h4>Table: ${esc(t.name)}</h4>`;
    html += `<p><b>Columns</b></p><ul>`;
    for (const c of t.columns) {
      const flags = [];
      if (c.pk) flags.push("PK");
      if (c.notnull) flags.push("NOT NULL");
      if (c.dflt_value != null) flags.push(`DEFAULT ${esc(c.dflt_value)}`);
      html += `<li>${esc(c.name)} ${c.type ? esc(c.type) : ""} ${flags.length ? "(" + flags.join(", ") + ")" : ""}</li>`;
    }
    html += `</ul>`;
    html += `<p><b>Foreign Keys</b></p>`;
    if (!t.foreignKeys.length) {
      html += `<p>none</p>`;
    } else {
      html += `<ul>`;
      for (const fk of t.foreignKeys) {
        html += `<li>${esc(fk.from)} → ${esc(fk.table)}(${esc(fk.to)}) ON UPDATE ${esc(fk.on_update)} ON DELETE ${esc(fk.on_delete)}</li>`;
      }
      html += `</ul>`;
    }
  }
  html += `</div>`;
  return html;
}

function createIncrementalAdmin(db, setBanner) {
  db.get(
    `SELECT COUNT(*) AS cnt
     FROM users
     WHERE is_admin = 1 AND email LIKE 'admin%@example.com'`,
    (countErr, row) => {
      if (countErr) {
        console.error("Admin-Zählfehler:", countErr.message);
        return;
      }
      const nextNum = (row?.cnt || 0) + 1;
      const adminName = `admin${nextNum}`;
      const adminEmail = `${adminName}@example.com`;
      const hashed = bcrypt.hashSync("test1234", 10);

      db.run(
        `INSERT INTO users (firstname, lastname, birthday, email, password, is_admin, is_confirmed)
         VALUES (?, ?, ?, ?, ?, 1, 1)`,
        [adminName, "", "1970-01-01", adminEmail, hashed],
        function (insErr) {
          if (insErr) {
            console.error("Admin-Anlegefehler:", insErr.message);
            return;
          }
          const info = { name: adminName, email: adminEmail, createdAt: new Date().toISOString() };
          setBanner(info);
          console.log(`🛠️ Admin erstellt: ${adminName} (${adminEmail}) / Passwort: test1234`);
        }
      );
    }
  );
}

function createStartupTestUser(db, setBanner) {
  // Create a test user (testuserN@example.com) and try to auto-join a league
  try {
    db.get(`SELECT id FROM leagues ORDER BY id LIMIT 1`, (leagueErr, leagueRow) => {
      const leagueId = leagueRow && leagueRow.id ? leagueRow.id : null;

      db.get(`SELECT COUNT(*) AS cnt FROM users WHERE email LIKE 'testuser%@example.com'`, (countErr, row) => {
        if (countErr) {
          console.error('TestUser count error:', countErr.message);
          setBanner({ error: 'testuser_count_failed' });
          return;
        }
        const nextNum = (row && row.cnt ? row.cnt : 0) + 1;
        const userName = `testuser${nextNum}`;
        const userEmail = `${userName}@example.com`;
        const hashed = bcrypt.hashSync('test1234', 10);

        db.run(
          `INSERT INTO users (firstname, lastname, birthday, email, password, is_confirmed)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [userName, '', '1970-01-01', userEmail, hashed],
          function (insErr) {
            if (insErr) {
              console.error('TestUser create error:', insErr.message);
              setBanner({ error: 'testuser_create_failed', details: insErr.message });
              return;
            }
            const createdId = this && this.lastID ? this.lastID : null;
            const info = { name: userName, email: userEmail, id: createdId, createdAt: new Date().toISOString() };
            setBanner(info);
            console.log(`🧪 Test user created: ${userName} (${userEmail}) / Password: test1234`);

            // Try to auto-join user to league (if table exists and league found)
            if (leagueId) {
              db.run(`INSERT OR IGNORE INTO user_leagues (user_id, league_id) VALUES (?, ?)`, [createdId, leagueId], (ulErr) => {
                if (ulErr) console.warn('Failed to join user to league:', ulErr.message);
                else console.log(`Test user ${userName} joined league ${leagueId} (if not already).`);

                // After joining, try to find a match for that league or any match as a sample
                tryFindSampleMatch(db, createdId, leagueId, (matchInfo) => {
                  if (matchInfo) console.log('Sample match found for startup user:', matchInfo);
                });
              });
            } else {
              // No league to join; still try to find any match
              tryFindSampleMatch(db, createdId, null, (matchInfo) => {
                if (matchInfo) console.log('Sample match found for startup user (no league):', matchInfo);
              });
            }
          }
        );
      });
    });
  } catch (e) {
    console.error('createStartupTestUser failed:', e && (e.stack || e.message || e));
    setBanner({ error: 'testuser_failed', details: String(e) });
  }
}

function tryFindSampleMatch(db, userId, leagueId, cb) {
  // Prefer 'matches' table, then 'games'. Try to find a match in the same league if possible.
  try {
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='matches'`, (mErr, mRow) => {
      const table = mRow ? 'matches' : null;
      if (table) {
        const where = leagueId ? ` WHERE league_id = ${leagueId}` : '';
        db.get(`SELECT id, league_id FROM ${table}${where} ORDER BY id LIMIT 1`, (err, row) => {
          if (err) return cb(null);
          if (row) return cb({ table, id: row.id, league_id: row.league_id });
          // fallback to any match in table
          db.get(`SELECT id, league_id FROM ${table} ORDER BY id LIMIT 1`, (err2, row2) => {
            if (err2 || !row2) return cb(null);
            return cb({ table, id: row2.id, league_id: row2.league_id });
          });
        });
      } else {
        // try games table
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='games'`, (gErr, gRow) => {
          const gtable = gRow ? 'games' : null;
          if (!gtable) return cb(null);
          const where2 = leagueId ? ` WHERE league_id = ${leagueId}` : '';
          db.get(`SELECT id, league_id FROM ${gtable}${where2} ORDER BY id LIMIT 1`, (e, r) => {
            if (e || !r) {
              db.get(`SELECT id, league_id FROM ${gtable} ORDER BY id LIMIT 1`, (e2, r2) => {
                if (e2 || !r2) return cb(null);
                return cb({ table: gtable, id: r2.id, league_id: r2.league_id });
              });
            } else return cb({ table: gtable, id: r.id, league_id: r.league_id });
          });
        });
      }
    });
  } catch (e) {
    return cb(null);
  }
}

module.exports = { initDb, getDbSchema, schemaToHtml, createIncrementalAdmin };

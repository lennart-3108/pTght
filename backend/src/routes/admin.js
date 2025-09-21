const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function adminRoutes(ctx) {
  const router = express.Router();
  const { db, SECRET } = ctx;

  // Admin-Guard
  const requireAdmin = (req, res, next) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = jwt.verify(token, SECRET);
      if (!payload?.is_admin) return res.status(403).json({ error: "Forbidden" });
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };

  // Minimal placeholder endpoint
  router.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Admin-Statistiken
  router.get("/stats", requireAdmin, (_req, res) => {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE is_confirmed = 1) AS confirmedUsers,
        (SELECT COUNT(*) FROM users WHERE is_admin = 1) AS admins,
        (SELECT COUNT(*) FROM sports) AS sports,
        (SELECT COUNT(*) FROM cities) AS cities,
        (SELECT COUNT(*) FROM leagues) AS leagues
    `;
    db.get(sql, [], (err, row) => {
      if (err) return res.status(500).json({ error: "DB error", details: err.message });
      res.json(row || {});
    });
  });

  // Tabelle abrufen (Admin-only, validiert Tabelle vor Ausführung)
  router.get("/table/:table", requireAdmin, (req, res) => {
    const table = req.params.table;
    const limit = Number(req.query.limit) || 200;

    // Validate table exists to avoid unsafe interpolation
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ? AND name NOT LIKE 'sqlite_%'`,
      [table],
      (tgErr, tgRow) => {
        if (tgErr) {
          console.error(`Fehler beim Prüfen der Tabelle ${table}:`, tgErr);
          return res.status(500).json({ error: "DB error" });
        }
        if (!tgRow) return res.status(404).json({ error: "Unknown table" });

        // Spalten abrufen (safe because table existence validated)
        const columnsSql = `PRAGMA table_info(${table})`;
        db.all(columnsSql, [], (err, columns) => {
          if (err) {
            console.error(`Fehler beim Abrufen der Spalten für Tabelle ${table}:`, err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Tabellenspalten." });
          }

          // Daten abrufen
          const dataSql = `SELECT * FROM ${table} LIMIT ?`;
          db.all(dataSql, [limit], (err2, rows) => {
            if (err2) {
              console.error(`Fehler beim Abrufen der Daten für Tabelle ${table}:`, err2);
              return res.status(500).json({ error: "Fehler beim Abrufen der Tabellendaten." });
            }

            res.json({
              columns: columns.map((col) => col.name), // Alle Spaltennamen
              rows, // Alle Zeilen
            });
          });
        });
      }
    );
  });

  // Schema liefern für Create-Form
  router.get("/schema", requireAdmin, (req, res) => {
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: "DB error" });
        const tables = rows.map(r => r.name);
        const result = [];
        let i = 0;
        const next = () => {
          if (i >= tables.length) return res.json({ tables: result });
          const t = tables[i++];
          db.all(`PRAGMA table_info(${t})`, [], (e2, cols) => {
            if (e2) {
              result.push({ name: t, columns: [] });
              return next();
            }
            result.push({
              name: t,
              columns: cols.map(c => ({
                name: c.name,
                type: c.type,
                notnull: !!c.notnull,
                pk: !!c.pk,
                dflt_value: c.dflt_value
              }))
            });
            next();
          });
        };
        next();
      }
    );
  });

  // Schema einer Tabelle abrufen
  router.get("/schema/:table", (req, res) => {
    const table = req.params.table;
    const sql = `PRAGMA table_info(${table})`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error(`Fehler beim Abrufen des Schemas für Tabelle ${table}:`, err);
        return res.status(500).json({ error: "Fehler beim Abrufen des Tabellenschemas." });
      }
      res.json(rows);
    });
  });

  // Generisches Insert
  router.post("/create", requireAdmin, express.json(), (req, res) => {
    const { table, data } = req.body || {};
    if (!table || !data || typeof data !== "object") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
      [table],
      (err, row) => {
        if (err) return res.status(500).json({ error: "DB error" });
        if (!row) return res.status(400).json({ error: "Unknown table" });

        const keys = Object.keys(data).filter(k => data[k] !== undefined);
        if (keys.length === 0) return res.status(400).json({ error: "No data" });

        const placeholders = keys.map(() => "?").join(", ");
        const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
        const values = keys.map(k => data[k]);

        db.run(sql, values, function (e2) {
          if (e2) return res.status(400).json({ error: "Insert failed", details: e2.message });
          res.status(201).json({ id: this.lastID });
        });
      }
    );
  });

  // Generisches Update
  router.put("/table/:table/:id", requireAdmin, express.json(), (req, res) => {
    const { table, id } = req.params;
    const data = req.body || {};
    const keys = Object.keys(data).filter(k => k !== "id");
    if (keys.length === 0) return res.status(400).json({ error: "No data" });
    const setClause = keys.map(k => `${k} = ?`).join(", ");
    const values = keys.map(k => data[k]);
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    db.run(sql, [...values, id], function (err) {
      if (err) return res.status(400).json({ error: "Update failed", details: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Not found" });
      res.json({ updated: true });
    });
  });

  // Generisches Delete
  router.delete("/table/:table/:id", requireAdmin, (req, res) => {
    const { table, id } = req.params;
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    db.run(sql, [id], function (err) {
      if (err) return res.status(400).json({ error: "Delete failed", details: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Not found" });
      res.json({ deleted: true });
    });
  });

  return router;
};

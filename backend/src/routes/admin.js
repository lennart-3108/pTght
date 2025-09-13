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

  // Tabelleninhalt lesen
  router.get("/table/:name", requireAdmin, (req, res) => {
    const name = String(req.params.name || "");
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 200;

    db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
      [name],
      (err, row) => {
        if (err) return res.status(500).json({ error: "DB error", details: err.message });
        if (!row) return res.status(404).json({ error: "Unknown table" });

        db.all(`PRAGMA table_info(${name})`, [], (e2, cols) => {
          if (e2) return res.status(500).json({ error: "DB error", details: e2.message });
          const colNames = (cols || []).map(c => c.name);

          // Optional: nach id sortieren, wenn vorhanden
          const orderBy = colNames.includes("id") ? ` ORDER BY id DESC` : "";
          const sql = `SELECT * FROM ${name}${orderBy} LIMIT ?`;

          db.all(sql, [limit], (e3, rows) => {
            if (e3) return res.status(500).json({ error: "DB error", details: e3.message });
            res.json({ columns: colNames, rows: rows || [] });
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

  return router;
};

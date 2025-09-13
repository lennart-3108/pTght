const jwt = require("jsonwebtoken");

function createMiddleware(ctx) {
  const { db, SECRET } = ctx;

  function requireAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  }

  function requireAdmin(req, res, next) {
    if (!req.user?.is_admin) return res.sendStatus(403);
    next();
  }

  function ensureTables() {
    return new Promise((resolve) => {
      db.serialize(() => {
        db.run(
          `CREATE TABLE IF NOT EXISTS user_leagues (
             user_id INTEGER NOT NULL,
             league_id INTEGER NOT NULL,
             joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
             PRIMARY KEY (user_id, league_id),
             FOREIGN KEY(user_id) REFERENCES users(id),
             FOREIGN KEY(league_id) REFERENCES leagues(id)
           )`
        );
        db.run(
          `CREATE TABLE IF NOT EXISTS games (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             league_id INTEGER NOT NULL,
             kickoff_at TEXT NOT NULL,
             home TEXT NOT NULL,
             away TEXT NOT NULL,
             home_score INTEGER,
             away_score INTEGER,
             FOREIGN KEY(league_id) REFERENCES leagues(id)
           )`,
          () => resolve()
        );
      });
    });
  }

  return { requireAuth, requireAdmin, ensureTables };
}

module.exports = { createMiddleware };

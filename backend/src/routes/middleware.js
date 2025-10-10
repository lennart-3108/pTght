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
        // --- core membership table: which user is in which league ---
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

        // --- legacy fallback table for older flows ---
        db.run(
          `CREATE TABLE IF NOT EXISTS games (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             league_id INTEGER NOT NULL,
             kickoff_at TEXT,
             home TEXT,
             away TEXT,
             home_score INTEGER,
             away_score INTEGER,
             FOREIGN KEY(league_id) REFERENCES leagues(id)
           )`
        );

        // --- matches: new canonical table (supports single + team) ---
        db.run(
          `CREATE TABLE IF NOT EXISTS matches (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             league_id INTEGER NOT NULL,
             kickoff_at TEXT,
             status TEXT,               -- optional: open|scheduled|completed
             home_user_id INTEGER,      -- single sports
             away_user_id INTEGER,
             home_team_id INTEGER,      -- team sports
             away_team_id INTEGER,
             home_score INTEGER,
             away_score INTEGER,
             created_at TEXT DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY(league_id) REFERENCES leagues(id)
           )`
        );

        db.run(
          `CREATE TABLE IF NOT EXISTS match_messages (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             match_id INTEGER NOT NULL,
             sender_user_id INTEGER,
             sender_team_id INTEGER,
             body TEXT NOT NULL,
             created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
             FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE SET NULL,
             FOREIGN KEY(sender_team_id) REFERENCES teams(id) ON DELETE SET NULL
           )`
        );

        // --- teams & members (for team sports) ---
        db.run(
          `CREATE TABLE IF NOT EXISTS teams (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             name TEXT NOT NULL,
             league_id INTEGER NOT NULL,
             sport_id INTEGER,
             city_id INTEGER,
             captain_user_id INTEGER,
             FOREIGN KEY(league_id) REFERENCES leagues(id),
             FOREIGN KEY(sport_id) REFERENCES sports(id),
             FOREIGN KEY(city_id) REFERENCES cities(id),
             FOREIGN KEY(captain_user_id) REFERENCES users(id)
           )`
        );
        db.run(
          `CREATE TABLE IF NOT EXISTS team_members (
             team_id INTEGER NOT NULL,
             user_id INTEGER NOT NULL,
             is_captain INTEGER DEFAULT 0,
             PRIMARY KEY (team_id, user_id),
             FOREIGN KEY(team_id) REFERENCES teams(id),
             FOREIGN KEY(user_id) REFERENCES users(id)
           )`
        );

        // --- rosters per match (optional, used by /teams/:id/roster) ---
        db.run(
          `CREATE TABLE IF NOT EXISTS team_match_rosters (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             team_id INTEGER NOT NULL,
             match_id INTEGER NOT NULL,
             created_by INTEGER,
             created_at TEXT DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY(team_id) REFERENCES teams(id),
             FOREIGN KEY(match_id) REFERENCES matches(id),
             FOREIGN KEY(created_by) REFERENCES users(id)
           )`
        );
        db.run(
          `CREATE TABLE IF NOT EXISTS team_roster_players (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             roster_id INTEGER NOT NULL,
             user_id INTEGER NOT NULL,
             role TEXT DEFAULT 'sub',         -- starter|sub|reserve
             shirt_number TEXT,
             FOREIGN KEY(roster_id) REFERENCES team_match_rosters(id),
             FOREIGN KEY(user_id) REFERENCES users(id)
           )`,
          () => resolve()
        );
      });
    });
  }

  return { requireAuth, requireAdmin, ensureTables };
}

module.exports = { createMiddleware };

const express = require("express");
const { createMiddleware } = require("./middleware");

module.exports = function leaguesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const { requireAuth, ensureTables } = createMiddleware(ctx);

  router.get("/leagues", (_req, res) => {
    const sql = `
      SELECT l.id,
             c.id  AS cityId,  c.name  AS city,
             s.id  AS sportId, s.name  AS sport,
             l.name
      FROM leagues l
      JOIN cities c ON l.city_id = c.id
      JOIN sports s ON l.sport_id = s.id
      ORDER BY c.name, l.name
    `;
    db.all(sql, [], (err, rows) => err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows));
  });

  router.get("/leagues/:id", (req, res) => {
    const id = Number(req.params.id);
    const sql = `
      SELECT l.id, l.name,
             c.id AS cityId, c.name AS city,
             s.id AS sportId, s.name AS sport
      FROM leagues l
      JOIN cities c ON l.city_id = c.id
      JOIN sports s ON l.sport_id = s.id
      WHERE l.id = ? LIMIT 1
    `;
    db.get(sql, [id], (err, row) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!row) return res.status(404).json({ error: "Liga nicht gefunden" });
      res.json(row);
    });
  });

  router.post("/leagues/:id/join", requireAuth, async (req, res) => {
    await ensureTables();
    const leagueId = Number(req.params.id);
    if (!Number.isFinite(leagueId)) return res.status(400).json({ error: "Ungültige Liga-ID" });
    db.run(
      "INSERT OR IGNORE INTO user_leagues (user_id, league_id) VALUES (?, ?)",
      [req.user.id, leagueId],
      function (err) {
        if (err) return res.status(400).json({ error: "Beitritt fehlgeschlagen", details: err.message });
        res.json({ ok: true, joined: this.changes > 0 });
      }
    );
  });

  router.get("/leagues/:id/members", async (req, res) => {
    await ensureTables();
    const leagueId = Number(req.params.id);
    const sql = `
      SELECT u.id, u.firstname, u.lastname, ul.joined_at
      FROM user_leagues ul
      JOIN users u ON u.id = ul.user_id
      WHERE ul.league_id = ?
      ORDER BY u.lastname, u.firstname
    `;
    db.all(sql, [leagueId], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler", details: err.message });
      res.json(rows || []);
    });
  });

  router.get("/leagues/:id/games", async (req, res) => {
    await ensureTables();
    const leagueId = Number(req.params.id);
    const sql = `
      SELECT id, league_id AS leagueId, kickoff_at, home, away, home_score, away_score
      FROM games WHERE league_id = ? ORDER BY kickoff_at ASC
    `;
    db.all(sql, [leagueId], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler", details: err.message });
      const now = Date.now();
      const all = (rows || []).map(r => ({ ...r, ts: Date.parse(r.kickoff_at) || 0 }));
      const upcoming = all.filter(r => r.ts > now || (r.home_score == null && r.away_score == null));
      const completed = all.filter(r => r.ts <= now || (r.home_score != null || r.away_score != null));
      res.json({ upcoming, completed });
    });
  });

  router.get("/leagues/:id/standings", async (req, res) => {
    await ensureTables();
    const leagueId = Number(req.params.id);
    const sql = `
      SELECT home, away, home_score, away_score
      FROM games
      WHERE league_id = ? AND home_score IS NOT NULL AND away_score IS NOT NULL
    `;
    db.all(sql, [leagueId], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler", details: err.message });
      const table = new Map();
      const ensure = (team) => {
        if (!table.has(team)) table.set(team, { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
        return table.get(team);
      };
      (rows || []).forEach(g => {
        const h = ensure(g.home), a = ensure(g.away);
        h.played++; a.played++;
        h.gf += g.home_score; h.ga += g.away_score;
        a.gf += g.away_score; a.ga += g.home_score;
        h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
        if (g.home_score > g.away_score) { h.wins++; h.pts += 3; a.losses++; }
        else if (g.home_score < g.away_score) { a.wins++; a.pts += 3; h.losses++; }
        else { h.draws++; a.draws++; h.pts++; a.pts++; }
      });
      const standings = Array.from(table.values()).sort((x, y) =>
        y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team)
      );
      res.json(standings);
    });
  });

  return router;
};

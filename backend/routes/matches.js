const express = require("express");
const { isAuthenticated } = require("../middleware/auth");

module.exports = function matchesRoutes({ db }) {
  const router = express.Router();

  // POST /matches - create open match in a league (home = creator: user or team)
  router.post("/", isAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const leagueId = req.body?.leagueId;
    if (!leagueId) return res.status(400).json({ error: "leagueId fehlt" });

    try {
      const member = await db("user_leagues").where({ league_id: leagueId, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: "Nur Mitglieder der Liga können Spiele erstellen" });

      const league = await db("leagues as l")
        .leftJoin("sports as s", "s.id", "l.sport_id")
        .select({ id: "l.id" }, { sportType: "s.type" })
        .where("l.id", leagueId)
        .first();
      if (!league) return res.status(404).json({ error: "Liga nicht gefunden" });

      const sportType = league.sportType || "Single";
      let home_user_id = null;
      let home_team_id = null;

      if (sportType === "Team") {
        const team = await db("teams as t")
          .leftJoin("team_members as tm", "tm.team_id", "t.id")
          .where("t.league_id", leagueId)
          .andWhere("tm.user_id", userId)
          .andWhere("tm.is_captain", 1)
          .select("t.id")
          .first();
        if (!team) return res.status(403).json({ error: "Nur Captains können Team-Spiele erstellen" });
        home_team_id = team.id;
      } else {
        home_user_id = userId;
      }

      const [id] = await db("matches").insert({
        league_id: leagueId,
        kickoff_at: null,
        home_user_id,
        home_team_id,
        away_user_id: null,
        away_team_id: null,
        home_score: null,
        away_score: null,
      });

      const match = await db("matches").where({ id }).first();
      res.status(201).json(match);
    } catch (e) {
      console.error("Create match error:", e);
      res.status(500).json({ error: "Datenbankfehler", details: e.message });
    }
  });

  // GET /matches/:id - details
  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
      if (typeof db !== "function") {
        return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
      }
      const match = await db("matches as m")
        .leftJoin("leagues as l", "l.id", "m.league_id")
        .leftJoin("sports as s", "s.id", "l.sport_id")
        .leftJoin({ uh: "users" }, "uh.id", "m.home_user_id")
        .leftJoin({ ua: "users" }, "ua.id", "m.away_user_id")
        .select(
          "m.id",
          "m.kickoff_at",
          "m.home_user_id",
          "m.away_user_id",
          "m.home",
          "m.away",
          "m.home_score",
          "m.away_score",
          { leagueId: "m.league_id" },
          { league: "l.name" },
          { sport: "s.name" },
          { home_user_name: "uh.name" },
          { away_user_name: "ua.name" }
        )
        .where("m.id", id)
        .first();
      if (!match) return res.status(404).json({ error: "Match nicht gefunden" });
      res.json(match);
    } catch (e) {
      console.error("Error fetching match:", e);
      res.status(500).json({ error: "Datenbankfehler", details: e.message });
    }
  });

  // POST /matches/:id/join - join open match
  router.post("/:id/join", isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;

    try {
      const g = await db("matches as m")
        .leftJoin("leagues as l", "l.id", "m.league_id")
        .leftJoin("sports as s", "s.id", "l.sport_id")
        .select([
          "m.id",
          "m.league_id",
          "m.home_user_id",
          "m.home_team_id",
          "m.away_user_id",
          "m.away_team_id",
          db.raw("COALESCE(s.type, 'Single') as sportType"),
        ])
        .where("m.id", gameId)
        .first();

      if (!g) return res.status(404).json({ error: "Match nicht gefunden" });

      const member = await db("user_leagues").where({ league_id: g.league_id, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: "Nur Mitglieder der Liga können Matches beitreten" });

      const hasAway = g.away_user_id != null || g.away_team_id != null;
      if (hasAway) return res.status(409).json({ error: "Match ist bereits voll" });

      if (g.sportType === "Team") {
        const team = await db("teams as t")
          .leftJoin("team_members as tm", "tm.team_id", "t.id")
          .where("t.league_id", g.league_id)
          .andWhere("tm.user_id", userId)
          .andWhere("tm.is_captain", 1)
          .select("t.id")
          .first();
        if (!team) return res.status(403).json({ error: "Nur Captains können Team-Matches beitreten" });
        if (String(team.id) === String(g.home_team_id)) return res.status(400).json({ error: "Gleiche Mannschaft nicht erlaubt" });

        await db("matches").where({ id: gameId }).update({ away_team_id: team.id });
      } else {
        if (String(userId) === String(g.home_user_id)) return res.status(400).json({ error: "Gleicher User nicht erlaubt" });
        await db("matches").where({ id: gameId }).update({ away_user_id: userId });
      }

      const updated = await db("matches").where({ id: gameId }).first();
      res.json(updated);
    } catch (e) {
      console.error("Join match error:", e);
      res.status(500).json({ error: "Datenbankfehler", details: e.message });
    }
  });

  return router;
};

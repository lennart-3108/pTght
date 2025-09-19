// ...existing code...

// Route: /users/:id/leagues
router.get("/:id/leagues", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const leagues = await db.raw(`
      SELECT l.id, l.name, l.city_id, l.sport_id, l.publicState
      FROM user_leagues ul
      JOIN leagues l ON ul.league_id = l.id
      WHERE ul.user_id = ?
    `, [id]);

    res.json(leagues);
  } catch (error) {
    console.error("Error fetching leagues:", error);
    res.status(500).json({ error: "Datenbankfehler", details: error.message });
  }
});

// Route: /users/:id/games
router.get("/:id/games", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db("matches as g")
      .join("user_leagues as ul", "g.league_id", "ul.league_id")
      .leftJoin({ uh: "users" }, "uh.id", "g.home_user_id")
      .leftJoin({ ua: "users" }, "ua.id", "g.away_user_id")
      .leftJoin({ th: "teams" }, "th.id", "g.home_team_id")
      .leftJoin({ ta: "teams" }, "ta.id", "g.away_team_id")
      .where("ul.user_id", id)
      .select([
        "g.id",
        "g.kickoff_at",
        "g.home_score",
        "g.away_score",
        db.raw("COALESCE(uh.name, th.name, '—') as home"),
        db.raw("COALESCE(ua.name, ta.name, '—') as away"),
      ]);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: "Datenbankfehler", details: error.message });
  }
});

// Helper: create a match if the user has no active match in the league (Singles only)
async function ensureMatchForUser(db, leagueId, userId) {
  return db.transaction(async (trx) => {
    const existing = await trx("matches")
      .select("id")
      .where({ league_id: leagueId })
      .andWhere(function () {
        this.where("home_user_id", userId).orWhere("away_user_id", userId);
      })
      .andWhereNull("home_score")
      .andWhereNull("away_score")
      .first();
    if (existing) return null;

    const candidates = await trx("user_leagues")
      .select({ id: "user_id" })
      .where({ league_id: leagueId })
      .whereNot({ user_id: userId });

    if (candidates.length === 0) return null;

    const unseen = [];
    const seen = [];
    for (const c of candidates) {
      const oppActive = await trx("matches")
        .select("id")
        .where({ league_id: leagueId })
        .andWhere(function () {
          this.where("home_user_id", c.id).orWhere("away_user_id", c.id);
        })
        .andWhereNull("home_score")
        .andWhereNull("away_score")
        .first();
      if (oppActive) continue;

      const prior = await trx("matches")
        .select("id")
        .where({ league_id: leagueId })
        .andWhere(function () {
          this.where(function () {
            this.where("home_user_id", userId).andWhere("away_user_id", c.id);
          }).orWhere(function () {
            this.where("home_user_id", c.id).andWhere("away_user_id", userId);
          });
        })
        .first();

      if (prior) seen.push(c.id);
      else unseen.push(c.id);
    }

    const preference = unseen.concat(seen);
    for (const oppId of preference) {
      if (oppId === userId) continue;

      const [meStillFree, oppStillFree] = await Promise.all([
        trx("matches")
          .select("id")
          .where({ league_id: leagueId })
          .andWhere(function () {
            this.where("home_user_id", userId).orWhere("away_user_id", userId);
          })
          .andWhereNull("home_score")
          .andWhereNull("away_score")
          .first(),
        trx("matches")
          .select("id")
          .where({ league_id: leagueId })
          .andWhere(function () {
            this.where("home_user_id", oppId).orWhere("away_user_id", oppId);
          })
          .andWhereNull("home_score")
          .andWhereNull("away_score")
          .first(),
      ]);
      if (meStillFree || oppStillFree) continue;

      const insertRes = await trx("matches").insert({
        league_id: leagueId,
        kickoff_at: null,
        home_user_id: userId,
        away_user_id: null,
        home_team_id: null,
        away_team_id: null,
        home_score: null,
        away_score: null,
      });

      const insertedId = Array.isArray(insertRes) ? insertRes[0] : insertRes;
      const match = await trx("matches").where({ id: insertedId }).first();
      return match || null;
    }

    return null;
  });
}

// Trigger matchmaking for a user in a league
router.post("/:id/ensure-match", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const leagueId = req.body?.leagueId || req.query?.leagueId;
  if (!leagueId) return res.status(400).json({ error: "leagueId fehlt" });

  try {
    const game = await ensureMatchForUser(db, leagueId, id);
    res.json({ created: !!game, game });
  } catch (error) {
    console.error("Error ensuring match:", error);
    res.status(500).json({ error: "Datenbankfehler", details: error.message });
  }
});

// ...existing code...

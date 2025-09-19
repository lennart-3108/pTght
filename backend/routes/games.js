// ...existing code...
router.get("/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const game = await db("games as g")
      .leftJoin("leagues as l", "l.id", "g.league_id")
      .leftJoin("sports as s", "s.id", "l.sport_id")
      .leftJoin({ uh: "users" }, function () {
        // Match when games.home is user id (as text) OR username OR name
        this.onRaw("(CAST(uh.id AS TEXT) = CAST(g.home AS TEXT) OR uh.username = g.home OR uh.name = g.home)");
      })
      .leftJoin({ ua: "users" }, function () {
        // Match when games.away is user id (as text) OR username OR name
        this.onRaw("(CAST(ua.id AS TEXT) = CAST(g.away AS TEXT) OR ua.username = g.away OR ua.name = g.away)");
      })
      .select([
        "g.id",
        "g.kickoff_at",
        "g.home",
        "g.away",
        "g.home_score",
        "g.away_score",
        { leagueId: "g.league_id" },
        { league: "l.name" },
        { home_user_id: "uh.id" },
        { away_user_id: "ua.id" },
        db.raw("COALESCE(uh.username, uh.name) as home_user_name"),
        db.raw("COALESCE(ua.username, ua.name) as away_user_name"),
        db.raw("COALESCE(s.type, 'Single') as sportType"),
      ])
      .where("g.id", id)
      .first();

    if (!game) return res.status(404).json({ error: "Spiel nicht gefunden" });
    res.json(game);
  } catch (e) {
    console.error("Error fetching game:", e);
    res.status(500).json({ error: "Datenbankfehler", details: e.message });
  }
});

// Join open game
router.post("/:id/join", isAuthenticated, async (req, res) => {
  const gameId = req.params.id;
  const userId = req.user.id;

  try {
    // Load game + league + sport type
    const game = await db("games as g")
      .leftJoin("leagues as l", "l.id", "g.league_id")
      .leftJoin("sports as s", "s.id", "l.sport_id")
      .select([
        "g.id",
        "g.league_id",
        "g.home",
        "g.away",
        db.raw("COALESCE(s.type, 'Single') as sportType"),
      ])
      .where("g.id", gameId)
      .first();

    if (!game) return res.status(404).json({ error: "Spiel nicht gefunden" });

    // Require membership in the game's league
    const member = await db("user_leagues").where({ league_id: game.league_id, user_id: userId }).first();
    if (!member) return res.status(403).json({ error: "Nur Mitglieder der Liga können Spielen beitreten" });

    if (game.away != null && game.away !== "") return res.status(409).json({ error: "Spiel ist bereits voll" });

    let awayValue;

    if (game.sportType === "Team") {
      // Only captain can join; must have a team in this league
      const team = await db("teams as t")
        .leftJoin("team_members as tm", "tm.team_id", "t.id")
        .where("t.league_id", game.league_id)
        .andWhere("tm.user_id", userId)
        .andWhere("tm.is_captain", 1)
        .select("t.id")
        .first();
      if (!team) return res.status(403).json({ error: "Nur Captains können Team-Spielen beitreten" });
      if (String(team.id) === String(game.home)) return res.status(400).json({ error: "Gleiche Mannschaft nicht erlaubt" });
      awayValue = String(team.id);
    } else {
      // Single
      if (String(userId) === String(game.home)) return res.status(400).json({ error: "Gleicher User nicht erlaubt" });
      awayValue = String(userId);
    }

    await db("games").where({ id: gameId }).update({ away: awayValue });

    const updated = await db("games").where({ id: gameId }).first();
    res.json(updated);
  } catch (e) {
    console.error("Join game error:", e);
    res.status(500).json({ error: "Datenbankfehler", details: e.message });
  }
});
// ...existing code...

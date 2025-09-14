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
router.get("/:id/games", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  console.log(`Fetching games for user ID: ${id}`); // Debugging-Log hinzufügen
  try {
    const games = await db.raw(`
      SELECT g.id, g.kickoff_at, g.home, g.away, g.home_score, g.away_score
      FROM games g
      JOIN user_leagues ul ON g.league_id = ul.league_id
      WHERE ul.user_id = ?
    `, [id]);

    console.log("Games fetched:", games); // Debugging-Log hinzufügen
    res.json(games);
  } catch (error) {
    console.error("Error fetching games:", error); // Fehlerprotokollierung
    res.status(500).json({ error: "Datenbankfehler", details: error.message });
  }
});

// ...existing code...


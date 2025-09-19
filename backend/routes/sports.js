const express = require("express");
const router = express.Router();
const db = require("../db");

// Route: /sports/:id/leagues
router.get("/:id/leagues", async (req, res) => {
  const { id } = req.params;
  console.log(`Fetching leagues for sport ID: ${id}`);
  try {
    // Use query builder to get proper rows and alias to camelCase
    const rows = await db("leagues as l")
      .leftJoin("cities as c", "c.id", "l.city_id")
      .where("l.sport_id", id)
      .select(
        "l.id",
        "l.name",
        db.raw("l.city_id AS cityId"),
        db.raw("l.sport_id AS sportId"),
        db.raw("COALESCE(c.name, '') AS city")
      );

    // Always 200; empty array if none
    res.json(rows);
  } catch (error) {
    console.error("Error fetching leagues for sport:", error);
    res.status(500).json({ error: "Datenbankfehler", details: error.message });
  }
});

module.exports = router;

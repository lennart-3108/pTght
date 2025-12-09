const express = require("express");
const router = express.Router();
const db = require("../db");

// Route: /sports/:id/leagues (with pagination)
router.get("/:id/leagues", async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const offset = parseInt(req.query.offset) || 0;
  
  console.log(`[/sports/${id}/leagues] limit=${limit} offset=${offset}`);
  
  try {
    // Get total count
    const [{ count: total }] = await db("leagues")
      .where("sport_id", id)
      .count("* as count");

    // Get leagues with pagination
    const rows = await db("leagues as l")
      .leftJoin("cities as c", "c.id", "l.city_id")
      .where("l.sport_id", id)
      .select(
        "l.id",
        "l.name",
        db.raw("l.city_id AS cityId"),
        db.raw("l.sport_id AS sportId"),
        db.raw("COALESCE(c.name, '') AS city")
      )
      .orderBy("l.name")
      .limit(limit)
      .offset(offset);

    console.log(`[/sports/${id}/leagues] Returning ${rows.length} of ${total} leagues`);

    res.json({
      data: rows,
      total,
      limit,
      offset,
      hasMore: offset + rows.length < total
    });
  } catch (error) {
    console.error("Error fetching leagues for sport:", error);
    res.status(500).json({ error: "Datenbankfehler", details: error.message });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const db = require("../db");

/**
 * GET /leagues
 * Fetch leagues with pagination and filtering
 * Query params:
 *  - limit: number of results (default: 50, max: 1000)
 *  - offset: pagination offset (default: 0)
 *  - sportId: filter by sport
 *  - cityId: filter by city
 *  - search: search in league name
 */
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const sportId = req.query.sportId;
    const cityId = req.query.cityId;
    const search = req.query.search;

    console.log(`[GET /leagues] limit=${limit} offset=${offset} sportId=${sportId} cityId=${cityId} search=${search}`);

    // Build query
    let query = db("leagues as l")
      .leftJoin("cities as c", "c.id", "l.city_id")
      .select(
        "l.id",
        "l.name",
        "l.city_id as cityId",
        "l.sport_id as sportId",
        "l.district_id as districtId",
        "l.level",
        "l.start_date as startDate",
        "l.end_date as endDate",
        db.raw("COALESCE(c.name, '') AS city")
      );

    // Apply filters
    if (sportId) {
      query = query.where("l.sport_id", sportId);
    }
    if (cityId) {
      query = query.where("l.city_id", cityId);
    }
    if (search) {
      query = query.where("l.name", "like", `%${search}%`);
    }

    // Get total count (for pagination)
    const countQuery = query.clone().clearSelect().count("* as count");
    const [{ count: total }] = await countQuery;

    // Apply pagination and ordering
    const leagues = await query
      .orderBy("l.name")
      .limit(limit)
      .offset(offset);

    console.log(`[GET /leagues] Returning ${leagues.length} of ${total} leagues`);

    res.json({
      data: leagues,
      total,
      limit,
      offset,
      hasMore: offset + leagues.length < total
    });
  } catch (error) {
    console.error("[GET /leagues] Error:", error);
    res.status(500).json({ error: "Datenbankfehler", details: error.message });
  }
});

module.exports = router;

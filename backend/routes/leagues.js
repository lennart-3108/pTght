const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const db = require("../db");

module.exports = router;

// Entferne die komplette POST /:id/games-Route (sie ist jetzt über matches/matches.js abgedeckt)

module.exports = router;

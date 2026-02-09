/**
 * DEPRECATED: Diese Route verwendet die obsolete 'games' Tabelle
 * Die games Tabelle wurde nach 'matches' migriert und gelöscht.
 * 
 * Verwende stattdessen: /api/matches/:id
 * 
 * Diese Route wird für Backward-Compatibility beibehalten,
 * leitet aber auf die matches-Route um.
 */
const express = require("express");

module.exports = function gamesRoutes(ctx) {
  const router = express.Router();

  router.get("/games/:id", (req, res) => {
    // Redirect to matches endpoint
    const id = req.params.id;
    res.redirect(301, `/api/matches/${id}`);
  });

  return router;
};

const express = require("express");
const sportsRoutes = require("./routes/sports");
const leaguesRouter = require("./routes/leagues");
const matchesRouter = require("./routes/matches");
// ...existing code...

const app = express();
app.use(express.json());

// Routen registrieren
app.use("/sports", sportsRoutes); // <-- Diese Zeile registriert die Routen aus sports.js
app.use("/leagues", leaguesRouter);
app.use("/matches", matchesRouter);

// ...existing code...

module.exports = app;

!const express = require("express");
const sportsRoutes = require("./routes/sports");
const leaguesRouter = require("./routes/leagues");
const matchesRouter = require("./routes/matches");
const resultsRouter = require("./routes/results");
const countriesRouter = require("./routes/countries");
const citiesRouter = require("./routes/cities");
// ...existing code...

const app = express();
app.use(express.json());

// Routen registrieren
app.use("/sports", sportsRoutes); // <-- Diese Zeile registriert die Routen aus sports.js
app.use("/leagues", leaguesRouter);
app.use("/matches", matchesRouter);
app.use("/results", resultsRouter);
app.use("/countries", countriesRouter);
app.use("/cities", citiesRouter);

// ...existing code...

module.exports = app;

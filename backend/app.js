const express = require("express");
const sportsRoutes = require("./routes/sports");
// ...existing code...

const app = express();
app.use(express.json());

// Routen registrieren
app.use("/sports", sportsRoutes); // <-- Diese Zeile registriert die Routen aus sports.js

// ...existing code...

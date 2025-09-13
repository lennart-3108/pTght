const express = require("express");
const { createMiddleware } = require("./middleware");

const authRoutes = require("./auth");
const meRoutes = require("./me");
const leaguesRoutes = require("./leagues");
const sportsRoutes = require("./sports");
const citiesRoutes = require("./cities");
const adminRoutes = require("./admin");
const mailerRoutes = require("./mailer");
const healthRoutes = require("./health");
const users = require("./users");
const games = require("./games");

function registerRoutes(app, ctx) {
  const { ensureTables } = createMiddleware(ctx);
  // einmalig nötige Tabellen anlegen
  ensureTables().catch(() => {});

  // Router anhängen
  app.use(authRoutes(ctx));
  app.use("/auth", authRoutes(ctx));
  app.use(meRoutes(ctx));
  app.use(leaguesRoutes(ctx));
  app.use(sportsRoutes(ctx));
  app.use(citiesRoutes(ctx));
  app.use("/admin", adminRoutes(ctx));
  app.use(mailerRoutes(ctx));
  app.use(healthRoutes(ctx));
  app.use(users(ctx));
  app.use(games(ctx));
}

module.exports = { registerRoutes };

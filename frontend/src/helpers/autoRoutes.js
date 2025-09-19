import React from "react";

// Beispiel: Wenn require.context genutzt wird, filtere Tests aus:
const ctx = require.context("../pages", true, /\.jsx?$/);
// Nur Nicht-Testdateien zulassen:
const files = ctx.keys().filter((k) => !/(__tests__|\.test\.jsx?$)/i.test(k));

// Alle .js-Dateien im pages-Ordner laden (keine Unterordner)
const pages = require.context("../pages", false, /\.js$/);

export const routes = files.map((path) => {
  // Dateiname: StartPage.js → start
  const name = path
    .replace("./", "")
    .replace(".js", "")
    .replace("Page", "")
    .toLowerCase();

  return {
    path: name === "start" ? "/start" : `/${name}`,
    element: React.createElement(ctx(path).default),
  };
});

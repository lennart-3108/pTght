import React from "react";

// Alle .js-Dateien im pages-Ordner laden (keine Unterordner)
const pages = require.context("../pages", false, /\.js$/);

export const routes = pages.keys().map((path) => {
  // Dateiname: StartPage.js → start
  const name = path
    .replace("./", "")
    .replace(".js", "")
    .replace("Page", "")
    .toLowerCase();

  return {
    path: name === "start" ? "/start" : `/${name}`,
    element: React.createElement(pages(path).default),
  };
});

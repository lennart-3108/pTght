const express = require("express");
const app = express();

const db = require("./db");
const leaguesRouter = require("./routes/leagues");

app.use("/leagues", leaguesRouter);

// Print all tables and columns on startup
async function printSchema() {
  try {
    const tables = await db("sqlite_master")
      .select("name")
      .where("type", "table")
      .andWhere("name", "not like", "sqlite_%")
      .orderBy("name");

    console.log(`[DB] Tables (${tables.length}):`);
    for (const { name } of tables) {
      const info = await db(name).columnInfo();
      console.log(`- ${name}`);
      for (const [col, meta] of Object.entries(info)) {
        const notNull = meta.nullable === false ? " NOT NULL" : "";
        const def = meta.defaultValue != null ? ` DEFAULT ${meta.defaultValue}` : "";
        console.log(`    • ${col} ${meta.type}${notNull}${def}`);
      }
    }
  } catch (e) {
    console.warn("[DB] Could not print schema:", e.message || e);
  }
}

// Run migrations then start server
db.migrate
  .latest()
  .then(async () => {
    await printSchema();
    const port = process.env.PORT || 3001;
    app.listen(port, () => console.log(`API listening on ${port}`));
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });

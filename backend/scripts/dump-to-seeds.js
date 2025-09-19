const fs = require("fs");
const path = require("path");

// bevorzugt Adapter nutzen; fallback auf ./db
function getKnex() {
  try {
    const { createDb } = require("../src/db/adapter");
    const db = createDb();
    return (db.knex && db.knex) || db;
  } catch {
    return require("../db"); // falls vorhanden
  }
}

(async () => {
  const knex = getKnex();
  const q = await knex
    .raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knex_%'")
    .then((r) => (Array.isArray(r) ? r : r?.[0] || r));
  const rows = q.rows || q || [];
  const tables = rows.map((r) => r.name || r.NAME);
  const outDir = path.join(__dirname, "..", "seeds", "data");
  fs.mkdirSync(outDir, { recursive: true });

  for (const t of tables) {
    const data = await knex(t);
    fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(data, null, 2));
    console.log(`[dump] ${t}: ${data.length}`);
  }

  await knex.destroy();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
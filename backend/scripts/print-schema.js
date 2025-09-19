const db = require("../db");

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
    console.error("[DB] Could not print schema:", e.message || e);
  } finally {
    process.exit(0);
  }
}

db.migrate.latest().then(printSchema).catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

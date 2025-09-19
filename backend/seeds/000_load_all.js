const fs = require("fs");
const path = require("path");

exports.seed = async function (knex) {
  const dir = path.join(__dirname, "data");
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  for (const file of files) {
    const table = path.basename(file, ".json");
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    if (!Array.isArray(data) || data.length === 0) continue;

    const hasId = data[0] && Object.prototype.hasOwnProperty.call(data[0], "id");
    // Upsert/Ignore nach ID falls vorhanden
    if (hasId && knex.client.config.client === "sqlite3") {
      await knex(table).insert(data).onConflict("id").ignore();
    } else {
      await knex(table).insert(data);
    }
    console.log(`[seeds] ${table}: ${data.length} rows`);
  }
};
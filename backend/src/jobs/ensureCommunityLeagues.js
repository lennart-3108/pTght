const getKnex = (db) => {
  if (!db) throw new Error("No db provided");
  if (typeof db === "function" && db.client) return db; // Knex ist callable
  if (db.client && typeof db.raw === "function") return db; // Instanz
  if (db.knex && db.knex.client) return db.knex; // Adapter mit .knex
  throw new Error("Unsupported db adapter");
};

async function ensureCommunityLeagues(db, onLog = console.log) {
  const k = getKnex(db);

  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const leaguesCols = await k("leagues").columnInfo().catch(() => ({}));
  const hasSeasonYear = !!leaguesCols.season_year;
  const startCol = leaguesCols.start_date ? "start_date" : (leaguesCols.season_start ? "season_start" : null);
  const endCol = leaguesCols.end_date ? "end_date" : (leaguesCols.season_end ? "season_end" : null);

  const cityCol = leaguesCols.city_id ? { name: "city_id", kind: "id" }
                : leaguesCols.city    ? { name: "city",    kind: "text" }
                : null;

  const sportCol = leaguesCols.sport_id ? { name: "sport_id", kind: "id" }
                 : leaguesCols.sport    ? { name: "sport",    kind: "text" }
                 : null;

  if (!cityCol || !sportCol) {
    onLog("[ensureCommunityLeagues] leagues benötigt city/city_id und sport/sport_id");
    return { created: 0 };
  }

  const cities = await k("cities").select("id", "name");
  const sports = await k("sports").select("id", "name");

  let created = 0;
  for (const city of cities) {
    for (const sport of sports) {
      const where = {};
      where[cityCol.name] = cityCol.kind === "id" ? city.id : city.name;
      where[sportCol.name] = sportCol.kind === "id" ? sport.id : sport.name;
      if (hasSeasonYear) where.season_year = year;

      const exists = await k("leagues").where(where).first();
      if (!exists) {
        const rec = {
          name: `Community ${sport.name} Liga – ${city.name}`,
          [cityCol.name]: where[cityCol.name],
          [sportCol.name]: where[sportCol.name],
        };
        if (hasSeasonYear) rec.season_year = year;
        if (startCol) rec[startCol] = start;
        if (endCol) rec[endCol] = end;

        try {
          await k("leagues").insert(rec);
          created++;
          onLog(`[ensureCommunityLeagues] Angelegt: ${rec.name} (${year})`);
        } catch (e) {
          onLog(`[ensureCommunityLeagues] Übersprungen: ${rec.name} (${e.code || e.message})`);
        }
      }
    }
  }

  onLog(`[ensureCommunityLeagues] Fertig. Neu erstellt: ${created}`);
  return { created };
}

module.exports = { ensureCommunityLeagues };

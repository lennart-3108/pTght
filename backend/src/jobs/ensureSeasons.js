function resolveKnex(db) {
  if (!db) throw new Error('No db');
  if (typeof db === 'function' && db.client) return db;
  if (db.client && typeof db.raw === 'function') return db;
  if (db.knex && db.knex.client) return db.knex;
  throw new Error('Unsupported db adapter');
}

function yearWindow(year) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { starts_at: start.toISOString().slice(0, 10), ends_at: end.toISOString().slice(0, 10) };
}

async function ensureSeasonForLeague(k, leagueId, year) {
  const hasSeasons = await k.schema.hasTable('seasons');
  if (!hasSeasons) return null;
  const { starts_at, ends_at } = yearWindow(year);
  let season = await k('seasons').where({ league_id: leagueId, name: String(year) }).first();
  if (!season) {
    // deactivate any active seasons that ended before now
    const today = new Date().toISOString().slice(0, 10);
    await k('seasons').where({ league_id: leagueId }).andWhere('ends_at', '<', today).update({ is_active: 0 }).catch(() => {});
    const [id] = await k('seasons').insert({ league_id: leagueId, name: String(year), starts_at, ends_at, is_active: 1 });
    season = await k('seasons').where({ id }).first();
  } else {
    // ensure it's active when today is within range
    const today = new Date().toISOString().slice(0, 10);
    if (season.starts_at <= today && season.ends_at >= today && !season.is_active) {
      await k('seasons').where({ id: season.id }).update({ is_active: 1 });
    }
  }
  return season;
}

async function ensureSeasons(db, log = () => {}) {
  const k = resolveKnex(db);
  const hasLeagues = await k.schema.hasTable('leagues');
  const hasSeasons = await k.schema.hasTable('seasons');
  if (!hasLeagues || !hasSeasons) return { ensured: 0 };
  const leagues = await k('leagues').select('id');
  const year = new Date().getFullYear();
  let ensured = 0;
  for (const l of leagues) {
    const s = await ensureSeasonForLeague(k, l.id, year);
    if (s) ensured++;
  }
  log(`[ensureSeasons] ensured seasons for ${ensured} leagues (year=${year})`);
  return { ensured };
}

module.exports = { ensureSeasons, ensureSeasonForLeague };

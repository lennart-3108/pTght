function ensureCommunityLeagues(db, cb = () => {}) {
  const run = (sql, params = []) =>
    new Promise((resolve, reject) => db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));
  const all = (sql, params = []) =>
    new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

  (async () => {
    try {
      // 1) Sicherstellen, dass Spalten existieren
      const cols = await all(`PRAGMA table_info(leagues)`);
      const names = new Set(cols.map(c => c.name));
      if (!names.has("publicState")) {
        await run(`ALTER TABLE leagues ADD COLUMN publicState TEXT NOT NULL DEFAULT 'public'`);
      }
      if (!names.has("owner")) {
        await run(`ALTER TABLE leagues ADD COLUMN owner TEXT NOT NULL DEFAULT 'MatchLeague'`);
      }

      // 2) Indizes für Stabilität und Eindeutigkeit
      await run(`CREATE INDEX IF NOT EXISTS idx_leagues_owner ON leagues(owner)`);
      await run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_community_unique
         ON leagues(city_id, sport_id, owner) WHERE owner='MatchLeague'`
      );

      // 3) Fehlende Community-Ligen je Stadt x Sport einfügen
      await run(
        `INSERT INTO leagues (name, city_id, sport_id, publicState, owner)
         SELECT c.name || ' ' || s.name || ' Open Community League', c.id, s.id, 'public', 'MatchLeague'
         FROM cities c
         CROSS JOIN sports s
         WHERE NOT EXISTS (
           SELECT 1 FROM leagues l
           WHERE l.city_id = c.id AND l.sport_id = s.id AND l.owner = 'MatchLeague'
         )`
      );

      cb();
    } catch (err) {
      console.error("ensureCommunityLeagues error:", err);
      cb(err);
    }
  })();
}

module.exports = { ensureCommunityLeagues };

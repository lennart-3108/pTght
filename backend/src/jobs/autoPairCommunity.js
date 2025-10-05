// Auto-pair community league members once per ISO week
// For each community league, if members have no match in the current week,
// pair them randomly by creating proposed matches.

function resolveKnex(db) {
  if (!db) throw new Error('No db');
  if (typeof db === 'function' && db.client) return db;
  if (db.client && typeof db.raw === 'function') return db;
  if (db.knex && db.knex.client) return db.knex;
  throw new Error('Unsupported db adapter');
}

function weekWindow(date = new Date()) {
  const now = new Date(date);
  const day = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString(), end: sunday.toISOString() };
}

async function userHasWeeklyMatch(k, leagueId, userId, info) {
  const { start, end } = weekWindow();
  const hasHomeUserId = !!info.home_user_id;
  const q = k('matches')
    .where({ league_id: leagueId })
    .where(function () {
      if (hasHomeUserId) this.where('home_user_id', userId).orWhere('away_user_id', userId);
      else this.where('home', String(userId)).orWhere('away', String(userId));
    })
    .where(function () {
      const ts = [];
      if (Object.prototype.hasOwnProperty.call(info, 'completed_at')) ts.push('completed_at');
      if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) ts.push('kickoff_at');
      if (Object.prototype.hasOwnProperty.call(info, 'created_at')) ts.push('created_at');
      if (ts.length === 0) this.whereNotNull('id');
      else this.where(function () { for (const c of ts) this.orWhereBetween(c, [start, end]); });
    })
    .count({ c: '*' });
  const row = await q;
  const cnt = Array.isArray(row) ? (row[0].c || 0) : (row.c || 0);
  return Number(cnt) >= 1;
}

async function autoPairCommunity(db, onLog = () => {}) {
  const k = resolveKnex(db);

  const leaguesCols = await k('leagues').columnInfo().catch(() => ({}));
  const hasPublicState = Object.prototype.hasOwnProperty.call(leaguesCols, 'publicState');

  // find community leagues (select publicState only if column exists)
  const baseSel = hasPublicState ? ['id', 'name', 'publicState'] : ['id', 'name'];
  const leagues = await k('leagues')
    .select(baseSel)
    .where(function () {
      if (hasPublicState) this.where('publicState', 'community');
      else this.whereNotNull('id');
    });

  const matchInfo = await k('matches').columnInfo().catch(() => ({}));
  const hasMatches = !!(await k.schema.hasTable('matches'));
  if (!hasMatches) return { created: 0 };

  let created = 0;
  for (const l of leagues) {
    // members of league
    const members = await k('user_leagues as ul')
      .join('users as u', 'u.id', 'ul.user_id')
      .where('ul.league_id', l.id)
      .select('u.id')
      .orderBy('u.id', 'asc');

    // filter those without weekly match
    const free = [];
    for (const m of members) {
      if (!(await userHasWeeklyMatch(k, l.id, m.id, matchInfo))) free.push(m.id);
    }

    // pair in random order
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }

    for (let i = 0; i + 1 < free.length; i += 2) {
      const a = free[i], b = free[i + 1];
      try {
        const rec = { league_id: l.id };
        if (Object.prototype.hasOwnProperty.call(matchInfo, 'home_user_id')) {
          rec.home_user_id = a; rec.away_user_id = b;
        } else {
          rec.home = String(a); rec.away = String(b);
        }
        if (Object.prototype.hasOwnProperty.call(matchInfo, 'status')) rec.status = 'proposed';
        if (Object.prototype.hasOwnProperty.call(matchInfo, 'created_at')) rec.created_at = new Date().toISOString();
        const ins = await k('matches').insert(rec);
        const id = Array.isArray(ins) ? ins[0] : ins;
        created++;
        onLog(`[autoPairCommunity] proposed match #${id} in league ${l.id} for users ${a} vs ${b}`);
      } catch (e) {
        onLog(`[autoPairCommunity] failed to propose match in league ${l.id}: ${e && (e.message || e)}`);
      }
    }
  }

  return { created };
}

module.exports = { autoPairCommunity };

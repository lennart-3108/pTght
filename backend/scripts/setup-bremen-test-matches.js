/*
 * Creates 3 test users and one open match per sport in Bremen.
 *
 * Requirements from Lennart:
 * - Always have a test match in Bremen for each sport
 * - Created by user "Auto Test Match User" with lastname "Eins"
 * - Manual join testing (so matches must stay open / not auto-filled)
 *
 * Usage:
 *   cd backend
 *   SQLITE_FILE=sportsplatform.db.before_cleanup_379k node scripts/setup-bremen-test-matches.js
 */

const bcrypt = require('bcrypt');
const db = require('../db');

function normalize(str) {
  return String(str || '').trim().toLowerCase();
}

function parseVv(str) {
  const m = String(str || '').match(/(\d+)\s*v\s*(\d+)/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  if (a !== b) return null;
  return a;
}

function computeDefaultFormat(sportRow) {
  const name = normalize(sportRow?.name);
  const variantType = normalize(sportRow?.variant_type);
  const sportType = normalize(sportRow?.sport_type || sportRow?.type);

  const vv = parseVv(variantType) || parseVv(name);
  const isDoubles =
    name.includes('doppel') ||
    name.includes('mixed') ||
    name.includes('padel') ||
    variantType.includes('doppel') ||
    variantType.includes('mixed');

  if (vv != null) {
    return { teamCount: 2, playersPerTeam: vv, maxPlayers: vv * 2 };
  }

  if (isDoubles) {
    return { teamCount: 2, playersPerTeam: 2, maxPlayers: 4 };
  }

  const isTeam = sportType.includes('team') || sportRow?.type === 'Team' || sportRow?.sport_type === 'Team';
  if (isTeam) {
    const ppt = Number(sportRow?.team_size || 0) || 5;
    return { teamCount: 2, playersPerTeam: ppt, maxPlayers: 2 * ppt };
  }

  return { teamCount: 2, playersPerTeam: 1, maxPlayers: 2 };
}

async function ensureUser({ firstname, lastname, username, email, password, cityId }) {
  const info = await db('users').columnInfo().catch(() => ({}));
  const existing = await db('users')
    .whereRaw('LOWER(email) = ?', [String(email).toLowerCase()])
    .first()
    .catch(() => null);
  if (existing) return existing;

  const rec = {};
  if (info.firstname) rec.firstname = firstname;
  if (info.lastname) rec.lastname = lastname;
  if (info.username) rec.username = username;
  if (info.email) rec.email = email;
  if (info.password) rec.password = bcrypt.hashSync(password, 10);
  if (info.is_confirmed) rec.is_confirmed = 1;
  if (info.is_admin) rec.is_admin = 0;
  if (info.role) rec.role = 'free';
  if (info.birthday) rec.birthday = '1990-01-01';
  if (info.birth_date) rec.birth_date = '1990-01-01';
  if (info.city_id) rec.city_id = cityId;
  if (info.accept_terms) rec.accept_terms = 1;
  if (info.accept_gdpr) rec.accept_gdpr = 1;

  const inserted = await db('users').insert(rec);
  const id = Array.isArray(inserted) ? inserted[0] : inserted;
  return db('users').where({ id }).first();
}

async function ensureOpenLeague({ sportId, cityId }) {
  const existing = await db('leagues')
    .where({ name: 'Open Matches', sport_id: sportId, city_id: cityId })
    .first()
    .catch(() => null);
  if (existing && existing.id) return Number(existing.id);
  try {
    const ins = await db('leagues').insert({ name: 'Open Matches', sport_id: sportId, city_id: cityId });
    return Number(Array.isArray(ins) ? ins[0] : ins);
  } catch {
    const retry = await db('leagues')
      .where({ name: 'Open Matches', sport_id: sportId, city_id: cityId })
      .first()
      .catch(() => null);
    return retry && retry.id ? Number(retry.id) : null;
  }
}

async function ensureParticipantsTable() {
  const has = await db.schema.hasTable('match_participants').catch(() => false);
  if (has) return true;
  return false;
}

async function countJoinedParticipants(matchId) {
  const has = await ensureParticipantsTable();
  if (!has) return null;
  const row = await db('match_participants')
    .where({ match_id: matchId })
    .andWhere(function () {
      this.whereNull('status').orWhere('status', 'joined');
    })
    .count({ c: '*' })
    .first();
  return Number(row?.c || 0);
}

async function ensureMatchForSport({ sportRow, cityId, creatorUserId }) {
  const sportId = Number(sportRow.id);
  const leagueId = await ensureOpenLeague({ sportId, cityId });
  if (!leagueId) throw new Error(`OPEN_LEAGUE_CREATE_FAILED sportId=${sportId}`);

  const matchInfo = await db('matches').columnInfo().catch(() => ({}));
  const hasFormatCols = matchInfo.max_players || matchInfo.team_count || matchInfo.players_per_team || matchInfo.allow_team_choice;
  const format = computeDefaultFormat(sportRow);

  const now = new Date();
  const kickoffAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1h ago (so can-submit can work)
  const kickoffEndAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

  // If there is already an open match in Bremen for this sport created by user Eins, keep it.
  const existing = await db('matches')
    .where({ league_id: leagueId })
    .andWhere(function () {
      if (matchInfo.home_user_id) this.where('home_user_id', creatorUserId);
      else this.whereRaw('1=1');
    })
    .andWhere(function () {
      if (matchInfo.home_score) this.whereNull('home_score');
      if (matchInfo.away_score) this.whereNull('away_score');
    })
    .andWhere(function () {
      if (matchInfo.status) this.whereIn('status', ['open', 'proposed']).orWhereNull('status');
      else this.whereRaw('1=1');
    })
    .orderBy('id', 'desc')
    .first()
    .catch(() => null);

  if (existing && existing.id) {
    // If it is full, create a new one.
    const joined = await countJoinedParticipants(existing.id);
    const maxPlayers = Number(existing.max_players || format.maxPlayers || 2);
    if (joined != null && maxPlayers && joined >= maxPlayers) {
      // continue to create
    } else {
      // Touch times so matches appear in open-matches lists even if older ones have dates.
      const patch = {};
      if (matchInfo.kickoff_at && !existing.kickoff_at) patch.kickoff_at = kickoffAt;
      if (matchInfo.kickoff_end_at && !existing.kickoff_end_at) patch.kickoff_end_at = kickoffEndAt;
      if (matchInfo.allow_team_choice) {
        const desired = format.maxPlayers > 2 ? 1 : 0;
        if (Number(existing.allow_team_choice) !== desired) patch.allow_team_choice = desired;
      }
      if (Object.keys(patch).length) {
        await db('matches').where({ id: existing.id }).update(patch).catch(() => {});
      }

      // Ensure creator is participant and Team 1
      const hasParticipants = await ensureParticipantsTable();
      if (hasParticipants) {
        const mp = await db('match_participants')
          .where({ match_id: existing.id, user_id: creatorUserId })
          .first()
          .catch(() => null);
        if (!mp) {
          await db('match_participants')
            .insert({
              match_id: existing.id,
              user_id: creatorUserId,
              team_index: 1,
              status: 'joined',
              joined_at: new Date().toISOString(),
            })
            .catch(() => {});
        } else if (mp.team_index == null) {
          await db('match_participants')
            .where({ match_id: existing.id, user_id: creatorUserId })
            .update({ team_index: 1 })
            .catch(() => {});
        }
      }

      return { action: 'kept', matchId: Number(existing.id), leagueId };
    }
  }

  const rec = {
    league_id: leagueId,
    home_user_id: creatorUserId,
    away_user_id: null,
    home_team_id: null,
    away_team_id: null,
    home_score: null,
    away_score: null,
  };

  if (hasFormatCols) {
    if (matchInfo.max_players) rec.max_players = format.maxPlayers;
    if (matchInfo.team_count) rec.team_count = format.teamCount;
    if (matchInfo.players_per_team) rec.players_per_team = format.playersPerTeam;
    if (matchInfo.allow_team_choice) rec.allow_team_choice = format.maxPlayers > 2 ? 1 : 0;
  }

  if (matchInfo.status) rec.status = 'open';
  if (matchInfo.kickoff_at) rec.kickoff_at = kickoffAt;
  if (matchInfo.kickoff_end_at) rec.kickoff_end_at = kickoffEndAt;
  if (matchInfo.created_at) rec.created_at = new Date().toISOString();

  const inserted = await db('matches').insert(rec);
  const matchId = Number(Array.isArray(inserted) ? inserted[0] : inserted);

  // Ensure creator is participant
  const hasParticipants = await ensureParticipantsTable();
  if (hasParticipants) {
    await db('match_participants')
      .insert({
        match_id: matchId,
        user_id: creatorUserId,
        team_index: 1,
        status: 'joined',
        joined_at: new Date().toISOString(),
      })
      .catch(() => {});
  }

  return { action: 'created', matchId, leagueId };
}

function toDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function ensureTimeFrames({ matchId, creatorUserId, days = 14 }) {
  const hasFrames = await db.schema.hasTable('match_time_frames').catch(() => false);
  if (!hasFrames) return { ok: false, reason: 'NO_MATCH_TIME_FRAMES_TABLE' };

  const existing = await db('match_time_frames')
    .where({ match_id: matchId })
    .select('date', 'time_start', 'time_end', 'created_by_user_id')
    .catch(() => []);

  const existingKeys = new Set(
    (existing || []).map((r) => `${r.date}|${String(r.time_start || '')}|${String(r.time_end || '')}|${String(r.created_by_user_id || '')}`)
  );

  const now = new Date();
  const createdAt = new Date().toISOString();
  let created = 0;
  for (let i = 0; i < Math.max(1, Number(days) || 14); i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const date = toDateStr(d);

    // Daily window; UI can propose 18:00 starts inside it
    const key = `${date}|18:00|22:00|${String(creatorUserId)}`;
    if (existingKeys.has(key)) continue;

    await db('match_time_frames')
      .insert({
        match_id: matchId,
        date,
        time_start: '18:00',
        time_end: '22:00',
        created_by_user_id: creatorUserId,
        created_at: createdAt,
      })
      .catch(() => {});
    created += 1;
  }

  return { ok: true, created };
}

async function main() {
  const password = 'test1234';
  const city = await db('cities').whereRaw('LOWER(name)=?', ['bremen']).first();
  if (!city || !city.id) throw new Error('CITY_BREMEN_NOT_FOUND');
  const cityId = Number(city.id);

  const users = [
    { idx: 1, lastname: 'Eins' },
    { idx: 2, lastname: 'Zwei' },
    { idx: 3, lastname: 'Drei' },
  ];

  const createdUsers = [];
  for (const u of users) {
    const user = await ensureUser({
      firstname: 'Auto Test Match User',
      lastname: u.lastname,
      username: `auto_test_user_${u.idx}`,
      email: `auto-test-user-${u.idx}@example.com`,
      password,
      cityId,
    });
    createdUsers.push(user);
  }

  const creator = createdUsers[0];
  if (!creator || !creator.id) throw new Error('CREATOR_USER_NOT_CREATED');

  const sports = await db('sports').select('id', 'name', 'variant_type', 'type', 'sport_type', 'team_size').orderBy('id', 'asc');

  const matchInfo = await db('matches').columnInfo().catch(() => ({}));
  const hasAllowTeamChoice = !!matchInfo.allow_team_choice;

  let kept = 0;
  let created = 0;
  let framesCreated = 0;
  for (const sportRow of sports) {
    const r = await ensureMatchForSport({ sportRow, cityId, creatorUserId: Number(creator.id) });
    if (r.action === 'kept') kept += 1;
    if (r.action === 'created') created += 1;

    // Important: seed frames for ALL open matches by the auto user in this league,
    // not only the newest one (so already-joined matches still have times).
    const openMatchIds = await db('matches')
      .where({ league_id: r.leagueId, home_user_id: Number(creator.id) })
      .whereNull('home_score')
      .whereNull('away_score')
      .select('id')
      .then((rows) => (rows || []).map((x) => Number(x.id)).filter(Boolean))
      .catch(() => []);

    // Enforce 1v1 semantics: no team choice when maxPlayers <= 2.
    if (hasAllowTeamChoice && openMatchIds.length) {
      const format = computeDefaultFormat(sportRow);
      const desired = format.maxPlayers > 2 ? 1 : 0;
      await db('matches')
        .whereIn('id', openMatchIds)
        .update({ allow_team_choice: desired })
        .catch(() => {});
    }

    for (const mid of openMatchIds) {
      const fr = await ensureTimeFrames({ matchId: mid, creatorUserId: Number(creator.id), days: 14 });
      if (fr.ok) framesCreated += Number(fr.created || 0);
    }

    process.stdout.write('.');
  }
  process.stdout.write('\n');

  console.log('[setup-bremen-test-matches] done', {
    cityId,
    city: city.name,
    sportsTotal: sports.length,
    matchesCreated: created,
    matchesKept: kept,
    framesCreated,
    users: createdUsers.map((u) => ({ id: u.id, firstname: u.firstname, lastname: u.lastname, email: u.email, username: u.username })),
    password,
  });
}

main()
  .catch((e) => {
    console.error('[setup-bremen-test-matches] failed:', e && (e.stack || e.message || e));
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await db.destroy(); } catch {}
  });

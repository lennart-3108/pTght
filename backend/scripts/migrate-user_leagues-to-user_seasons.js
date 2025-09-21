#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
// Minimal argv parsing to avoid extra dependencies
const rawArgs = process.argv.slice(2);
const argv = {
  'dry-run': true,
  'season-id': null,
  'remove-user-leagues': false,
};
for (const a of rawArgs) {
  if (a === '--dry-run') argv['dry-run'] = true;
  else if (a === '--no-dry-run' || a === '--run') argv['dry-run'] = false;
  else if (a.startsWith('--season-id=')) argv['season-id'] = Number(a.split('=')[1]);
  else if (a === '--remove-user-leagues') argv['remove-user-leagues'] = true;
  else if (a === '--help' || a === '-h') {
    console.log('Usage: migrate-user_leagues-to-user_seasons.js [--dry-run] [--no-dry-run] [--season-id=ID] [--remove-user-leagues]');
    process.exit(0);
  }
}

const DB = path.resolve(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(DB);

function run(sql, params=[]) {
  return new Promise((res, rej) => db.run(sql, params, function(err) { if (err) rej(err); else res(this); }));
}
function all(sql, params=[]) { return new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r))); }
function get(sql, params=[]) { return new Promise((res, rej) => db.get(sql, params, (e, r) => e ? rej(e) : res(r))); }

async function main() {
  console.log('Starting user_leagues → user_seasons migration (dry-run=%s)', argv['dry-run']);
  const leagues = await all(`SELECT id, name, sport_id FROM leagues ORDER BY id`);

  const report = [];

  for (const league of leagues) {
    // determine season to use
    let seasonId = argv['season-id'] || null;
    if (!seasonId) {
      const s = await get(`SELECT id FROM seasons WHERE league_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1`, [league.id]);
      if (s && s.id) seasonId = s.id;
      else {
        // fallback to most recent season for the league
        const s2 = await get(`SELECT id FROM seasons WHERE league_id = ? ORDER BY starts_at DESC LIMIT 1`, [league.id]);
        if (s2 && s2.id) seasonId = s2.id;
      }
    }

    if (!seasonId) {
      report.push({ league: league.id, leagueName: league.name, skipped: true, reason: 'no season found' });
      continue;
    }

  // find members in user_leagues (LEFT JOIN so rows are returned even if the users table has no matching row)
  const members = await all(`SELECT ul.user_id, u.firstname, u.lastname FROM user_leagues ul LEFT JOIN users u ON u.id = ul.user_id WHERE ul.league_id = ?`, [league.id]);
    if (!members.length) {
      report.push({ league: league.id, leagueName: league.name, skipped: true, reason: 'no user_leagues rows' });
      continue;
    }

    // Determine if sport is team sport
    const sport = await get(`SELECT team_size, sport_type FROM sports WHERE id = ?`, [league.sport_id]);
    const isTeam = sport && ((sport.sport_type && sport.sport_type === 'team') || (sport.team_size && sport.team_size > 1));

    const created = { user_seasons: 0, teams: 0, team_members: 0 };

    for (const m of members) {
      // skip if already in user_seasons
      const existing = await get(`SELECT id FROM user_seasons WHERE user_id = ? AND season_id = ?`, [m.user_id, seasonId]);
      if (existing) continue;

      if (!argv['dry-run']) {
        // create user_seasons row
        await run(`INSERT INTO user_seasons (user_id, season_id, joined_at) VALUES (?, ?, datetime('now'))`, [m.user_id, seasonId]);
        created.user_seasons++;
      } else {
        created.user_seasons++;
      }

      if (isTeam) {
        // create a one-person team (if not exists)
        const teamName = `${m.firstname || 'User'} ${m.lastname || ''}`.trim() || `user-${m.user_id}`;
        const existingTeam = await get(`SELECT id FROM teams WHERE league_id = ? AND season_id = ? AND name = ?`, [league.id, seasonId, teamName]);
        let teamId = existingTeam && existingTeam.id ? existingTeam.id : null;
        if (!teamId) {
          if (!argv['dry-run']) {
            const r = await run(`INSERT INTO teams (league_id, season_id, name, captain_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`, [league.id, seasonId, teamName, m.user_id]);
            teamId = r.lastID;
            created.teams++;
          } else {
            // Dry run: fake id
            created.teams++;
            teamId = -1; // placeholder
          }
        }

        // add team_member
        const existingMember = await get(`SELECT id FROM team_members WHERE team_id = ? AND user_id = ?`, [teamId, m.user_id]);
        if (!existingMember) {
          if (!argv['dry-run']) {
            await run(`INSERT INTO team_members (team_id, user_id, is_captain, created_at, updated_at) VALUES (?, ?, 1, datetime('now'), datetime('now'))`, [teamId, m.user_id]);
            created.team_members++;
          } else {
            created.team_members++;
          }
        }

        // update user_seasons.team_id if possible (skip in dry-run)
        if (!argv['dry-run'] && teamId && teamId !== -1) {
          await run(`UPDATE user_seasons SET team_id = ? WHERE user_id = ? AND season_id = ?`, [teamId, m.user_id, seasonId]);
        }
      }
    }

    // Optionally remove user_leagues rows
    if (argv['remove-user-leagues'] && !argv['dry-run']) {
      await run(`DELETE FROM user_leagues WHERE league_id = ?`, [league.id]);
    }

    report.push({ league: league.id, leagueName: league.name, seasonId, created });
  }

  // Output report
  console.log('Migration report:');
  for (const r of report) console.log(JSON.stringify(r, null, 2));
  console.log('Done. (dry-run=%s)', argv['dry-run']);
  db.close();
}

main().catch((e) => { console.error('Error:', e && (e.stack || e.message || e)); db.close(); process.exit(1); });

#!/usr/bin/env node
// Convert individual user_leagues members into teams/team_members for team-sport leagues.
// Safe & idempotent: will not duplicate existing team_members or teams, and can optionally remove user_leagues rows with --remove-user-leagues

const k = require('../db');

async function main() {
  console.log('[convert] Starting conversion: user_leagues -> teams/team_members');
  const removeUserLeagues = process.argv.includes('--remove-user-leagues');

  // Find leagues whose sport is team (sport_type='team' OR team_size > 1)
  const teamLeagues = await k('leagues as l')
    .join('sports as s', 'l.sport_id', 's.id')
    .select('l.id as league_id', 'l.name as league_name', 's.id as sport_id', 's.team_size', 's.sport_type')
    .where(function() {
      this.where('s.sport_type', 'team').orWhere('s.team_size', '>', 1);
    });

  if (!teamLeagues || teamLeagues.length === 0) {
    console.log('[convert] No team-sport leagues found, nothing to do.');
    process.exit(0);
  }

  const teamCols = await k('teams').columnInfo().catch(() => ({}));
  const hasCaptainCol = Object.prototype.hasOwnProperty.call(teamCols, 'captain_user_id') || Object.prototype.hasOwnProperty.call(teamCols, 'captain');

  const tmCols = await k('team_members').columnInfo().catch(() => ({}));
  const hasIsCaptain = Object.prototype.hasOwnProperty.call(tmCols, 'is_captain');

  let totalCreatedTeams = 0;
  let totalCreatedMembers = 0;
  let totalSkipped = 0;

  for (const lg of teamLeagues) {
    const leagueId = lg.league_id;
    console.log(`\n[convert] Processing league ${leagueId} (${lg.league_name})`);

    // load current teams in the league
    const existingTeams = await k('teams').where('league_id', leagueId).select('id');
    const existingTeamIds = existingTeams.map(t => t.id);

    // load user_leagues members for this league
    const members = await k('user_leagues').where('league_id', leagueId).select('*');
    if (!members || members.length === 0) {
      console.log('[convert] No individual members found for this league.');
      continue;
    }

    for (const m of members) {
      const userId = m.user_id;

      // check if user is already a team_member in this league
      const memberAssigned = await k('team_members as tm')
        .join('teams as t', 't.id', 'tm.team_id')
        .where('tm.user_id', userId)
        .andWhere('t.league_id', leagueId)
        .first()
        .catch(() => null);

      if (memberAssigned) {
        totalSkipped += 1;
        console.log(`[convert] User ${userId} already assigned to team ${memberAssigned.team_id}, skipping.`);
        continue;
      }

      // Create a team for the user (solo team) if the league has no teams or we create per-user
      // Team name: prefer users.name or firstname/lastname, else fallback to user-<id>
      const user = await k('users').where('id', userId).first().catch(() => null);
      let teamName = `Team ${userId}`;
      try {
        if (user) {
          const full = ((user.firstname || user.lastname) ? `${(user.firstname || '').trim()} ${(user.lastname || '').trim()}`.trim() : null) || user.name || user.username || user.email;
          if (full) teamName = `Team ${full}`;
        }
      } catch (e) { /* ignore, use fallback */ }

      // Ensure unique team name within league by appending numeric suffix if needed
      let finalName = teamName;
      let attempt = 1;
      while (true) {
        const exists = await k('teams').where({ league_id: leagueId, name: finalName }).first();
        if (!exists) break;
        attempt += 1;
        finalName = `${teamName} (${attempt})`;
      }

      const insert = { league_id: leagueId, name: finalName };
      if (hasCaptainCol) {
        insert.captain_user_id = userId;
      }

      const ids = await k('teams').insert(insert).catch((err) => {
        console.error('[convert] Error inserting team for user', userId, err && err.message);
        return null;
      });
      const teamId = Array.isArray(ids) ? ids[0] : ids;
      if (!teamId) {
        console.warn('[convert] Failed to create team for user', userId);
        continue;
      }
      totalCreatedTeams += 1;

      // create team_members entry
      const tmRec = { team_id: teamId, user_id: userId };
      if (hasIsCaptain) tmRec.is_captain = true;
      await k('team_members').insert(tmRec).catch((err) => {
        console.error('[convert] Error inserting team_member', err && err.message);
      });
      totalCreatedMembers += 1;

      // Optionally remove the user_leagues entry
      if (removeUserLeagues) {
        await k('user_leagues').where({ league_id: leagueId, user_id: userId }).del().catch(() => {});
      }

      console.log(`[convert] Created team ${teamId} for user ${userId} (league ${leagueId})`);
    }
  }

  console.log('\n[convert] Summary:');
  console.log(`[convert] Teams created: ${totalCreatedTeams}`);
  console.log(`[convert] Team members created: ${totalCreatedMembers}`);
  console.log(`[convert] Skipped (already assigned): ${totalSkipped}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('[convert] Fatal error:', err && (err.stack || err.message || err));
  process.exit(2);
});

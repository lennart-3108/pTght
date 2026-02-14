#!/usr/bin/env node
const db = require('../db');

async function safeHas(table) {
  return db.schema.hasTable(table).catch(() => false);
}

async function countQuery(builder) {
  const row = await builder.count({ c: '*' }).first().catch(() => ({ c: 0 }));
  return Number(row?.c || row?.['count(*)'] || 0);
}

async function run() {
  const checks = [];

  const hasTeams = await safeHas('teams');
  const hasLeagues = await safeHas('leagues');
  const hasUserLeagues = await safeHas('user_leagues');
  const hasUsers = await safeHas('users');
  const hasTeamMembers = await safeHas('team_members');
  const hasTournaments = await safeHas('tournaments');
  const hasTournamentParticipants = await safeHas('tournament_participants');

  if (hasTeams && hasLeagues) {
    const orphanTeams = await countQuery(
      db('teams as t')
        .leftJoin('leagues as l', 'l.id', 't.league_id')
        .whereNull('l.id')
    );
    checks.push({ key: 'orphan_teams_without_league', value: orphanTeams, ok: orphanTeams === 0 });
  }

  if (hasUserLeagues && hasUsers) {
    const orphanUserLeagueUsers = await countQuery(
      db('user_leagues as ul')
        .leftJoin('users as u', 'u.id', 'ul.user_id')
        .whereNull('u.id')
    );
    checks.push({ key: 'orphan_user_leagues_without_user', value: orphanUserLeagueUsers, ok: orphanUserLeagueUsers === 0 });
  }

  if (hasUserLeagues && hasLeagues) {
    const orphanUserLeagueLeagues = await countQuery(
      db('user_leagues as ul')
        .leftJoin('leagues as l', 'l.id', 'ul.league_id')
        .whereNull('l.id')
    );
    checks.push({ key: 'orphan_user_leagues_without_league', value: orphanUserLeagueLeagues, ok: orphanUserLeagueLeagues === 0 });
  }

  if (hasTeamMembers && hasTeams) {
    const orphanTeamMembersTeam = await countQuery(
      db('team_members as tm')
        .leftJoin('teams as t', 't.id', 'tm.team_id')
        .whereNull('t.id')
    );
    checks.push({ key: 'orphan_team_members_without_team', value: orphanTeamMembersTeam, ok: orphanTeamMembersTeam === 0 });
  }

  if (hasTeamMembers && hasUsers) {
    const orphanTeamMembersUser = await countQuery(
      db('team_members as tm')
        .leftJoin('users as u', 'u.id', 'tm.user_id')
        .whereNull('u.id')
    );
    checks.push({ key: 'orphan_team_members_without_user', value: orphanTeamMembersUser, ok: orphanTeamMembersUser === 0 });
  }

  if (hasTournaments && hasTournamentParticipants) {
    const orphanTournamentParticipantsTournament = await countQuery(
      db('tournament_participants as tp')
        .leftJoin('tournaments as t', 't.id', 'tp.tournament_id')
        .whereNull('t.id')
    );
    checks.push({ key: 'orphan_tournament_participants_without_tournament', value: orphanTournamentParticipantsTournament, ok: orphanTournamentParticipantsTournament === 0 });
  }

  if (hasTournamentParticipants && hasUsers) {
    const orphanTournamentParticipantsUser = await countQuery(
      db('tournament_participants as tp')
        .leftJoin('users as u', 'u.id', 'tp.user_id')
        .whereNotNull('tp.user_id')
        .whereNull('u.id')
    );
    checks.push({ key: 'orphan_tournament_participants_without_user', value: orphanTournamentParticipantsUser, ok: orphanTournamentParticipantsUser === 0 });
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), checks, failedCount: failed.length }, null, 2));
  process.exit(failed.length ? 2 : 0);
}

run().catch((err) => {
  console.error('Data quality audit failed to run:', err && (err.stack || err.message || err));
  process.exit(3);
});

const express = require('express');
const { isAuthenticated } = require('../middleware/auth');

module.exports = function matchesRoutes({ db }) {
  const router = express.Router();

  function getKnex() {
    const dbArg = db;
    if (!dbArg) return null;
    if (dbArg.knex && dbArg.knex.client) return dbArg.knex;
    if (dbArg.client) return dbArg;
    if (typeof dbArg === 'function' && typeof dbArg.raw === 'function') return dbArg;
    return null;
  }

  router.post('/', isAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const leagueId = req.body?.leagueId;
    if (!leagueId) return res.status(400).json({ error: 'leagueId fehlt' });
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const member = await k('user_leagues').where({ league_id: leagueId, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: 'Nur Mitglieder der Liga können Spiele erstellen' });
      const league = await k('leagues as l')
        .leftJoin('sports as s', 's.id', 'l.sport_id')
        .select({ id: 'l.id' }, { sportType: 's.type' })
        .where('l.id', leagueId)
        .first();
      if (!league) return res.status(404).json({ error: 'Liga nicht gefunden' });
      const sportType = league.sportType || 'Single';
      let home_user_id = null, home_team_id = null;
      if (sportType === 'Team') {
        const team = await k('teams as t')
          .leftJoin('team_members as tm', 'tm.team_id', 't.id')
          .where('t.league_id', leagueId)
          .andWhere('tm.user_id', userId)
          .andWhere('tm.is_captain', 1)
          .select('t.id')
          .first();
        if (!team) return res.status(403).json({ error: 'Nur Captains können Team-Spiele erstellen' });
        home_team_id = team.id;
      } else {
        home_user_id = userId;
      }
      const [id] = await k('matches').insert({ league_id: leagueId, kickoff_at: null, home_user_id, home_team_id, away_user_id: null, away_team_id: null, home_score: null, away_score: null });
      const match = await k('matches').where({ id }).first();
      res.status(201).json(match);
    } catch (e) {
      console.error('Create match error:', e);
      res.status(500).json({ error: 'Datenbankfehler', details: e && e.message });
    }
  });

  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      // inspect matches table to avoid selecting non-existent columns
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasHomeText = Object.prototype.hasOwnProperty.call(info, 'home');
      const hasAwayText = Object.prototype.hasOwnProperty.call(info, 'away');
      // build safe display-name expressions depending on users table columns
      const usersInfo = await k('users').columnInfo().catch(() => ({}));
      const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, 'firstname');
      const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, 'lastname');
      const hasName = Object.prototype.hasOwnProperty.call(usersInfo, 'name');
      const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, 'email');
      const fullNameExpr = (hasFirst || hasLast)
        ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
        : null;

      const makeDisplayForAlias = (alias) => {
        const parts = [];
        if (fullNameExpr) parts.push(fullNameExpr.replace(/u\./g, `${alias}.`));
        if (hasName) parts.push(`${alias}.name`);
        if (hasEmail) parts.push(`${alias}.email`);
        if (!parts.length) parts.push("'User'");
        return `COALESCE(${parts.join(', ')})`;
      };

      const homeDisplay = makeDisplayForAlias('uh');
      const awayDisplay = makeDisplayForAlias('ua');

      const match = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .leftJoin('sports as s', 's.id', 'l.sport_id')
        .leftJoin({ uh: 'users' }, 'uh.id', 'm.home_user_id')
        .leftJoin({ ua: 'users' }, 'ua.id', 'm.away_user_id')
        .select(
          'm.id',
          'm.kickoff_at',
          'm.home_user_id',
          'm.away_user_id',
          // include home/away text only if columns exist to avoid errors
          ...(hasHomeText ? ['m.home as home'] : [k.raw('NULL as home')]),
          ...(hasAwayText ? ['m.away as away'] : [k.raw('NULL as away')]),
          'm.home_score',
          'm.away_score',
          { leagueId: 'm.league_id' },
          { league: 'l.name' },
          { sport: 's.name' },
          k.raw(`${homeDisplay} as home_user_name`),
          k.raw(`${awayDisplay} as away_user_name`)
        )
        .where('m.id', id)
        .first();
      if (!match) return res.status(404).json({ error: 'Match nicht gefunden' });
      res.json(match);
    } catch (e) {
      console.error('Error fetching match:', e);
      res.status(500).json({ error: 'Datenbankfehler', details: e && e.message });
    }
  });

  router.post('/:id/join', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const g = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .leftJoin('sports as s', 's.id', 'l.sport_id')
        .select(['m.id', 'm.league_id', 'm.home_user_id', 'm.home_team_id', 'm.away_user_id', 'm.away_team_id', k.raw("COALESCE(s.type, 'Single') as sportType")])
        .where('m.id', gameId)
        .first();
      if (!g) return res.status(404).json({ error: 'Match nicht gefunden' });
      const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: 'Nur Mitglieder der Liga können Matches beitreten' });
      const hasAway = g.away_user_id != null || g.away_team_id != null;
      if (hasAway) return res.status(409).json({ error: 'Match ist bereits voll' });
      if (g.sportType === 'Team') {
        const team = await k('teams as t')
          .leftJoin('team_members as tm', 'tm.team_id', 't.id')
          .where('t.league_id', g.league_id)
          .andWhere('tm.user_id', userId)
          .andWhere('tm.is_captain', 1)
          .select('t.id')
          .first();
        if (!team) return res.status(403).json({ error: 'Nur Captains können Team-Matches beitreten' });
        if (String(team.id) === String(g.home_team_id)) return res.status(400).json({ error: 'Gleiche Mannschaft nicht erlaubt' });
        await k('matches').where({ id: gameId }).update({ away_team_id: team.id });
      } else {
        if (String(userId) === String(g.home_user_id)) return res.status(400).json({ error: 'Gleicher User nicht erlaubt' });
        await k('matches').where({ id: gameId }).update({ away_user_id: userId });
      }
      const updated = await k('matches').where({ id: gameId }).first();
      res.json(updated);
    } catch (e) {
      console.error('Join match error:', e);
      res.status(500).json({ error: 'Datenbankfehler', details: e && e.message });
    }
  });

  // Submit result for a pending match
  // Rules:
  // - Match must exist and be pending (no scores yet)
  // - For Single sport: only home_user_id or away_user_id can submit
  // - For Team sport: only captains of home_team_id or away_team_id can submit
  // - Requires league membership
  router.post('/:id/result', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    const { home_score, away_score } = req.body || {};
    const hs = Number(home_score);
    const as = Number(away_score);
    if (!Number.isFinite(hs) || !Number.isFinite(as) || hs < 0 || as < 0) {
      return res.status(400).json({ error: 'INVALID_SCORE' });
    }
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

      const g = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .leftJoin('sports as s', 's.id', 'l.sport_id')
        .select([
          'm.id', 'm.league_id',
          'm.home_user_id', 'm.away_user_id',
          'm.home_team_id', 'm.away_team_id',
          'm.home_score', 'm.away_score',
          k.raw("COALESCE(s.type, 'Single') as sportType")
        ])
        .where('m.id', gameId)
        .first();
      if (!g) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      // must be league member
      const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: 'LEAGUE_MEMBERS_ONLY' });

      // must be pending
      if (g.home_score != null || g.away_score != null) {
        return res.status(409).json({ error: 'ALREADY_RECORDED' });
      }

      // permission check
      if (g.sportType === 'Team') {
        // is user captain of either team?
        const teamIds = [g.home_team_id, g.away_team_id].filter(v => v != null);
        if (!teamIds.length) return res.status(400).json({ error: 'TEAMS_NOT_ASSIGNED' });
        const cap = await k('team_members')
          .whereIn('team_id', teamIds)
          .andWhere({ user_id: userId, is_captain: 1 })
          .first();
        if (!cap) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_SUBMIT' });
      } else {
        // single: must be one of the players
        const isPlayer = (String(userId) === String(g.home_user_id)) || (String(userId) === String(g.away_user_id));
        if (!isPlayer) return res.status(403).json({ error: 'ONLY_PLAYERS_CAN_SUBMIT' });
      }

      await k('matches').where({ id: gameId }).update({ home_score: hs, away_score: as });
      const updated = await k('matches').where({ id: gameId }).first();
      return res.json(updated);
    } catch (e) {
      console.error('Submit result error:', e);
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  return router;
};

const express = require('express');

module.exports = function matchesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // GET /matches/:id/rosters - list all team rosters for a match
  router.get('/:id/rosters', async (req, res) => {
    try {
      const k = require('../../db') || db;
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const rosters = await k('team_match_rosters').where({ match_id: matchId }).orderBy('team_id', 'asc').catch((e) => { throw e; });
      const out = [];
      for (const r of (rosters || [])) {
        const players = await k('team_roster_players as rp')
          .leftJoin('users as u', 'u.id', 'rp.user_id')
          .where('rp.roster_id', r.id)
          .select('rp.user_id', 'rp.role', 'rp.shirt_number', 'u.firstname', 'u.lastname', 'u.email')
          .orderBy('rp.role', 'desc');
        const mapped = (players || []).map(p => ({ user_id: p.user_id, role: p.role, shirt_number: p.shirt_number, display_name: (p.firstname || p.lastname) ? `${(p.firstname||'').trim()} ${(p.lastname||'').trim()}`.trim() : (p.email || `user:${p.user_id}`) }));
        out.push({ id: r.id, team_id: r.team_id, match_id: r.match_id, created_by: r.created_by, created_at: r.created_at, players: mapped });
      }
      res.json(out);
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('no such table') || msg.includes('no such column')) return res.json([]);
      console.error('Get match rosters failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};

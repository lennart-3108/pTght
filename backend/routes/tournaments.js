const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('../middleware/auth');
const { getTournamentCreationAllowance } = require('../services/license-guards');

/**
 * GET /api/tournaments
 * List all published tournaments with filters
 */
router.get('/', async (req, res) => {
  try {
    const { 
      sport_id, 
      city_id, 
      status,
      tournament_mode,
      limit = 50,
      offset = 0 
    } = req.query;

    let query = db('tournaments as t')
      .select(
        't.*',
        's.name as sport_name',
        'c.name as city_name',
        'u.username as organizer_name',
        db.raw('(SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id AND registration_status = "confirmed") as participant_count')
      )
      .leftJoin('sports as s', 't.sport_id', 's.id')
      .leftJoin('cities as c', 't.city_id', 'c.id')
      .leftJoin('users as u', 't.organizer_id', 'u.id')
      .where('t.published', true);

    if (sport_id) query = query.where('t.sport_id', sport_id);
    if (city_id) query = query.where('t.city_id', city_id);
    if (status) query = query.where('t.status', status);
    if (tournament_mode) query = query.where('t.tournament_mode', tournament_mode);

    query = query
      .orderBy('t.start_date', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const tournaments = await query;

    res.json({
      data: tournaments,
      count: tournaments.length
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

/**
 * GET /api/tournaments/:id
 * Get tournament details with participants and matches
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await db('tournaments as t')
      .select(
        't.*',
        's.name as sport_name',
        'c.name as city_name',
        'u.username as organizer_name',
        'u.email as organizer_email',
        'r.name as ruleset_name',
        'r.config as ruleset_config'
      )
      .leftJoin('sports as s', 't.sport_id', 's.id')
      .leftJoin('cities as c', 't.city_id', 'c.id')
      .leftJoin('users as u', 't.organizer_id', 'u.id')
      .leftJoin('rulesets as r', 't.ruleset_id', 'r.id')
      .where('t.id', id)
      .first();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get participants
    const participants = await db('tournament_participants as tp')
      .select(
        'tp.*',
        'u.username',
        'u.email',
        't.name as team_name'
      )
      .leftJoin('users as u', 'tp.user_id', 'u.id')
      .leftJoin('teams as t', 'tp.team_id', 't.id')
      .where('tp.tournament_id', id)
      .orderBy('tp.seed');

    // Get matches
    const matches = await db('tournament_matches as tm')
      .select(
        'tm.*',
        'hp.user_id as home_user_id',
        'ap.user_id as away_user_id',
        'hu.username as home_username',
        'au.username as away_username'
      )
      .leftJoin('tournament_participants as hp', 'tm.home_participant_id', 'hp.id')
      .leftJoin('tournament_participants as ap', 'tm.away_participant_id', 'ap.id')
      .leftJoin('users as hu', 'hp.user_id', 'hu.id')
      .leftJoin('users as au', 'ap.user_id', 'au.id')
      .where('tm.tournament_id', id)
      .orderBy(['tm.stage', 'tm.round', 'tm.bracket_position']);

    res.json({
      tournament,
      participants,
      matches
    });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).json({ error: 'Failed to fetch tournament details' });
  }
});

/**
 * POST /api/tournaments
 * Create a new tournament (requires authentication)
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      name,
      description,
      sport_id,
      city_id,
      district_id,
      venue_name,
      venue_address,
      tournament_mode = 'knockout',
      tournament_config = {},
      max_participants,
      min_participants = 2,
      registration_deadline,
      start_date,
      end_date,
      ruleset_id,
      published = false
    } = req.body;

    const organizer_id = req.user.id;

    const allowance = await getTournamentCreationAllowance(db, organizer_id);
    if (allowance.licensingEnabled && !allowance.hasOrganizerLicense) {
      return res.status(403).json({
        error: 'ORGANIZER_LICENSE_REQUIRED',
        message: 'Aktive Organizer-Lizenz erforderlich',
      });
    }

    if (Number.isFinite(allowance.allowedConcurrentEvents)) {
      const activeStatuses = ['draft', 'registration', 'active'];
      const activeRow = await db('tournaments')
        .where({ organizer_id })
        .whereIn('status', activeStatuses)
        .count({ c: '*' })
        .first()
        .catch(() => ({ c: 0 }));
      const activeCount = Number(activeRow?.c || activeRow?.['count(*)'] || 0);

      if (activeCount >= allowance.allowedConcurrentEvents) {
        return res.status(403).json({
          error: 'EVENT_LIMIT_REACHED',
          message: 'Maximale Anzahl paralleler Events erreicht',
          limits: {
            max_concurrent_events: allowance.allowedConcurrentEvents,
            current_active_events: activeCount,
          },
        });
      }
    }

    // Validation
    if (!name || !sport_id || !tournament_mode) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, sport_id, tournament_mode' 
      });
    }

    const validModes = ['round_robin', 'knockout', 'groups_knockout', 'swiss'];
    if (!validModes.includes(tournament_mode)) {
      return res.status(400).json({ 
        error: `Invalid tournament_mode. Must be one of: ${validModes.join(', ')}` 
      });
    }

    // Create tournament
    const [tournamentId] = await db('tournaments').insert({
      name,
      description,
      sport_id,
      city_id,
      district_id,
      venue_name,
      venue_address,
      organizer_id,
      tournament_mode,
      tournament_config: JSON.stringify(tournament_config),
      max_participants,
      min_participants,
      registration_deadline,
      start_date,
      end_date,
      ruleset_id,
      status: 'draft',
      published,
      created_at: new Date(),
      updated_at: new Date()
    });

    const createdTournament = await db('tournaments')
      .where({ id: tournamentId })
      .first();

    res.status(201).json({
      message: 'Tournament created successfully',
      tournament: createdTournament
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

/**
 * PATCH /api/tournaments/:id
 * Update tournament (only by organizer)
 */
router.patch('/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tournament = await db('tournaments')
      .where({ id })
      .first();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.organizer_id !== userId) {
      return res.status(403).json({ error: 'Only the organizer can update this tournament' });
    }

    const allowedFields = [
      'name', 'description', 'venue_name', 'venue_address',
      'tournament_config', 'max_participants', 'min_participants',
      'registration_deadline', 'start_date', 'end_date',
      'status', 'published', 'registration_open'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'tournament_config' 
          ? JSON.stringify(req.body[field])
          : req.body[field];
      }
    }

    updates.updated_at = new Date();

    await db('tournaments')
      .where({ id })
      .update(updates);

    const updatedTournament = await db('tournaments')
      .where({ id })
      .first();

    res.json({
      message: 'Tournament updated successfully',
      tournament: updatedTournament
    });
  } catch (error) {
    console.error('Error updating tournament:', error);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

/**
 * POST /api/tournaments/:id/register
 * Register for a tournament
 */
router.post('/:id/register', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { team_id } = req.body;

    const tournament = await db('tournaments')
      .where({ id })
      .first();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (!tournament.registration_open) {
      return res.status(400).json({ error: 'Registration is not open' });
    }

    if (tournament.status !== 'registration') {
      return res.status(400).json({ error: 'Tournament is not accepting registrations' });
    }

    // Check capacity
    const currentCount = await db('tournament_participants')
      .where({ 
        tournament_id: id,
        registration_status: 'confirmed'
      })
      .count('* as count')
      .first();

    if (tournament.max_participants && currentCount.count >= tournament.max_participants) {
      return res.status(400).json({ error: 'Tournament is full' });
    }

    // Check if already registered
    const existing = await db('tournament_participants')
      .where({ 
        tournament_id: id,
        user_id: userId
      })
      .first();

    if (existing) {
      return res.status(400).json({ error: 'Already registered for this tournament' });
    }

    // Register
    const [participantId] = await db('tournament_participants').insert({
      tournament_id: id,
      user_id: userId,
      team_id: team_id || null,
      registration_status: 'confirmed',
      registered_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });

    const participant = await db('tournament_participants')
      .where({ id: participantId })
      .first();

    res.status(201).json({
      message: 'Successfully registered for tournament',
      participant
    });
  } catch (error) {
    console.error('Error registering for tournament:', error);
    res.status(500).json({ error: 'Failed to register for tournament' });
  }
});

/**
 * POST /api/tournaments/:id/generate-bracket
 * Generate tournament bracket (only by organizer)
 */
router.post('/:id/generate-bracket', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tournament = await db('tournaments')
      .where({ id })
      .first();

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.organizer_id !== userId) {
      return res.status(403).json({ error: 'Only the organizer can generate the bracket' });
    }

    // Get confirmed participants
    const participants = await db('tournament_participants')
      .where({ 
        tournament_id: id,
        registration_status: 'confirmed'
      })
      .orderBy('seed')
      .orderBy('id');

    if (participants.length < tournament.min_participants) {
      return res.status(400).json({ 
        error: `Not enough participants. Minimum: ${tournament.min_participants}, Current: ${participants.length}` 
      });
    }

    // Generate bracket based on tournament mode
    let bracketData = null;
    let matches = [];

    switch (tournament.tournament_mode) {
      case 'knockout':
        ({ bracketData, matches } = generateKnockoutBracket(participants, tournament));
        break;
      case 'round_robin':
        ({ bracketData, matches } = generateRoundRobin(participants, tournament));
        break;
      case 'groups_knockout':
        ({ bracketData, matches } = generateGroupsKnockout(participants, tournament));
        break;
      default:
        return res.status(400).json({ error: 'Unsupported tournament mode' });
    }

    // Save bracket data
    await db('tournaments')
      .where({ id })
      .update({
        bracket_data: JSON.stringify(bracketData),
        current_stage: matches[0]?.stage || 'round_1',
        status: 'in_progress',
        updated_at: new Date()
      });

    // Insert matches
    for (const match of matches) {
      await db('tournament_matches').insert({
        ...match,
        tournament_id: id,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    res.json({
      message: 'Bracket generated successfully',
      bracket: bracketData,
      matches_created: matches.length
    });
  } catch (error) {
    console.error('Error generating bracket:', error);
    res.status(500).json({ error: 'Failed to generate bracket', details: error.message });
  }
});

/**
 * Helper: Generate knockout bracket
 */
function generateKnockoutBracket(participants, tournament) {
  const numParticipants = participants.length;
  
  // Find next power of 2
  const brackSize = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
  const numByes = brackSize - numParticipants;

  const stages = ['finals', 'semis', 'quarters', 'round_16', 'round_32', 'round_64'];
  const currentStageIndex = Math.ceil(Math.log2(brackSize)) - 1;
  const currentStage = stages[currentStageIndex] || `round_${brackSize}`;

  const bracketData = {
    type: 'knockout',
    size: brackSize,
    participants: numParticipants,
    byes: numByes,
    stages: []
  };

  const matches = [];
  let matchPosition = 0;

  // Seed participants
  const seededParticipants = [...participants];
  
  // Create first round matches
  for (let i = 0; i < brackSize / 2; i++) {
    const home = seededParticipants[i * 2];
    const away = seededParticipants[i * 2 + 1];

    matches.push({
      round: 1,
      stage: currentStage,
      match_label: `${currentStage.toUpperCase()} - Match ${i + 1}`,
      home_participant_id: home?.id || null,
      away_participant_id: away?.id || null,
      bracket_position: matchPosition++,
      status: (!home || !away) ? 'walkover' : 'scheduled',
      winner_participant_id: (!home || !away) ? (home?.id || away?.id || null) : null
    });
  }

  return { bracketData, matches };
}

/**
 * Helper: Generate round robin schedule
 */
function generateRoundRobin(participants, tournament) {
  const numParticipants = participants.length;
  const matches = [];
  
  let matchNumber = 0;
  for (let i = 0; i < numParticipants; i++) {
    for (let j = i + 1; j < numParticipants; j++) {
      matches.push({
        round: Math.floor(matchNumber / (numParticipants / 2)) + 1,
        stage: 'round_robin',
        match_label: `Match ${matchNumber + 1}`,
        home_participant_id: participants[i].id,
        away_participant_id: participants[j].id,
        bracket_position: matchNumber++,
        status: 'scheduled'
      });
    }
  }

  const bracketData = {
    type: 'round_robin',
    participants: numParticipants,
    total_matches: matches.length,
    rounds: Math.ceil(matches.length / (numParticipants / 2))
  };

  return { bracketData, matches };
}

/**
 * Helper: Generate groups + knockout
 */
function generateGroupsKnockout(participants, tournament) {
  const config = JSON.parse(tournament.tournament_config || '{}');
  const groupSize = config.group_size || 4;
  const numGroups = Math.ceil(participants.length / groupSize);
  
  const groups = Array.from({ length: numGroups }, () => []);
  
  // Distribute participants to groups
  participants.forEach((p, i) => {
    groups[i % numGroups].push(p);
  });

  const matches = [];
  let matchNumber = 0;

  // Generate group stage matches
  groups.forEach((group, groupIndex) => {
    const groupLetter = String.fromCharCode(65 + groupIndex); // A, B, C, etc.
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        matches.push({
          round: Math.floor(matchNumber / (group.length / 2)) + 1,
          stage: 'group_stage',
          match_label: `Gruppe ${groupLetter} - Match ${matchNumber + 1}`,
          home_participant_id: group[i].id,
          away_participant_id: group[j].id,
          bracket_position: matchNumber++,
          status: 'scheduled'
        });
      }
    }
  });

  const bracketData = {
    type: 'groups_knockout',
    num_groups: numGroups,
    group_size: groupSize,
    groups: groups.map((g, i) => ({
      name: String.fromCharCode(65 + i),
      participants: g.map(p => p.id)
    })),
    knockout_stage_pending: true
  };

  return { bracketData, matches };
}

module.exports = router;

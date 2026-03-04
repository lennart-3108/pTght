const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const rulesetValidator = require('../services/rulesetValidator');
const resultDecision = require('../services/resultDecision');
const standingsService = require('../services/standingsService');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

/**
 * POST /api/results/report/:matchId
 * Submit a match result for validation and confirmation
 * 
 * Request body:
 * {
 *   "result_data": { ... }, // Sport-specific result (e.g., {home_score: 3, away_score: 2})
 *   "reported_by": "home" | "away",
 *   "idempotency_key": "uuid" // Optional, for retry safety
 * }
 */
router.post('/report/:matchId', isAuthenticated, async (req, res) => {
  const matchId = parseInt(req.params.matchId);
  const { result_data, reported_by, idempotency_key } = req.body;

  const reportedByUserId = req.user.id;

  try {
    // Validate input
    if (!result_data || !reported_by) {
      return res.status(400).json({
        error: 'Missing required fields: result_data, reported_by'
      });
    }

    if (!['home', 'away'].includes(reported_by)) {
      return res.status(400).json({
        error: 'reported_by must be "home" or "away"'
      });
    }

    // Check for duplicate submission using idempotency key
    if (idempotency_key) {
      const existing = await db('results')
        .where({ 
          match_id: matchId,
          idempotency_key 
        })
        .first();

      if (existing) {
        return res.status(200).json({
          message: 'Result already submitted (idempotent)',
          result: existing
        });
      }
    }

    // Get match with ruleset
    const match = await db('matches')
      .select(
        'matches.*',
        'rulesets.id as ruleset_id',
        'rulesets.name as ruleset_name',
        'rulesets.config as ruleset_config',
        'rulesets.version as ruleset_version'
      )
      .leftJoin('rulesets', 'matches.ruleset_id', 'rulesets.id')
      .where('matches.id', matchId)
      .first();

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (!match.ruleset_id) {
      return res.status(400).json({ 
        error: 'Match has no ruleset assigned. Cannot validate result.' 
      });
    }

    // Prepare ruleset object
    const ruleset = {
      id: match.ruleset_id,
      name: match.ruleset_name,
      config: match.ruleset_config,
      version: match.ruleset_version
    };

    // Step 1: Validate result data against ruleset
    const validation = rulesetValidator.validate(ruleset, result_data);

    if (!validation.valid) {
      return res.status(422).json({
        error: 'Validation failed',
        validation_errors: rulesetValidator.formatErrors(validation.errors),
        details: validation.errors
      });
    }

    // Step 2: Calculate decision (winner, points)
    const decision = resultDecision.decide(ruleset, result_data);

    // Step 3: Create result record
    const resultId = await db('results').insert({
      match_id: matchId,
      ruleset_id: match.ruleset_id,
      result_data: JSON.stringify(result_data),
      reported_by,
      reported_by_user_id: reportedByUserId,
      status: 'pending', // pending -> accepted | disputed -> adjudicated
      winner: decision.winner,
      home_points: decision.homePoints,
      away_points: decision.awayPoints,
      metadata: JSON.stringify(decision.metadata),
      idempotency_key: idempotency_key || uuidv4(),
      validation_errors: null, // No errors if we got here
      created_at: new Date(),
      updated_at: new Date()
    }).returning('id');

    // Step 4: Create audit log
    await db('audit_logs').insert({
      result_id: resultId[0],
      action: 'result_reported',
      actor_user_id: reportedByUserId,
      actor_role: reported_by,
      changes: JSON.stringify({
        status: 'pending',
        result_data,
        decision
      }),
      timestamp: new Date()
    });

    // Get created result
    const createdResult = await db('results')
      .where({ id: resultId[0] })
      .first();

    res.status(201).json({
      message: 'Result submitted successfully',
      result: {
        ...createdResult,
        result_data: JSON.parse(createdResult.result_data),
        metadata: JSON.parse(createdResult.metadata)
      },
      decision,
      validation: {
        valid: true,
        errors: []
      },
      next_steps: {
        message: `Waiting for ${reported_by === 'home' ? 'away' : 'home'} team to confirm`,
        confirm_url: `/api/results/${resultId[0]}/confirm`,
        dispute_url: `/api/results/${resultId[0]}/dispute`
      }
    });

  } catch (error) {
    console.error('Error reporting result:', error);
    res.status(500).json({ 
      error: 'Failed to report result',
      details: error.message 
    });
  }
});

/**
 * POST /api/results/:id/confirm
 * Confirm a pending result (must be opposite team from reporter)
 */
router.post('/:id/confirm', isAuthenticated, async (req, res) => {
  const resultId = parseInt(req.params.id);
  const { confirmed_by } = req.body; // 'home' or 'away'
  
  const confirmedByUserId = req.user.id;

  try {
    const result = await db('results')
      .where({ id: resultId })
      .first();

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    if (result.status !== 'pending') {
      return res.status(400).json({ 
        error: `Cannot confirm result with status: ${result.status}` 
      });
    }

    // Validate confirming party is not the same as reporter
    if (confirmed_by === result.reported_by) {
      return res.status(400).json({
        error: 'Cannot confirm your own result. Must be confirmed by opponent.'
      });
    }

    // Update result to accepted
    await db('results')
      .where({ id: resultId })
      .update({
        status: 'accepted',
        confirmed_by,
        confirmed_by_user_id: confirmedByUserId,
        confirmed_at: new Date(),
        updated_at: new Date()
      });

    // Audit log
    await db('audit_logs').insert({
      result_id: resultId,
      action: 'result_confirmed',
      actor_user_id: confirmedByUserId,
      actor_role: confirmed_by,
      changes: JSON.stringify({
        status: 'pending -> accepted',
        confirmed_by
      }),
      timestamp: new Date()
    });

    // Update standings
    let standingsUpdated = false;
    try {
      await standingsService.updateStandingsForResult(resultId);
      standingsUpdated = true;
    } catch (err) {
      console.error('Failed to update standings:', err);
      // Don't fail the request, standings can be recalculated later
    }

    const updatedResult = await db('results').where({ id: resultId }).first();

    res.status(200).json({
      message: 'Result confirmed successfully',
      result: {
        ...updatedResult,
        result_data: JSON.parse(updatedResult.result_data),
        metadata: JSON.parse(updatedResult.metadata)
      },
      next_steps: {
        message: 'Result accepted. Standings updated.',
        standings_updated: standingsUpdated
      }
    });

  } catch (error) {
    console.error('Error confirming result:', error);
    res.status(500).json({ 
      error: 'Failed to confirm result',
      details: error.message 
    });
  }
});

/**
 * POST /api/results/:id/dispute
 * Dispute a pending result
 */
router.post('/:id/dispute', isAuthenticated, async (req, res) => {
  const resultId = parseInt(req.params.id);
  const { disputed_by, dispute_reason } = req.body;
  
  const disputedByUserId = req.user.id;

  try {
    const result = await db('results')
      .where({ id: resultId })
      .first();

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    if (result.status !== 'pending') {
      return res.status(400).json({ 
        error: `Cannot dispute result with status: ${result.status}` 
      });
    }

    if (!dispute_reason || dispute_reason.trim().length < 10) {
      return res.status(400).json({
        error: 'dispute_reason required (minimum 10 characters)'
      });
    }

    // Update to disputed
    await db('results')
      .where({ id: resultId })
      .update({
        status: 'disputed',
        disputed_by,
        disputed_by_user_id: disputedByUserId,
        dispute_reason,
        disputed_at: new Date(),
        updated_at: new Date()
      });

    // Audit log
    await db('audit_logs').insert({
      result_id: resultId,
      action: 'result_disputed',
      actor_user_id: disputedByUserId,
      actor_role: disputed_by,
      changes: JSON.stringify({
        status: 'pending -> disputed',
        reason: dispute_reason
      }),
      timestamp: new Date()
    });

    const updatedResult = await db('results').where({ id: resultId }).first();

    res.status(200).json({
      message: 'Result disputed successfully',
      result: {
        ...updatedResult,
        result_data: JSON.parse(updatedResult.result_data),
        metadata: JSON.parse(updatedResult.metadata)
      },
      next_steps: {
        message: 'Dispute submitted. Waiting for admin adjudication.',
        adjudicate_url: `/api/results/${resultId}/adjudicate`
      }
    });

  } catch (error) {
    console.error('Error disputing result:', error);
    res.status(500).json({ 
      error: 'Failed to dispute result',
      details: error.message 
    });
  }
});

/**
 * POST /api/results/:id/adjudicate
 * Admin-only: Resolve a disputed result
 */
router.post('/:id/adjudicate', isAdmin, async (req, res) => {
  const resultId = parseInt(req.params.id);
  const { admin_decision, admin_notes, corrected_result_data } = req.body;
  
  const adminUserId = req.user.id;

  try {
    const result = await db('results')
      .where({ id: resultId })
      .first();

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    if (result.status !== 'disputed') {
      return res.status(400).json({ 
        error: `Can only adjudicate disputed results. Current status: ${result.status}` 
      });
    }

    if (!['accept', 'reject', 'correct'].includes(admin_decision)) {
      return res.status(400).json({
        error: 'admin_decision must be "accept", "reject", or "correct"'
      });
    }

    let finalResultData = result.result_data;
    let finalDecision = {
      winner: result.winner,
      homePoints: result.home_points,
      awayPoints: result.away_points,
      metadata: result.metadata
    };

    // If admin corrects the result, re-validate and re-decide
    if (admin_decision === 'correct' && corrected_result_data) {
      // Get ruleset
      const match = await db('matches')
        .select('rulesets.*')
        .leftJoin('rulesets', 'matches.ruleset_id', 'rulesets.id')
        .where('matches.id', result.match_id)
        .first();

      const validation = rulesetValidator.validate(match, corrected_result_data);
      
      if (!validation.valid) {
        return res.status(422).json({
          error: 'Corrected result validation failed',
          validation_errors: rulesetValidator.formatErrors(validation.errors)
        });
      }

      finalDecision = resultDecision.decide(match, corrected_result_data);
      finalResultData = JSON.stringify(corrected_result_data);
    }

    // Update result
    await db('results')
      .where({ id: resultId })
      .update({
        status: 'adjudicated',
        admin_decision,
        admin_notes,
        adjudicated_by_user_id: adminUserId,
        adjudicated_at: new Date(),
        result_data: finalResultData,
        winner: finalDecision.winner,
        home_points: finalDecision.homePoints,
        away_points: finalDecision.awayPoints,
        metadata: JSON.stringify(finalDecision.metadata),
        updated_at: new Date()
      });

    // Audit log
    await db('audit_logs').insert({
      result_id: resultId,
      action: 'result_adjudicated',
      actor_user_id: adminUserId,
      actor_role: 'admin',
      changes: JSON.stringify({
        status: 'disputed -> adjudicated',
        admin_decision,
        admin_notes,
        corrected: admin_decision === 'correct'
      }),
      timestamp: new Date()
    });

    // Update standings if accepted or corrected
    let standingsUpdated = false;
    if (['accept', 'correct'].includes(admin_decision)) {
      try {
        await standingsService.updateStandingsForResult(resultId);
        standingsUpdated = true;
      } catch (err) {
        console.error('Failed to update standings:', err);
      }
    }

    const updatedResult = await db('results').where({ id: resultId }).first();

    res.status(200).json({
      message: 'Result adjudicated successfully',
      result: {
        ...updatedResult,
        result_data: JSON.parse(updatedResult.result_data),
        metadata: JSON.parse(updatedResult.metadata)
      },
      next_steps: {
        message: admin_decision === 'accept' || admin_decision === 'correct' 
          ? 'Result accepted. Standings updated.'
          : 'Result rejected. Match requires new result submission.',
        standings_updated: standingsUpdated
      }
    });

  } catch (error) {
    console.error('Error adjudicating result:', error);
    res.status(500).json({ 
      error: 'Failed to adjudicate result',
      details: error.message 
    });
  }
});

/**
 * GET /api/results/:id
 * Get result details with full history
 */
router.get('/:id', async (req, res) => {
  const resultId = parseInt(req.params.id);

  try {
    const result = await db('results')
      .select(
        'results.*',
        'matches.id as match_id',
        'matches.home_team_id',
        'matches.away_team_id',
        'rulesets.name as ruleset_name'
      )
      .leftJoin('matches', 'results.match_id', 'matches.id')
      .leftJoin('rulesets', 'results.ruleset_id', 'rulesets.id')
      .where('results.id', resultId)
      .first();

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Get audit trail
    const auditTrail = await db('audit_logs')
      .where({ result_id: resultId })
      .orderBy('timestamp', 'asc');

    res.json({
      result: {
        ...result,
        result_data: JSON.parse(result.result_data),
        metadata: JSON.parse(result.metadata)
      },
      audit_trail: auditTrail.map(log => ({
        ...log,
        changes: JSON.parse(log.changes)
      }))
    });

  } catch (error) {
    console.error('Error fetching result:', error);
    res.status(500).json({ 
      error: 'Failed to fetch result',
      details: error.message 
    });
  }
});

module.exports = router;

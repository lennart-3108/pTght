const express = require('express');

/**
 * Training Groups and Sessions Routes
 * Handles trainer features: groups, sessions, attendance
 */
module.exports = function trainingRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // ============================================================================
  // TRAINING GROUPS
  // ============================================================================

  /**
   * GET /api/training/groups
   * Get all training groups (with optional filters)
   */
  router.get('/groups', async (req, res) => {
    try {
      const { trainer_id, club_id, sport_id, status, search } = req.query;
      
      let query = db('training_groups')
        .leftJoin('users', 'training_groups.trainer_id', 'users.id')
        .leftJoin('sports', 'training_groups.sport_id', 'sports.id')
        .leftJoin('clubs', 'training_groups.club_id', 'clubs.id')
        .select(
          'training_groups.*',
          'users.firstname as trainer_firstname',
          'users.lastname as trainer_lastname',
          'sports.name as sport_name',
          'clubs.name as club_name'
        );
      
      if (trainer_id) query = query.where('training_groups.trainer_id', trainer_id);
      if (club_id) query = query.where('training_groups.club_id', club_id);
      if (sport_id) query = query.where('training_groups.sport_id', sport_id);
      if (status) query = query.where('training_groups.status', status);
      if (search) {
        query = query.where('training_groups.name', 'like', `%${search}%`);
      }
      
      const groups = await query.orderBy('training_groups.name');
      
      // Get participant counts
      for (let group of groups) {
        const count = await db('training_group_members')
          .where({ training_group_id: group.id, status: 'active' })
          .count('* as count')
          .first();
        group.participant_count = count?.count || 0;
      }
      
      res.json(groups);
    } catch (error) {
      console.error('Error fetching training groups:', error);
      res.status(500).json({ error: 'Failed to fetch training groups' });
    }
  });

  /**
   * GET /api/training-groups/:groupId
   * Get specific training group details
   */
  router.get('/groups/:groupId', async (req, res) => {
    try {
      const { groupId } = req.params;
      
      const group = await db('training_groups')
        .leftJoin('users', 'training_groups.trainer_id', 'users.id')
        .leftJoin('sports', 'training_groups.sport_id', 'sports.id')
        .leftJoin('clubs', 'training_groups.club_id', 'clubs.id')
        .leftJoin('locations', 'training_groups.location_id', 'locations.id')
        .where('training_groups.id', groupId)
        .select(
          'training_groups.*',
          'users.firstname as trainer_firstname',
          'users.lastname as trainer_lastname',
          'sports.name as sport_name',
          'clubs.name as club_name',
          'locations.name as location_name'
        )
        .first();
      
      if (!group) {
        return res.status(404).json({ error: 'Training group not found' });
      }

      // Get participants
      const participants = await db('training_group_members')
        .join('users', 'training_group_members.user_id', 'users.id')
        .where('training_group_members.training_group_id', groupId)
        .select(
          'training_group_members.*',
          'users.firstname',
          'users.lastname',
          'users.email'
        )
        .orderBy('training_group_members.joined_at');
      
      group.participants = participants;
      group.participant_count = participants.filter(p => p.status === 'active').length;
      
      res.json(group);
    } catch (error) {
      console.error('Error fetching training group:', error);
      res.status(500).json({ error: 'Failed to fetch training group' });
    }
  });

  /**
   * POST /api/training-groups
   * Create a new training group
   */
  router.post('/groups', async (req, res) => {
    try {
      const {
        name, description, trainer_id, club_id, sport_id,
        level, min_age, max_age, max_participants,
        schedule_description, location_id, settings
      } = req.body;
      
      if (!name || !trainer_id) {
        return res.status(400).json({ error: 'name and trainer_id are required' });
      }

      // Check if user has trainer role and license
      const hasRole = await db('user_roles')
        .join('roles', 'user_roles.role_id', 'roles.id')
        .where('user_roles.user_id', trainer_id)
        .where('roles.name', 'trainer')
        .where('user_roles.is_active', true)
        .first();
      
      if (!hasRole) {
        return res.status(403).json({ error: 'User does not have trainer role' });
      }

      const [groupId] = await db('training_groups').insert({
        name,
        description,
        trainer_id,
        club_id,
        sport_id,
        level,
        min_age,
        max_age,
        max_participants: max_participants || 20,
        schedule_description,
        location_id,
        settings: settings ? JSON.stringify(settings) : null,
        status: 'active'
      });

      res.status(201).json({
        message: 'Training group created successfully',
        group_id: groupId
      });
    } catch (error) {
      console.error('Error creating training group:', error);
      res.status(500).json({ error: 'Failed to create training group' });
    }
  });

  /**
   * PATCH /api/training-groups/:groupId
   * Update training group
   */
  router.patch('/groups/:groupId', async (req, res) => {
    try {
      const { groupId } = req.params;
      const updates = { ...req.body };
      delete updates.id;
      delete updates.created_at;
      
      if (updates.settings) {
        updates.settings = JSON.stringify(updates.settings);
      }
      
      updates.updated_at = db.fn.now();
      
      const updated = await db('training_groups')
        .where('id', groupId)
        .update(updates);
      
      if (updated === 0) {
        return res.status(404).json({ error: 'Training group not found' });
      }

      res.json({ message: 'Training group updated successfully' });
    } catch (error) {
      console.error('Error updating training group:', error);
      res.status(500).json({ error: 'Failed to update training group' });
    }
  });

  /**
   * POST /api/training-groups/:groupId/members
   * Add participant to training group
   */
  router.post('/groups/:groupId/members', async (req, res) => {
    try {
      const { groupId } = req.params;
      const { user_id, notes } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      // Check group capacity
      const group = await db('training_groups').where('id', groupId).first();
      if (!group) {
        return res.status(404).json({ error: 'Training group not found' });
      }

      const currentCount = await db('training_group_members')
        .where({ training_group_id: groupId, status: 'active' })
        .count('* as count')
        .first();
      
      if (currentCount.count >= group.max_participants) {
        // Add to waiting list
        await db('training_group_members').insert({
          training_group_id: groupId,
          user_id,
          status: 'waiting_list',
          notes: notes ? JSON.stringify({ text: notes }) : null
        });
        return res.status(201).json({ message: 'Added to waiting list', status: 'waiting_list' });
      }

      // Check if already member
      const existing = await db('training_group_members')
        .where({ training_group_id: groupId, user_id })
        .first();
      
      if (existing) {
        if (existing.status === 'active') {
          return res.status(400).json({ error: 'User is already a participant' });
        }
        // Reactivate
        await db('training_group_members')
          .where('id', existing.id)
          .update({ status: 'active', updated_at: db.fn.now() });
        return res.json({ message: 'Participant reactivated' });
      }

      await db('training_group_members').insert({
        training_group_id: groupId,
        user_id,
        status: 'active',
        notes: notes ? JSON.stringify({ text: notes }) : null
      });

      res.status(201).json({ message: 'Participant added successfully' });
    } catch (error) {
      console.error('Error adding participant:', error);
      res.status(500).json({ error: 'Failed to add participant' });
    }
  });

  // ============================================================================
  // TRAINING SESSIONS
  // ============================================================================

  /**
   * GET /api/training-groups/:groupId/sessions
   * Get all sessions for a training group
   */
  router.get('/groups/:groupId/sessions', async (req, res) => {
    try {
      const { groupId } = req.params;
      const { status, from_date, to_date } = req.query;
      
      let query = db('training_sessions')
        .leftJoin('users', 'training_sessions.trainer_id', 'users.id')
        .leftJoin('locations', 'training_sessions.location_id', 'locations.id')
        .where('training_sessions.training_group_id', groupId)
        .select(
          'training_sessions.*',
          'users.firstname as trainer_firstname',
          'users.lastname as trainer_lastname',
          'locations.name as location_name'
        );
      
      if (status) query = query.where('training_sessions.status', status);
      if (from_date) query = query.where('training_sessions.scheduled_at', '>=', from_date);
      if (to_date) query = query.where('training_sessions.scheduled_at', '<=', to_date);
      
      const sessions = await query.orderBy('training_sessions.scheduled_at', 'desc');
      
      // Get attendance counts
      for (let session of sessions) {
        const attendance = await db('training_attendance')
          .where('training_session_id', session.id)
          .select(
            db.raw('COUNT(*) as total'),
            db.raw('SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) as present'),
            db.raw('SUM(CASE WHEN status = "absent" THEN 1 ELSE 0 END) as absent')
          )
          .first();
        
        session.attendance = attendance;
      }
      
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching training sessions:', error);
      res.status(500).json({ error: 'Failed to fetch training sessions' });
    }
  });

  /**
   * POST /api/training-groups/:groupId/sessions
   * Create a new training session
   */
  router.post('/groups/:groupId/sessions', async (req, res) => {
    try {
      const { groupId } = req.params;
      const {
        trainer_id, scheduled_at, duration_minutes = 90,
        location_id, description
      } = req.body;
      
      if (!trainer_id || !scheduled_at) {
        return res.status(400).json({ error: 'trainer_id and scheduled_at are required' });
      }

      const [sessionId] = await db('training_sessions').insert({
        training_group_id: groupId,
        trainer_id,
        scheduled_at,
        duration_minutes,
        location_id,
        description,
        status: 'scheduled'
      });

      res.status(201).json({
        message: 'Training session created successfully',
        session_id: sessionId
      });
    } catch (error) {
      console.error('Error creating training session:', error);
      res.status(500).json({ error: 'Failed to create training session' });
    }
  });

  /**
   * POST /api/training-sessions/:sessionId/attendance
   * Record attendance for a session
   */
  router.post('/sessions/:sessionId/attendance', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { user_id, status = 'present', notes } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      // Check if already recorded
      const existing = await db('training_attendance')
        .where({ training_session_id: sessionId, user_id })
        .first();
      
      if (existing) {
        // Update existing record
        await db('training_attendance')
          .where('id', existing.id)
          .update({
            status,
            notes,
            checked_in_at: status === 'present' ? db.fn.now() : existing.checked_in_at,
            updated_at: db.fn.now()
          });
        return res.json({ message: 'Attendance updated' });
      }

      await db('training_attendance').insert({
        training_session_id: sessionId,
        user_id,
        status,
        notes,
        checked_in_at: status === 'present' ? db.fn.now() : null
      });

      res.status(201).json({ message: 'Attendance recorded successfully' });
    } catch (error) {
      console.error('Error recording attendance:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  });

  return router;
};

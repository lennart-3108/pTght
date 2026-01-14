const express = require('express');

/**
 * Clubs Management Routes
 * Handles club creation, member management, and club-related operations
 */
module.exports = function clubsRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  /**
   * GET /api/clubs
   * Get all clubs (with optional filters)
   */
  router.get('/', async (req, res) => {
    try {
      const { city_id, status, search } = req.query;
      
      let query = db('clubs')
        .leftJoin('users', 'clubs.admin_user_id', 'users.id')
        .select(
          'clubs.*',
          'users.firstname as admin_firstname',
          'users.lastname as admin_lastname'
        );
      
      if (city_id) query = query.where('clubs.city_id', city_id);
      if (status) query = query.where('clubs.status', status);
      if (search) {
        query = query.where(function() {
          this.where('clubs.name', 'like', `%${search}%`)
            .orWhere('clubs.short_name', 'like', `%${search}%`);
        });
      }
      
      const clubs = await query.orderBy('clubs.name');
      
      // Get member counts
      for (let club of clubs) {
        const count = await db('club_members')
          .where({ club_id: club.id, status: 'active' })
          .count('* as count')
          .first();
        club.member_count = count?.count || 0;
      }
      
      res.json(clubs);
    } catch (error) {
      console.error('Error fetching clubs:', error);
      res.status(500).json({ error: 'Failed to fetch clubs' });
    }
  });

  /**
   * GET /api/clubs/:clubId
   * Get specific club details
   */
  router.get('/:clubId', async (req, res) => {
    try {
      const { clubId } = req.params;
      
      const club = await db('clubs')
        .leftJoin('users', 'clubs.admin_user_id', 'users.id')
        .where('clubs.id', clubId)
        .select(
          'clubs.*',
          'users.firstname as admin_firstname',
          'users.lastname as admin_lastname',
          'users.email as admin_email'
        )
        .first();
      
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }

      // Get members
      const members = await db('club_members')
        .join('users', 'club_members.user_id', 'users.id')
        .where('club_members.club_id', clubId)
        .select(
          'club_members.*',
          'users.firstname',
          'users.lastname',
          'users.email'
        )
        .orderBy('club_members.joined_at');
      
      club.members = members;
      club.member_count = members.filter(m => m.status === 'active').length;
      
      res.json(club);
    } catch (error) {
      console.error('Error fetching club:', error);
      res.status(500).json({ error: 'Failed to fetch club' });
    }
  });

  /**
   * POST /api/clubs
   * Create a new club
   */
  router.post('/', async (req, res) => {
    try {
      const {
        name, short_name, description, admin_user_id,
        logo_url, website, email, phone,
        street, city, state, country, postal_code,
        city_id, district_id, settings
      } = req.body;
      
      if (!name || !admin_user_id) {
        return res.status(400).json({ error: 'name and admin_user_id are required' });
      }

      // Check if user has club_admin role and license
      const hasRole = await db('user_roles')
        .join('roles', 'user_roles.role_id', 'roles.id')
        .where('user_roles.user_id', admin_user_id)
        .where('roles.name', 'club_admin')
        .where('user_roles.is_active', true)
        .first();
      
      if (!hasRole) {
        return res.status(403).json({ error: 'User does not have club_admin role' });
      }

      const [clubId] = await db('clubs').insert({
        name,
        short_name,
        description,
        admin_user_id,
        logo_url,
        website,
        email,
        phone,
        street,
        city,
        state,
        country,
        postal_code,
        city_id,
        district_id,
        settings: settings ? JSON.stringify(settings) : null,
        status: 'active'
      });

      // Add admin as member
      await db('club_members').insert({
        club_id: clubId,
        user_id: admin_user_id,
        role: 'admin',
        status: 'active'
      });

      res.status(201).json({
        message: 'Club created successfully',
        club_id: clubId
      });
    } catch (error) {
      console.error('Error creating club:', error);
      res.status(500).json({ error: 'Failed to create club' });
    }
  });

  /**
   * PATCH /api/clubs/:clubId
   * Update club details
   */
  router.patch('/:clubId', async (req, res) => {
    try {
      const { clubId } = req.params;
      const updates = { ...req.body };
      delete updates.id;
      delete updates.created_at;
      
      if (updates.settings) {
        updates.settings = JSON.stringify(updates.settings);
      }
      
      updates.updated_at = db.fn.now();
      
      const updated = await db('clubs')
        .where('id', clubId)
        .update(updates);
      
      if (updated === 0) {
        return res.status(404).json({ error: 'Club not found' });
      }

      res.json({ message: 'Club updated successfully' });
    } catch (error) {
      console.error('Error updating club:', error);
      res.status(500).json({ error: 'Failed to update club' });
    }
  });

  /**
   * POST /api/clubs/:clubId/members
   * Add a member to the club
   */
  router.post('/:clubId/members', async (req, res) => {
    try {
      const { clubId } = req.params;
      const { user_id, role = 'member', invited_by } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      // Check if already a member
      const existing = await db('club_members')
        .where({ club_id: clubId, user_id })
        .first();
      
      if (existing) {
        if (existing.status === 'active') {
          return res.status(400).json({ error: 'User is already a member' });
        }
        // Reactivate
        await db('club_members')
          .where('id', existing.id)
          .update({ status: 'active', role, updated_at: db.fn.now() });
        return res.json({ message: 'Member reactivated' });
      }

      await db('club_members').insert({
        club_id: clubId,
        user_id,
        role,
        invited_by,
        status: 'active'
      });

      res.status(201).json({ message: 'Member added successfully' });
    } catch (error) {
      console.error('Error adding club member:', error);
      res.status(500).json({ error: 'Failed to add member' });
    }
  });

  /**
   * PATCH /api/clubs/:clubId/members/:userId
   * Update member role or status
   */
  router.patch('/:clubId/members/:userId', async (req, res) => {
    try {
      const { clubId, userId } = req.params;
      const { role, status } = req.body;
      
      const updates = { updated_at: db.fn.now() };
      if (role) updates.role = role;
      if (status) updates.status = status;
      
      const updated = await db('club_members')
        .where({ club_id: clubId, user_id: userId })
        .update(updates);
      
      if (updated === 0) {
        return res.status(404).json({ error: 'Club member not found' });
      }

      res.json({ message: 'Member updated successfully' });
    } catch (error) {
      console.error('Error updating club member:', error);
      res.status(500).json({ error: 'Failed to update member' });
    }
  });

  /**
   * DELETE /api/clubs/:clubId/members/:userId
   * Remove a member from the club
   */
  router.delete('/:clubId/members/:userId', async (req, res) => {
    try {
      const { clubId, userId } = req.params;
      
      const updated = await db('club_members')
        .where({ club_id: clubId, user_id: userId })
        .update({ status: 'inactive', updated_at: db.fn.now() });
      
      if (updated === 0) {
        return res.status(404).json({ error: 'Club member not found' });
      }

      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      console.error('Error removing club member:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  });

  /**
   * GET /api/clubs/:clubId/teams
   * Get all teams belonging to this club
   */
  router.get('/:clubId/teams', async (req, res) => {
    try {
      const { clubId } = req.params;
      
      const teams = await db('teams')
        .where('club_id', clubId)
        .select('*')
        .orderBy('name');
      
      res.json(teams);
    } catch (error) {
      console.error('Error fetching club teams:', error);
      res.status(500).json({ error: 'Failed to fetch club teams' });
    }
  });

  return router;
};

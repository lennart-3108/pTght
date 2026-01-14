const express = require('express');
const { isAuthenticated } = require('../middleware/auth');

/**
 * Roles and Licenses Management Routes
 * Handles role assignments, license plans, and user licenses
 */
module.exports = function rolesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // ============================================================================
  // ROLES
  // ============================================================================

  /**
   * GET /api/roles
   * Get all available roles
   */
  router.get('/', async (req, res) => {
    try {
      const roles = await db('roles')
        .where('is_active', true)
        .select('*')
        .orderBy('name');
      
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });

  /**
   * GET /api/users/:userId/roles
   * Get all roles assigned to a user
   */
  router.get('/users/:userId/roles', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const userRoles = await db('user_roles')
        .join('roles', 'user_roles.role_id', 'roles.id')
        .where('user_roles.user_id', userId)
        .where('user_roles.is_active', true)
        .select('roles.*', 'user_roles.assigned_at', 'user_roles.id as user_role_id');
      
      res.json(userRoles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      res.status(500).json({ error: 'Failed to fetch user roles' });
    }
  });

  /**
   * POST /api/users/:userId/roles
   * Assign a role to a user
   */
  router.post('/users/:userId/roles', async (req, res) => {
    try {
      const { userId } = req.params;
      const { role_id, assigned_by } = req.body;
      
      if (!role_id) {
        return res.status(400).json({ error: 'role_id is required' });
      }

      // Check if role exists
      const role = await db('roles').where('id', role_id).first();
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      // Check if user already has this role
      const existing = await db('user_roles')
        .where({ user_id: userId, role_id })
        .first();
      
      if (existing) {
        // Reactivate if inactive
        if (!existing.is_active) {
          await db('user_roles')
            .where('id', existing.id)
            .update({ is_active: true, updated_at: db.fn.now() });
          
          return res.json({ message: 'Role reactivated', user_role_id: existing.id });
        }
        return res.status(400).json({ error: 'User already has this role' });
      }

      // Insert new role assignment
      const [id] = await db('user_roles').insert({
        user_id: userId,
        role_id,
        assigned_by: assigned_by || null,
        is_active: true
      });

      res.status(201).json({ message: 'Role assigned successfully', user_role_id: id });
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(500).json({ error: 'Failed to assign role' });
    }
  });

  /**
   * DELETE /api/users/:userId/roles/:roleId
   * Remove a role from a user
   */
  router.delete('/users/:userId/roles/:roleId', async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      
      const deleted = await db('user_roles')
        .where({ user_id: userId, role_id: roleId })
        .update({ is_active: false, updated_at: db.fn.now() });
      
      if (deleted === 0) {
        return res.status(404).json({ error: 'User role not found' });
      }

      res.json({ message: 'Role removed successfully' });
    } catch (error) {
      console.error('Error removing role:', error);
      res.status(500).json({ error: 'Failed to remove role' });
    }
  });

  // ============================================================================
  // LICENSE PLANS
  // ============================================================================

  /**
   * GET /api/license-plans
   * Get all available license plans
   */
  router.get('/license-plans', async (req, res) => {
    try {
      const { role_id } = req.query;
      
      let query = db('license_plans')
        .join('roles', 'license_plans.role_id', 'roles.id')
        .where('license_plans.is_active', true)
        .select(
          'license_plans.*',
          'roles.name as role_name',
          'roles.display_name as role_display_name'
        );
      
      if (role_id) {
        query = query.where('license_plans.role_id', role_id);
      }
      
      const plans = await query.orderBy('license_plans.price');
      
      // Parse JSON fields
      const parsedPlans = plans.map(plan => ({
        ...plan,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
        limits: typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
      }));
      
      res.json(parsedPlans);
    } catch (error) {
      console.error('Error fetching license plans:', error);
      res.status(500).json({ error: 'Failed to fetch license plans' });
    }
  });

  /**
   * GET /api/license-plans/:planId
   * Get specific license plan details
   */
  router.get('/license-plans/:planId', async (req, res) => {
    try {
      const { planId } = req.params;
      
      const plan = await db('license_plans')
        .join('roles', 'license_plans.role_id', 'roles.id')
        .where('license_plans.id', planId)
        .select(
          'license_plans.*',
          'roles.name as role_name',
          'roles.display_name as role_display_name'
        )
        .first();
      
      if (!plan) {
        return res.status(404).json({ error: 'License plan not found' });
      }

      // Parse JSON fields
      plan.features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
      plan.limits = typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits;
      
      res.json(plan);
    } catch (error) {
      console.error('Error fetching license plan:', error);
      res.status(500).json({ error: 'Failed to fetch license plan' });
    }
  });

  // ============================================================================
  // USER LICENSES
  // ============================================================================

  /**
   * GET /api/users/:userId/licenses
   * Get all licenses for a user
   */
  router.get('/users/:userId/licenses', async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.query;
      
      let query = db('user_licenses')
        .join('license_plans', 'user_licenses.license_plan_id', 'license_plans.id')
        .join('roles', 'license_plans.role_id', 'roles.id')
        .where('user_licenses.user_id', userId)
        .select(
          'user_licenses.*',
          'license_plans.name as plan_name',
          'license_plans.billing_period',
          'license_plans.price',
          'roles.name as role_name',
          'roles.display_name as role_display_name'
        );
      
      if (status) {
        query = query.where('user_licenses.status', status);
      }
      
      const licenses = await query.orderBy('user_licenses.created_at', 'desc');
      
      // Parse JSON metadata
      const parsedLicenses = licenses.map(license => ({
        ...license,
        metadata: typeof license.metadata === 'string' ? JSON.parse(license.metadata) : license.metadata
      }));
      
      res.json(parsedLicenses);
    } catch (error) {
      console.error('Error fetching user licenses:', error);
      res.status(500).json({ error: 'Failed to fetch user licenses' });
    }
  });

  /**
   * POST /api/users/:userId/licenses
   * Purchase/activate a new license for a user
   */
  router.post('/users/:userId/licenses', async (req, res) => {
    try {
      const { userId } = req.params;
      const { license_plan_id, entity_id, entity_type, payment_method, auto_renew = true } = req.body;
      
      if (!license_plan_id) {
        return res.status(400).json({ error: 'license_plan_id is required' });
      }

      // Get license plan details
      const plan = await db('license_plans').where('id', license_plan_id).first();
      if (!plan) {
        return res.status(404).json({ error: 'License plan not found' });
      }

      // Calculate expiry date
      let expires_at = null;
      if (plan.duration_days) {
        const startDate = new Date();
        expires_at = new Date(startDate.getTime() + (plan.duration_days * 24 * 60 * 60 * 1000));
      }

      // Create license
      const [licenseId] = await db('user_licenses').insert({
        user_id: userId,
        license_plan_id,
        status: 'active',
        starts_at: db.fn.now(),
        expires_at,
        auto_renew,
        entity_id: entity_id || null,
        entity_type: entity_type || null,
        metadata: JSON.stringify({})
      });

      // Create transaction record (pending payment)
      const [transactionId] = await db('license_transactions').insert({
        user_license_id: licenseId,
        user_id: userId,
        amount: plan.price,
        currency: 'EUR',
        status: 'pending',
        payment_method: payment_method || 'pending'
      });

      // Assign corresponding role if not already assigned
      const role = await db('roles').where('id', plan.role_id).first();
      if (role) {
        const existingRole = await db('user_roles')
          .where({ user_id: userId, role_id: role.id })
          .first();
        
        if (!existingRole) {
          await db('user_roles').insert({
            user_id: userId,
            role_id: role.id,
            is_active: true
          });
        } else if (!existingRole.is_active) {
          await db('user_roles')
            .where('id', existingRole.id)
            .update({ is_active: true });
        }
      }

      res.status(201).json({
        message: 'License activated successfully',
        license_id: licenseId,
        transaction_id: transactionId,
        expires_at
      });
    } catch (error) {
      console.error('Error creating user license:', error);
      res.status(500).json({ error: 'Failed to create license' });
    }
  });

  /**
   * PATCH /api/users/:userId/licenses/:licenseId
   * Update license status (cancel, suspend, etc.)
   */
  router.patch('/users/:userId/licenses/:licenseId', async (req, res) => {
    try {
      const { userId, licenseId } = req.params;
      const { status, auto_renew } = req.body;
      
      const updates = {};
      if (status) updates.status = status;
      if (typeof auto_renew === 'boolean') updates.auto_renew = auto_renew;
      if (status === 'cancelled') updates.cancelled_at = db.fn.now();
      
      updates.updated_at = db.fn.now();
      
      const updated = await db('user_licenses')
        .where({ id: licenseId, user_id: userId })
        .update(updates);
      
      if (updated === 0) {
        return res.status(404).json({ error: 'License not found' });
      }

      res.json({ message: 'License updated successfully' });
    } catch (error) {
      console.error('Error updating license:', error);
      res.status(500).json({ error: 'Failed to update license' });
    }
  });

  /**
   * GET /api/users/:userId/licenses/active
   * Check if user has active license for specific role
   */
  router.get('/users/:userId/licenses/active', async (req, res) => {
    try {
      const { userId } = req.params;
      const { role_name } = req.query;
      
      let query = db('user_licenses')
        .join('license_plans', 'user_licenses.license_plan_id', 'license_plans.id')
        .join('roles', 'license_plans.role_id', 'roles.id')
        .where('user_licenses.user_id', userId)
        .where('user_licenses.status', 'active')
        .where(function() {
          this.whereNull('user_licenses.expires_at')
            .orWhere('user_licenses.expires_at', '>', db.fn.now());
        });
      
      if (role_name) {
        query = query.where('roles.name', role_name);
      }
      
      const activeLicenses = await query.select(
        'user_licenses.*',
        'license_plans.name as plan_name',
        'roles.name as role_name',
        'roles.display_name as role_display_name'
      );
      
      res.json({
        has_active_license: activeLicenses.length > 0,
        licenses: activeLicenses
      });
    } catch (error) {
      console.error('Error checking active licenses:', error);
      res.status(500).json({ error: 'Failed to check active licenses' });
    }
  });

  /**
   * POST /api/roles/purchase
   * Purchase a license plan (authenticated endpoint)
   */
  router.post('/purchase', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const { license_plan_id, payment_method = 'paypal_simulated', amount } = req.body;
      
      if (!license_plan_id) {
        return res.status(400).json({ error: 'license_plan_id is required' });
      }

      // Get license plan details
      const plan = await db('license_plans')
        .join('roles', 'license_plans.role_id', 'roles.id')
        .where('license_plans.id', license_plan_id)
        .select('license_plans.*', 'roles.name as role_name', 'roles.id as role_id', 'roles.display_name as role_display_name')
        .first();
        
      if (!plan) {
        return res.status(404).json({ error: 'License plan not found' });
      }

      // Verify amount matches plan price
      if (amount && parseFloat(amount) !== parseFloat(plan.price)) {
        return res.status(400).json({ error: 'Amount mismatch' });
      }

      // Check if user already has active license for this role
      const existingLicense = await db('user_licenses')
        .join('license_plans', 'user_licenses.license_plan_id', 'license_plans.id')
        .where('user_licenses.user_id', userId)
        .where('license_plans.role_id', plan.role_id)
        .where('user_licenses.status', 'active')
        .where(function() {
          this.whereNull('user_licenses.expires_at')
            .orWhere('user_licenses.expires_at', '>', db.fn.now());
        })
        .first();

      if (existingLicense) {
        return res.status(400).json({ error: 'You already have an active license for this role' });
      }

      // Calculate expiry date
      let expires_at = null;
      if (plan.duration_days) {
        const startDate = new Date();
        expires_at = new Date(startDate.getTime() + (plan.duration_days * 24 * 60 * 60 * 1000)).toISOString();
      }

      // Create license
      const [licenseId] = await db('user_licenses').insert({
        user_id: userId,
        license_plan_id: plan.id,
        status: 'active',
        starts_at: new Date().toISOString(),
        expires_at,
        auto_renew: true,
        metadata: JSON.stringify({ purchase_method: payment_method })
      });

      // Create transaction record (simulated payment = completed)
      const transactionIdString = `SIMULATED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const [transactionId] = await db('license_transactions').insert({
        user_license_id: licenseId,
        user_id: userId,
        amount: plan.price,
        currency: 'EUR',
        status: 'completed',
        payment_method,
        transaction_id: transactionIdString,
        completed_at: new Date().toISOString()
      });

      // Assign corresponding role if not already assigned
      const existingRole = await db('user_roles')
        .where({ user_id: userId, role_id: plan.role_id })
        .first();
      
      if (!existingRole) {
        await db('user_roles').insert({
          user_id: userId,
          role_id: plan.role_id,
          is_active: true,
          assigned_at: new Date().toISOString()
        });
      } else if (!existingRole.is_active) {
        await db('user_roles')
          .where('id', existingRole.id)
          .update({ 
            is_active: true,
            updated_at: new Date().toISOString()
          });
      }

      // Send confirmation email
      try {
        const user = await db('users').where('id', userId).first();
        if (user && user.email) {
          const nodemailer = require('nodemailer');
          const { renderEmailTemplate } = require('../emailTemplate');
          
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: process.env.SMTP_PORT || 1025,
            secure: false
          });

          const expiryText = expires_at 
            ? `Gültig bis: ${new Date(expires_at).toLocaleDateString('de-DE')}`
            : 'Unbegrenzte Gültigkeit';

          const emailHtml = renderEmailTemplate({
            title: `Lizenz erfolgreich gebucht`,
            bodyContent: `
              <h2>Hallo ${user.name},</h2>
              <p>Deine Lizenz wurde erfolgreich aktiviert!</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #48baa6;">Details deiner Lizenz:</h3>
                <p><strong>Lizenz:</strong> ${plan.name}</p>
                <p><strong>Rolle:</strong> ${plan.role_display_name}</p>
                <p><strong>Betrag:</strong> €${plan.price}</p>
                <p><strong>${expiryText}</strong></p>
                <p><strong>Transaktions-ID:</strong> ${transactionIdString}</p>
              </div>
              <p>Du hast jetzt Zugriff auf alle Funktionen dieser Rolle.</p>
              <p>Viel Erfolg!</p>
            `
          });

          await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@sportsplatform.com',
            to: user.email,
            subject: `Lizenz-Bestätigung: ${plan.name}`,
            html: emailHtml
          });
        }
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        message: `License "${plan.name}" activated successfully`,
        license_id: licenseId,
        transaction_id: transactionId,
        role_name: plan.role_name,
        expires_at
      });
    } catch (error) {
      console.error('Error purchasing license:', error);
      res.status(500).json({ error: 'Failed to purchase license' });
    }
  });

  return router;
};

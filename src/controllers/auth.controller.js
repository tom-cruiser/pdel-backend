const { formatResponse } = require("../utils/helpers");

const authController = {
  async healthCheck(req, res) {
    res.json(
      formatResponse(true, {
        status: "OK",
        timestamp: new Date().toISOString(),
      })
    );
  },
  async localLogin(req, res) {
    const { email, password } = req.body || {};
    const logger = require('../utils/logger');
    logger.info('localLogin attempt', { body: req.body });
    if (!email || !password) {
      return res.status(400).json(formatResponse(false, null, 'Email and password required'));
    }

    try {
      const profilesService = require('../services/profiles.service');
      const profile = await profilesService.getProfileByEmail(email);
      if (!profile || !profile.password_hash) {
        return res.status(401).json(formatResponse(false, null, 'Invalid email or password'));
      }

      // If profile has an email_confirmed flag and it's false, block login
      if (Object.prototype.hasOwnProperty.call(profile, 'email_confirmed') && profile.email_confirmed === false) {
        return res.status(403).json(formatResponse(false, null, 'Email not confirmed'));
      }

      // password_hash format: scrypt$<salt>$<derived>
      const [scheme, salt, derived] = profile.password_hash.split('$');
      if (scheme !== 'scrypt' || !salt || !derived) {
        return res.status(500).json(formatResponse(false, null, 'Invalid password storage format'));
      }

      const crypto = require('crypto');
      const computed = crypto.scryptSync(password, salt, 64).toString('hex');
      if (computed !== derived) {
        return res.status(401).json(formatResponse(false, null, 'Invalid email or password'));
      }

      // Success — return dev token for local development
      const token = `dev:${profile._id || profile.id}`;
      // sanitize profile before returning
      const safeProfile = { ...profile };
      if (safeProfile.password_hash) delete safeProfile.password_hash;
      if (safeProfile.password_reset_token) delete safeProfile.password_reset_token;
      if (safeProfile.email_confirm_token) delete safeProfile.email_confirm_token;
      if (safeProfile.password_reset_expires) delete safeProfile.password_reset_expires;
      return res.json(formatResponse(true, { token, profile: safeProfile }));
    } catch (e) {
      console.error('localLogin error', e);
      return res.status(500).json(formatResponse(false, null, 'Login failed'));
    }
  },
  async register(req, res) {
    const { email, password, full_name, phone } = req.body || {};
    if (!email || !password) {
      return res.status(400).json(formatResponse(false, null, 'Email and password required'));
    }

    try {
      const profilesService = require('../services/profiles.service');

      // Check if email already exists
      const existingProfile = await profilesService.getProfileByEmail(email);
      if (existingProfile) {
        return res.status(409).json(formatResponse(false, null, 'Email already registered'));
      }

      const crypto = require('crypto');

      // simple scrypt hash format used by admin script
      const salt = crypto.randomBytes(16).toString('hex');
      const derived = crypto.scryptSync(password, salt, 64).toString('hex');
      const password_hash = `scrypt$${salt}$${derived}`;

      const userId = crypto.randomUUID();
      // email confirmation token
      const email_confirm_token = crypto.randomBytes(20).toString('hex');

      // Create profile and auto-confirm email so users can sign in immediately
      const doc = await profilesService.createProfile(userId, {
        email,
        full_name: full_name || null,
        phone: phone || null,
        is_admin: false,
        password_hash,
        // no confirmation token required when auto-confirming
        email_confirm_token: null,
        email_confirmed: true,
      });

      // Sanitize and return an auth token so frontend can sign the user in immediately
      const safeProfile = { ...doc };
      if (safeProfile.password_hash) delete safeProfile.password_hash;
      if (safeProfile.email_confirm_token) delete safeProfile.email_confirm_token;

      const token = `dev:${userId}`;
      return res.json(formatResponse(true, { token, profile: safeProfile, message: 'Registration successful.' }));
    } catch (e) {
      console.error('register error', e);
      return res.status(500).json(formatResponse(false, null, 'Registration failed: ' + (e && e.message ? e.message : '')));
    }
  },
  async confirmEmail(req, res) {
    try {
      console.log('🔍 confirmEmail called with:', { query: req.query, body: req.body, method: req.method });

      const token = req.query.token || req.body?.token;
      if (!token) return res.status(400).json(formatResponse(false, null, 'Token required'));

      const profilesService = require('../services/profiles.service');
      const profile = await profilesService.getProfileByConfirmToken(token);
      if (!profile) return res.status(400).json(formatResponse(false, null, 'Invalid or expired token'));

      // Update profile to confirmed
      const id = profile._id || profile.id;
      await profilesService.updateProfile(id, { email_confirmed: true, email_confirm_token: null });
      console.log('✅ Email confirmed successfully for:', profile.email);

      // AUTO-LOGIN: Generate a dev token for immediate login
      const loginToken = `dev:${id}`;

      // Get updated profile and sanitize
      const updatedProfile = await profilesService.getProfile(id);
      const safeProfile = { ...updatedProfile };
      if (safeProfile.password_hash) delete safeProfile.password_hash;
      if (safeProfile.email_confirm_token) delete safeProfile.email_confirm_token;
      if (safeProfile.password_reset_token) delete safeProfile.password_reset_token;
      if (safeProfile.password_reset_expires) delete safeProfile.password_reset_expires;

      return res.json(formatResponse(true, { 
        token: loginToken, 
        profile: safeProfile,
        message: 'Email confirmed successfully. You are now logged in!'
      }));
    } catch (e) {
      console.error('confirmEmail error', e);
      return res.status(500).json(formatResponse(false, null, 'Confirmation failed: ' + (e && e.message ? e.message : '')));
    }
  },
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json(formatResponse(false, null, 'Email required'));
      const profilesService = require('../services/profiles.service');
      const profile = await profilesService.getProfileByEmail(email);
      // Always respond 200 to avoid user enumeration
      if (!profile) return res.json(formatResponse(true, { message: 'If that email exists we sent a reset link' }));

      const crypto = require('crypto');
      const token = crypto.randomBytes(20).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await profilesService.updateProfile(profile._id || profile.id, { password_reset_token: token, password_reset_expires: expires });

      // NOTE: outbound email sending has been disabled to avoid relying on SMTP in
      // production environments (e.g. Render blocks egress). We still generate and
      // log the reset link so operators can retrieve it when needed.
      const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink = `${clientUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
      console.info('Password reset link (email sending disabled):', resetLink);

      return res.json(formatResponse(true, { message: 'If that email exists we sent a reset link' }));
    } catch (e) {
      console.error('requestPasswordReset error', e);
      return res.status(500).json(formatResponse(false, null, 'Failed to request password reset'));
    }
  },
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json(formatResponse(false, null, 'Token and password required'));
      const profilesService = require('../services/profiles.service');
      const profile = await profilesService.getProfileByResetToken(token);
      if (!profile) return res.status(400).json(formatResponse(false, null, 'Invalid or expired token'));
      const expires = new Date(profile.password_reset_expires || null);
      if (!expires || expires < new Date()) return res.status(400).json(formatResponse(false, null, 'Invalid or expired token'));

      const crypto = require('crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const derived = crypto.scryptSync(password, salt, 64).toString('hex');
      const password_hash = `scrypt$${salt}$${derived}`;

      await profilesService.updateProfile(profile._id || profile.id, { password_hash, password_reset_token: null, password_reset_expires: null });
      return res.json(formatResponse(true, { message: 'Password updated' }));
    } catch (e) {
      console.error('resetPassword error', e);
      return res.status(500).json(formatResponse(false, null, 'Failed to reset password'));
    }
  },
  async mode(req, res) {
    try {
      const config = require('../config');
      const usingMongo = Boolean(config.MONGODB_URI);
      return res.json({ success: true, data: { db: usingMongo ? 'mongo' : 'postgres', allowLocalLogin: true } });
    } catch (e) {
      console.error('mode endpoint error', e);
      return res.status(500).json({ success: false, message: 'Unable to determine mode' });
    }
  },
};

module.exports = authController;

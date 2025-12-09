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
    const logger = require("../utils/logger");
    logger.info("localLogin attempt", { body: req.body });

    if (!email || !password) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Email and password required"));
    }

    try {
      const profilesService = require("../services/profiles.service");
      const profile = await profilesService.getProfileByEmail(email);
      if (!profile || !profile.password_hash) {
        return res
          .status(401)
          .json(formatResponse(false, null, "Invalid email or password"));
      }

      // password_hash format: scrypt$<salt>$<derived>
      const [scheme, salt, derived] = profile.password_hash.split("$");
      if (scheme !== "scrypt" || !salt || !derived) {
        return res
          .status(500)
          .json(formatResponse(false, null, "Invalid password storage format"));
      }

      const crypto = require("crypto");
      const computed = crypto.scryptSync(password, salt, 64).toString("hex");
      if (computed !== derived) {
        return res
          .status(401)
          .json(formatResponse(false, null, "Invalid email or password"));
      }

      // Success — return dev token for local development
      const token = `dev:${profile._id || profile.id}`;
      // Sanitize profile before returning
      const safeProfile = { ...profile };
      if (safeProfile.password_hash) delete safeProfile.password_hash;

      return res.json(formatResponse(true, { token, profile: safeProfile }));
    } catch (e) {
      console.error("localLogin error", e);
      return res.status(500).json(formatResponse(false, null, "Login failed"));
    }
  },

  async register(req, res) {
    const { email, password, full_name, phone } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Email and password required"));
    }

    try {
      const profilesService = require("../services/profiles.service");

      // Check if email already exists
      const existingProfile = await profilesService.getProfileByEmail(email);
      if (existingProfile) {
        return res
          .status(409)
          .json(formatResponse(false, null, "Email already registered"));
      }

      const crypto = require("crypto");

      // Simple scrypt hash format used by admin script
      const salt = crypto.randomBytes(16).toString("hex");
      const derived = crypto.scryptSync(password, salt, 64).toString("hex");
      const password_hash = `scrypt$${salt}$${derived}`;

      const userId = crypto.randomUUID();

      // Create profile and auto-confirm email so users can sign in immediately
      const doc = await profilesService.createProfile(userId, {
        email,
        full_name: full_name || null,
        phone: phone || null,
        is_admin: false,
        password_hash,
      });

      // Sanitize and return an auth token so frontend can sign the user in immediately
      const safeProfile = { ...doc };
      if (safeProfile.password_hash) delete safeProfile.password_hash;

      const token = `dev:${userId}`;
      return res.json(
        formatResponse(true, {
          token,
          profile: safeProfile,
          message: "Registration successful.",
        })
      );
    } catch (e) {
      console.error("register error", e);
      return res
        .status(500)
        .json(
          formatResponse(
            false,
            null,
            "Registration failed: " + (e && e.message ? e.message : "")
          )
        );
    }
  },

  async mode(req, res) {
    try {
      const config = require("../config");
      const usingMongo = Boolean(config.MONGODB_URI);
      return res.json({
        success: true,
        data: { db: usingMongo ? "mongo" : "postgres", allowLocalLogin: true },
      });
    } catch (e) {
      console.error("mode endpoint error", e);
      return res
        .status(500)
        .json({ success: false, message: "Unable to determine mode" });
    }
  },
};

module.exports = authController;

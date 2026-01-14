const profilesService = require("../services/profiles.service");
const { formatResponse } = require("../utils/helpers");

const profilesController = {
  async getMyProfile(req, res, next) {
    try {
      const profile = await profilesService.getProfile(req.user.id);
      if (profile) {
        // remove sensitive fields
        const safe = { ...profile };
        delete safe.password_hash;
        delete safe.email_confirm_token;
        delete safe.password_reset_token;
        delete safe.password_reset_expires;
        // MongoDB uses _id, but frontend expects id
        if (safe._id && !safe.id) {
          safe.id = safe._id;
        }
        res.json(formatResponse(true, safe));
      } else {
        res.json(formatResponse(true, null));
      }
    } catch (error) {
      next(error);
    }
  },

  async updateMyProfile(req, res, next) {
    try {
      const updatedProfile = await profilesService.updateProfile(
        req.user.id,
        req.body
      );
      res.json(
        formatResponse(true, updatedProfile, "Profile updated successfully")
      );
    } catch (error) {
      next(error);
    }
  },

  async getAllProfiles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const filters = {
        search: req.query.search, // Search by name, email, phone
        role: req.query.role, // 'admin', 'user'
        email_confirmed: req.query.email_confirmed, // 'true', 'false'
      };
      
      const result = await profilesService.getAllProfiles(filters, page, limit);
      
      // Remove sensitive fields
      const safeProfiles = result.profiles.map((p) => {
        const copy = { ...p };
        delete copy.password_hash;
        delete copy.email_confirm_token;
        delete copy.password_reset_token;
        delete copy.password_reset_expires;
        // Add id field for frontend compatibility
        if (copy._id && !copy.id) {
          copy.id = copy._id;
        }
        return copy;
      });
      
      res.json(formatResponse(true, {
        profiles: safeProfiles,
        pagination: result.pagination
      }));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = profilesController;

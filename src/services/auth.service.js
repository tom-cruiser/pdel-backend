const config = require("../config");
let supabaseClient = null;
if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseClient = require("./supabase");
}
const profilesService = require("./profiles.service");

class AuthService {
  async verifyToken(token) {
    // Development shortcut when using MongoDB: allow tokens like `dev:<userId>`
    if (process.env.MONGODB_URI && token) {
      if (token.startsWith("dev:")) {
        const userId = token.substring(4);
        return { id: userId };
      }

      // Optionally allow decoding JWT payload in dev when explicitly enabled
      // via the ALLOW_DEV_JWT config flag. This is insecure and MUST only be
      // used for local development troubleshooting when Supabase is not
      // configured.
      if (config.ALLOW_DEV_JWT) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
            const userId = payload.sub || payload.user_id || payload.id;
            const email = payload.email || null;
            if (userId) {
              return { id: userId, email };
            }
          }
        } catch (e) {
          // fallthrough to supabase path / error
        }
      }
    }

    if (!supabaseClient) {
      throw new Error(
        "Authentication unavailable: no Supabase client configured. For local development use a dev token 'dev:<userId>' or enable ALLOW_DEV_JWT."
      );
    }

    try {
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser(token);
      if (error || !user) {
        throw new Error("Invalid token");
      }
      return user;
    } catch (error) {
      throw new Error("Authentication failed");
    }
  }

  async getUserProfile(userId) {
    // Delegate to ProfilesService which supports Postgres or MongoDB
    return profilesService.getProfile(userId);
  }
}

module.exports = new AuthService();

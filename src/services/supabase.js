const config = require("../config");

// Export a Supabase client only when explicitly configured. This file is
// defensive: if the dependency is removed from package.json we don't want
// the app to crash on require. When not configured, this module exports
// `null` so callers know Supabase is unavailable.
let supabase = null;
if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    // Require inside the block so missing dependency won't break startup
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch (err) {
    // Log a warning but don't throw. This makes the app tolerant if the
    // Supabase package is removed intentionally.
    // eslint-disable-next-line no-console
    console.warn("Supabase client not available:", err && err.message);
    supabase = null;
  }
}

module.exports = supabase;

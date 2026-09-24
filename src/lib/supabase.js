const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

// One shared Supabase client using the service key.
// The service key bypasses row level security, so this client must only
// ever be used on the backend, and every query must filter by user_id.
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: {
    // A server has no browser storage and no logged-in session of its own.
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;

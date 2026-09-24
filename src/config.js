// Loads environment variables from .env (locally) and checks that the
// required ones are set. On Render, the values come from the Environment tab.
require("dotenv").config({ quiet: true });

// Variables the web service cannot run without.
// (Kassalapp and Gmail variables are only needed by the daily job,
// so they are checked there instead.)
const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "FRONTEND_URL"];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  // Fail fast: a clear error at startup beats a confusing one later.
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env and fill in the values.");
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  // Trim a trailing slash so CORS matches and links don't become "//groceries".
  frontendUrl: process.env.FRONTEND_URL.replace(/\/+$/, ""),
};

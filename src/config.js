require("dotenv").config({ quiet: true });

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "FRONTEND_URL"];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env and fill in the values.");
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  frontendUrl: process.env.FRONTEND_URL.replace(/\/+$/, ""),
};

const { isAuthRetryableFetchError } = require("@supabase/supabase-js");
const supabase = require("../lib/supabase");

// Checks the "Authorization: Bearer <token>" header and sets req.userId.
// Routes that use this middleware can trust req.userId; they must never
// take a user id from the request body.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing login token" });
  }

  // Asks Supabase who this token belongs to. This also rejects expired tokens.
  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    // Network problem talking to Supabase: not the user's fault, so don't
    // answer 401 (the frontend would log them out for no reason).
    if (isAuthRetryableFetchError(error)) {
      console.error("Supabase auth unreachable:", error.message);
      return res.status(503).json({ error: "Login service unavailable, try again" });
    }
    return res.status(401).json({ error: "Invalid or expired login token" });
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email; // shown on the Settings page
  next();
}

module.exports = requireAuth;

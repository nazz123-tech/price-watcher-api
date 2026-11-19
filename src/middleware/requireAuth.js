const { isAuthRetryableFetchError } = require("@supabase/supabase-js");
const supabase = require("../lib/supabase");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing login token" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    if (isAuthRetryableFetchError(error)) {
      console.error("Supabase auth unreachable:", error.message);
      return res.status(503).json({ error: "Login service unavailable, try again" });
    }
    return res.status(401).json({ error: "Invalid or expired login token" });
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email;
  next();
}

module.exports = requireAuth;

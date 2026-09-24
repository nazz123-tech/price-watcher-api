const express = require("express");
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

// Users without a user_settings row get the default: alerts on.
async function getEmailAlerts(userId) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("email_alerts")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.email_alerts : true;
}

// GET /settings: { email, email_alerts }
router.get("/", async (req, res) => {
  const emailAlerts = await getEmailAlerts(req.userId);
  res.json({ email: req.userEmail, email_alerts: emailAlerts });
});

// PATCH /settings: turn alerts on or off. Body: { email_alerts: true | false }
router.patch("/", async (req, res) => {
  const emailAlerts = req.body?.email_alerts;
  if (typeof emailAlerts !== "boolean") {
    return res.status(400).json({ error: "email_alerts must be true or false" });
  }

  // Insert the row the first time, update it after that.
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: req.userId, email_alerts: emailAlerts }, { onConflict: "user_id" });
  if (error) throw error;

  res.json({ email: req.userEmail, email_alerts: emailAlerts });
});

module.exports = router;

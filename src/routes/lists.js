const express = require("express");
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/requireAuth");
const { checkText, isUuid } = require("../lib/validate");

// Lists group groceries, e.g. "Breakfast", "Dinner", "Snacks".
// Each grocery belongs to at most one list (watch_items.list_id).
const router = express.Router();

router.use(requireAuth);

const LIST_COLUMNS = "id, name, created_at";

// Postgres error code for "unique constraint violated" (same name twice).
const UNIQUE_VIOLATION = "23505";

function duplicateName(res) {
  return res.status(409).json({ error: "You already have a list with that name" });
}

// GET /lists: my lists, oldest first.
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("lists")
    .select(LIST_COLUMNS)
    .eq("user_id", req.userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  res.json(data);
});

// POST /lists: create a list. Body: { name }
router.post("/", async (req, res) => {
  const { value: name, error: validationError } = checkText(req.body?.name, "name");
  if (validationError) return res.status(400).json({ error: validationError });

  const { data, error } = await supabase
    .from("lists")
    .insert({ name, user_id: req.userId })
    .select(LIST_COLUMNS)
    .single();
  if (error?.code === UNIQUE_VIOLATION) return duplicateName(res);
  if (error) throw error;

  res.status(201).json(data);
});

// PATCH /lists/:id: rename a list. Body: { name }
router.patch("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: "List not found" });
  const { value: name, error: validationError } = checkText(req.body?.name, "name");
  if (validationError) return res.status(400).json({ error: validationError });

  const { data, error } = await supabase
    .from("lists")
    .update({ name })
    .eq("id", req.params.id)
    .eq("user_id", req.userId)
    .select(LIST_COLUMNS)
    .maybeSingle();
  if (error?.code === UNIQUE_VIOLATION) return duplicateName(res);
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "List not found" });

  res.json(data);
});

// DELETE /lists/:id: remove a list. Its groceries stay, just without a list
// (the database sets their list_id to null).
router.delete("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ error: "List not found" });

  const { data, error } = await supabase
    .from("lists")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "List not found" });

  res.status(204).end();
});

module.exports = router;

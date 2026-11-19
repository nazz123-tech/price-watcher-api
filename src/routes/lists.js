const express = require("express");
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/requireAuth");
const { checkText, isUuid } = require("../lib/validate");

const router = express.Router();

router.use(requireAuth);

const LIST_COLUMNS = "id, name, created_at";

const UNIQUE_VIOLATION = "23505";

function duplicateName(res) {
  return res.status(409).json({ error: "You already have a list with that name" });
}

router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("lists")
    .select(LIST_COLUMNS)
    .eq("user_id", req.userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  res.json(data);
});

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

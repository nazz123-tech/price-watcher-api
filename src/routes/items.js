const express = require("express");
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// Every /items route needs a logged-in user.
router.use(requireAuth);

const MAX_TEXT_LENGTH = 100;
// numeric(10,2) in the database can hold at most 99 999 999.99.
const MAX_PRICE = 99999999.99;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- Validation helpers ---------------------------------------------------
// Each one returns { value } when the input is OK, or { error } when not.

function checkText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: `${field} must be a non-empty text` };
  }
  if (value.trim().length > MAX_TEXT_LENGTH) {
    return { error: `${field} can be at most ${MAX_TEXT_LENGTH} characters` };
  }
  return { value: value.trim() };
}

// Search words are stored lowercase with single spaces, so "Tine  Lettmelk"
// and "tine lettmelk" share one row in price_cache and one Kassalapp call.
function checkSearch(value) {
  const result = checkText(value, "search");
  if (result.error) return result;
  return { value: result.value.toLowerCase().replace(/\s+/g, " ") };
}

function checkPrice(value) {
  // Accept 25 and "25", but not "", null, true or "abc".
  const price = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return { error: "target_price must be a positive number" };
  }
  if (price > MAX_PRICE) {
    return { error: "target_price is too large" };
  }
  // Round to øre (2 decimals), like the database column.
  return { value: Math.round(price * 100) / 100 };
}

// Validates the fields present in the body. With partial = true (PATCH),
// missing fields are allowed; otherwise (POST) all three are required.
function validateItem(body, partial) {
  const checks = { name: (v) => checkText(v, "name"), search: checkSearch, target_price: checkPrice };
  const fields = {};

  for (const [field, check] of Object.entries(checks)) {
    if (body[field] === undefined) {
      if (!partial) return { error: `${field} is required` };
      continue;
    }
    const result = check(body[field]);
    if (result.error) return { error: result.error };
    fields[field] = result.value;
  }

  if (partial && Object.keys(fields).length === 0) {
    return { error: "Send at least one of name, search, target_price" };
  }
  return { fields };
}

// --- Routes -----------------------------------------------------------------

const ITEM_COLUMNS = "id, name, search, target_price, created_at";

// GET /items: my groceries, each with the latest cached price (or null).
router.get("/", async (req, res) => {
  const { data: items, error } = await supabase
    .from("watch_items")
    .select(ITEM_COLUMNS)
    .eq("user_id", req.userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Look up cached prices for all my search terms in one query.
  const searches = [...new Set(items.map((item) => item.search))];
  const pricesBySearch = {};
  if (searches.length > 0) {
    const { data: prices, error: priceError } = await supabase
      .from("price_cache")
      .select("search, price, store, product_name, checked_at")
      .in("search", searches);
    if (priceError) throw priceError;
    for (const row of prices) pricesBySearch[row.search] = row;
  }

  const result = items.map((item) => {
    const cached = pricesBySearch[item.search];
    const price = cached ? cached.price : null;
    return {
      ...item,
      price,
      store: cached ? cached.store : null,
      product_name: cached ? cached.product_name : null,
      checked_at: cached ? cached.checked_at : null,
      is_deal: price !== null && price <= item.target_price,
    };
  });

  res.json(result);
});

// POST /items: add a grocery. Body: { name, search, target_price }
router.post("/", async (req, res) => {
  const { fields, error: validationError } = validateItem(req.body || {}, false);
  if (validationError) return res.status(400).json({ error: validationError });

  const { data, error } = await supabase
    .from("watch_items")
    // user_id always comes from the token, never from the body.
    .insert({ ...fields, user_id: req.userId })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw error;

  res.status(201).json(data);
});

// PATCH /items/:id: change name, search and/or target_price.
router.patch("/:id", async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ error: "Item not found" });
  }
  const { fields, error: validationError } = validateItem(req.body || {}, true);
  if (validationError) return res.status(400).json({ error: validationError });

  const { data, error } = await supabase
    .from("watch_items")
    .update(fields)
    .eq("id", req.params.id)
    .eq("user_id", req.userId) // can only change your own items
    .select(ITEM_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Item not found" });

  res.json(data);
});

// DELETE /items/:id: remove a grocery.
router.delete("/:id", async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ error: "Item not found" });
  }

  const { data, error } = await supabase
    .from("watch_items")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.userId) // can only delete your own items
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Item not found" });

  res.status(204).end();
});

module.exports = router;

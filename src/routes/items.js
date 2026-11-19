const express = require("express");
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/requireAuth");
const { checkText, isUuid } = require("../lib/validate");

const router = express.Router();

router.use(requireAuth);

const MAX_PRICE = 99999999.99;

function checkSearch(value) {
  const result = checkText(value, "search");
  if (result.error) return result;
  return { value: result.value.toLowerCase().replace(/\s+/g, " ") };
}

function checkPrice(value) {
  const price = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return { error: "target_price must be a positive number" };
  }
  if (price > MAX_PRICE) {
    return { error: "target_price is too large" };
  }
  return { value: Math.round(price * 100) / 100 };
}

function checkListId(value) {
  if (value === null) return { value: null };
  if (!isUuid(value)) return { error: "list_id must be a list id or null" };
  return { value };
}

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

  if (body.list_id !== undefined) {
    const result = checkListId(body.list_id);
    if (result.error) return { error: result.error };
    fields.list_id = result.value;
  }

  if (partial && Object.keys(fields).length === 0) {
    return { error: "Send at least one of name, search, target_price, list_id" };
  }
  return { fields };
}

const ITEM_COLUMNS = "id, name, search, target_price, list_id, created_at";

async function isOwnList(listId, userId) {
  if (listId === null || listId === undefined) return true;
  const { data, error } = await supabase
    .from("lists")
    .select("id")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

router.get("/", async (req, res) => {
  const { data: items, error } = await supabase
    .from("watch_items")
    .select(ITEM_COLUMNS)
    .eq("user_id", req.userId)
    .order("created_at", { ascending: true });
  if (error) throw error;

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

// Searches watched by at least this many people; fewer could reveal one person's list.
const MIN_WATCHERS = 2;

// shortcut: reads every watch item and counts in JS; move to a SQL view once there are tens of thousands of rows.
router.get("/popular", async (req, res) => {
  const { data: items, error } = await supabase.from("watch_items").select("search, user_id");
  if (error) throw error;

  const watchers = {};
  for (const { search, user_id } of items) (watchers[search] ??= new Set()).add(user_id);

  const top = Object.entries(watchers)
    .map(([search, users]) => ({ search, watchers: users.size }))
    .filter((row) => row.watchers >= MIN_WATCHERS)
    .sort((a, b) => b.watchers - a.watchers || a.search.localeCompare(b.search))
    .slice(0, 12);

  const prices = {};
  if (top.length > 0) {
    const { data, error: priceError } = await supabase
      .from("price_cache")
      .select("search, price, store, product_name, checked_at")
      .in("search", top.map((row) => row.search));
    if (priceError) throw priceError;
    for (const row of data) prices[row.search] = row;
  }

  res.json(
    top.map((row) => ({
      ...row,
      price: prices[row.search]?.price ?? null,
      store: prices[row.search]?.store ?? null,
      product_name: prices[row.search]?.product_name ?? null,
      checked_at: prices[row.search]?.checked_at ?? null,
    })),
  );
});

router.post("/", async (req, res) => {
  const { fields, error: validationError } = validateItem(req.body || {}, false);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!(await isOwnList(fields.list_id, req.userId))) {
    return res.status(400).json({ error: "List not found" });
  }

  const { data, error } = await supabase
    .from("watch_items")
    .insert({ ...fields, user_id: req.userId })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw error;

  res.status(201).json(data);
});

router.patch("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) {
    return res.status(404).json({ error: "Item not found" });
  }
  const { fields, error: validationError } = validateItem(req.body || {}, true);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!(await isOwnList(fields.list_id, req.userId))) {
    return res.status(400).json({ error: "List not found" });
  }

  const { data, error } = await supabase
    .from("watch_items")
    .update(fields)
    .eq("id", req.params.id)
    .eq("user_id", req.userId)
    .select(ITEM_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Item not found" });

  res.json(data);
});

router.delete("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) {
    return res.status(404).json({ error: "Item not found" });
  }

  const { data, error } = await supabase
    .from("watch_items")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", req.userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Item not found" });

  res.status(204).end();
});

module.exports = router;

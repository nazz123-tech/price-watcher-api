const supabase = require("./supabase");
const { findCheapest } = require("./kassalapp");

const PRICE_COLUMNS = "search, price, store, product_name, image_url, checked_at";

// A price this recent is reused instead of asking Kassalapp again.
const FRESH_FOR_MS = 6 * 60 * 60 * 1000;

async function savePrice(search, cheapest) {
  const row = {
    search,
    price: cheapest?.price ?? null,
    store: cheapest?.store ?? null,
    product_name: cheapest?.product_name ?? null,
    image_url: cheapest?.image_url ?? null,
    checked_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("price_cache").upsert(row, { onConflict: "search" });
  if (error) throw error;
  return row;
}

// Price for one search right now: the cached row if it's fresh, otherwise one Kassalapp lookup.
// Never throws: a failed lookup returns whatever is cached (or null) so saving an item still works.
async function priceForSearch(search) {
  const { data: cached, error } = await supabase
    .from("price_cache")
    .select(PRICE_COLUMNS)
    .eq("search", search)
    .maybeSingle();
  if (error) throw error;

  if (cached && Date.now() - new Date(cached.checked_at).getTime() < FRESH_FOR_MS) return cached;

  try {
    return await savePrice(search, await findCheapest(search));
  } catch (err) {
    const status = err.response ? `HTTP ${err.response.status}` : err.message;
    console.error(`Instant price check failed for "${search}": ${status}`);
    return cached;
  }
}

module.exports = { PRICE_COLUMNS, savePrice, priceForSearch };

const axios = require("axios");

// axios client for the Kassalapp grocery price API.
// Created on first use, so the web service never needs the API key.
let client = null;

function getClient() {
  if (client) return client;
  if (!process.env.KASSALAPP_API_KEY) {
    throw new Error("KASSALAPP_API_KEY must be set");
  }
  client = axios.create({
    baseURL: "https://kassal.app/api/v1",
    headers: { Authorization: `Bearer ${process.env.KASSALAPP_API_KEY}` },
    timeout: 20_000,
  });
  return client;
}

// A product matches if its name contains every search word (case-insensitive).
// "tine lettmelk" matches "TINE Lettmelk 0,5% 1l" but not "Q Lettmelk 1l".
function matchesAllWords(productName, search) {
  const name = productName.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word));
}

// Returns the cheapest matching product as { price, store, product_name, url },
// or null when nothing matches. Throws if the API call fails.
async function findCheapest(search) {
  const response = await getClient().get("/products", {
    // price_min skips products without a price. Without it, price_asc
    // sorts those (null) first and all 50 results can be priceless.
    params: { search, size: 50, sort: "price_asc", price_min: 0.01 },
  });

  let cheapest = null;
  for (const product of response.data.data || []) {
    const price = product.current_price;
    if (typeof price !== "number" || !product.name) continue;
    if (!matchesAllWords(product.name, search)) continue;
    if (!cheapest || price < cheapest.price) {
      cheapest = {
        price,
        store: product.store?.name ?? null,
        product_name: product.name,
        url: product.url ?? null,
      };
    }
  }
  return cheapest;
}

module.exports = { findCheapest, matchesAllWords };

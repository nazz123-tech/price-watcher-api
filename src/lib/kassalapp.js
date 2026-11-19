const axios = require("axios");

let client = null;

// Online-only stores: nobody can pop in and buy there, so their prices are skipped.
const EXCLUDED_STORES = new Set(["ODA_NO", "HOLDBART", "HAVARISTEN", "ENGROSSNETT_NO", "FASTCANDY"]);

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

function matchesAllWords(productName, search) {
  const name = productName.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word));
}

async function findCheapest(search) {
  const response = await getClient().get("/products", {
    params: { search, size: 50, sort: "price_asc", price_min: 0.01 },
  });

  let cheapest = null;
  for (const product of response.data.data || []) {
    const price = product.current_price;
    if (typeof price !== "number" || !product.name) continue;
    if (!matchesAllWords(product.name, search)) continue;
    if (EXCLUDED_STORES.has(product.store?.code)) continue;
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

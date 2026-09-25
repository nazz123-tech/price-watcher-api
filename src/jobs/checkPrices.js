// The daily price check. Runs once as a Render Cron Job, then exits.
//
//   npm run check-prices                -> check prices and send emails
//   npm run check-prices -- --dry-run   -> check prices, print emails, send nothing
//
// Steps (see CLAUDE.md section 6):
//   1. Load all watch_items.
//   2. Check each unique search once on Kassalapp and save it in price_cache.
//   3. Group each user's deals (price <= target_price).
//   4. Send each user with deals one email, unless their alerts are off.
const config = require("../config");
const supabase = require("../lib/supabase");
const { findCheapest } = require("../lib/kassalapp");
const { isEmailConfigured, sendEmail } = require("../lib/mailer");
const { buildDealsEmail } = require("../lib/emailTemplate");

const DELAY_BETWEEN_CALLS_MS = 1000; // be nice to Kassalapp's rate limit
const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function errorMessage(err) {
  // axios errors carry the HTTP status, which says the most (401, 429, 500…).
  if (err.response) return `HTTP ${err.response.status} ${JSON.stringify(err.response.data).slice(0, 200)}`;
  return err.message;
}

// Loads every row of a table, one page at a time.
async function loadAll(table, columns, filter = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await filter(supabase.from(table).select(columns)).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Step 2: returns a Map of search -> price info (or null when nothing matched)
// for the searches that were checked successfully today.
async function checkSearches(searches, failures) {
  const prices = new Map();

  for (const [index, search] of searches.entries()) {
    if (index > 0) await sleep(DELAY_BETWEEN_CALLS_MS);
    try {
      const cheapest = await findCheapest(search);
      prices.set(search, cheapest);

      // No match today: save price null, so the app doesn't show an old price.
      const { error } = await supabase.from("price_cache").upsert(
        {
          search,
          price: cheapest?.price ?? null,
          store: cheapest?.store ?? null,
          product_name: cheapest?.product_name ?? null,
          checked_at: new Date().toISOString(),
        },
        { onConflict: "search" }
      );
      if (error) throw error;

      console.log(`  ${search}: ${cheapest ? `${cheapest.price} kr at ${cheapest.store}` : "no match"}`);
    } catch (err) {
      // Log and keep going. This search is left out of today's deals.
      failures.push({ search, error: errorMessage(err) });
      console.error(`  ${search}: FAILED ${errorMessage(err)}`);
    }
  }
  return prices;
}

// Step 3: returns a Map of userId -> [deal, deal, …].
function groupDealsByUser(items, prices) {
  const dealsByUser = new Map();
  for (const item of items) {
    const found = prices.get(item.search);
    // Only fresh prices from today's check count, never old cached ones.
    if (!found || found.price > Number(item.target_price)) continue;

    if (!dealsByUser.has(item.user_id)) dealsByUser.set(item.user_id, []);
    dealsByUser.get(item.user_id).push({
      name: item.name,
      price: found.price,
      store: found.store,
      target_price: Number(item.target_price),
    });
  }
  return dealsByUser;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Fail fast if the job-only variables are missing.
  if (!process.env.KASSALAPP_API_KEY) throw new Error("KASSALAPP_API_KEY must be set");
  if (!dryRun && !isEmailConfigured()) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set");

  console.log(`Price check started${dryRun ? " (dry run, no emails)" : ""}`);
  const failures = [];

  // 1. Load all watched items.
  const items = await loadAll("watch_items", "user_id, name, search, target_price");

  // 2. Check each unique search once, even if many users watch it.
  const searches = [...new Set(items.map((item) => item.search))];
  console.log(`Checking ${searches.length} unique searches for ${items.length} items`);
  const prices = await checkSearches(searches, failures);

  // 3. Group deals per user, so each user gets at most one email.
  const dealsByUser = groupDealsByUser(items, prices);

  // Users who turned alerts off (no row means alerts are on).
  const alertsOff = new Set(
    (await loadAll("user_settings", "user_id", (query) => query.eq("email_alerts", false))).map(
      (row) => row.user_id
    )
  );

  // 4. Email each user their deals.
  let sent = 0;
  let skipped = 0;
  for (const [userId, deals] of dealsByUser) {
    try {
      if (alertsOff.has(userId)) {
        skipped++;
        continue;
      }

      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) throw error;
      const { email, user_metadata: metadata } = data.user;
      if (!email) {
        skipped++;
        continue;
      }

      const message = buildDealsEmail({
        firstName: metadata?.first_name,
        deals,
        frontendUrl: config.frontendUrl,
      });

      if (dryRun) {
        console.log(`\n--- Would send to ${email} ---\nSubject: ${message.subject}\n\n${message.text}\n`);
      } else {
        await sendEmail({ to: email, ...message });
        console.log(`  Sent ${deals.length} deal(s) to ${email}`);
      }
      sent++;
    } catch (err) {
      // Log and keep going with the next user.
      failures.push({ userId, error: errorMessage(err) });
      console.error(`  Email to user ${userId} FAILED: ${errorMessage(err)}`);
    }
  }

  const summary = {
    checked: searches.length, // unique searches looked up on Kassalapp
    recipients: dealsByUser.size, // users with at least one deal
    sent,
    skipped, // users with deals but alerts off (or no email address)
    failures: failures.length,
  };
  console.log("Summary:", JSON.stringify(summary));
  if (failures.length > 0) console.log("Failures:", JSON.stringify(failures, null, 2));

  // A failed email makes the run show as failed on Render, so we notice.
  return failures.some((failure) => failure.userId) ? 1 : 0;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((err) => {
    console.error("Price check crashed:", errorMessage(err));
    process.exit(1);
  });

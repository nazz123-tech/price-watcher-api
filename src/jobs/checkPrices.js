const config = require("../config");
const supabase = require("../lib/supabase");
const { findCheapest } = require("../lib/kassalapp");
const { savePrice } = require("../lib/priceCache");
const { isEmailConfigured, sendEmail } = require("../lib/mailer");
const { buildDealsEmail } = require("../lib/emailTemplate");

const DELAY_BETWEEN_CALLS_MS = 1000;
const PAGE_SIZE = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function maskEmails(text) {
  return String(text).replace(/([\w.+-]{1,2})[\w.+-]*@([\w-]+(\.[\w-]+)+)/g, "$1***@$2");
}

function shortId(userId) {
  return String(userId).slice(0, 8);
}

function errorMessage(err) {
  if (err.response) return `HTTP ${err.response.status} ${JSON.stringify(err.response.data).slice(0, 200)}`;
  return maskEmails(err.message);
}

async function loadAll(table, columns, filter = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await filter(supabase.from(table).select(columns)).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function checkSearches(searches, failures) {
  const prices = new Map();

  for (const [index, search] of searches.entries()) {
    if (index > 0) await sleep(DELAY_BETWEEN_CALLS_MS);
    try {
      const cheapest = await findCheapest(search);
      prices.set(search, cheapest);
      await savePrice(search, cheapest);

      console.log(`  ${search}: ${cheapest ? `${cheapest.price} kr at ${cheapest.store}` : "no match"}`);
    } catch (err) {
      failures.push({ search, error: errorMessage(err) });
      console.error(`  ${search}: FAILED ${errorMessage(err)}`);
    }
  }
  return prices;
}

function groupDealsByUser(items, prices) {
  const dealsByUser = new Map();
  for (const item of items) {
    const found = prices.get(item.search);
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

  if (!process.env.KASSALAPP_API_KEY) throw new Error("KASSALAPP_API_KEY must be set");
  if (!dryRun && !isEmailConfigured()) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set");

  console.log(`Price check started${dryRun ? " (dry run, no emails)" : ""}`);
  const failures = [];

  const items = await loadAll("watch_items", "user_id, name, search, target_price");

  const searches = [...new Set(items.map((item) => item.search))];
  console.log(`Checking ${searches.length} unique searches for ${items.length} items`);
  const prices = await checkSearches(searches, failures);

  const dealsByUser = groupDealsByUser(items, prices);

  const alertsOff = new Set(
    (await loadAll("user_settings", "user_id", (query) => query.eq("email_alerts", false))).map(
      (row) => row.user_id
    )
  );

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
        console.log(`\n--- Would send to ${maskEmails(email)} ---\nSubject: ${message.subject}\n\n${message.text}\n`);
      } else {
        await sendEmail({ to: email, ...message });
        console.log(`  Sent ${deals.length} deal(s) to ${maskEmails(email)}`);
      }
      sent++;
    } catch (err) {
      failures.push({ userId: shortId(userId), error: errorMessage(err) });
      console.error(`  Email to user ${shortId(userId)} FAILED: ${errorMessage(err)}`);
    }
  }

  const summary = {
    checked: searches.length,
    recipients: dealsByUser.size,
    sent,
    skipped,
    failures: failures.length,
  };
  console.log("Summary:", JSON.stringify(summary));
  if (failures.length > 0) console.log("Failures:", JSON.stringify(failures, null, 2));

  return failures.some((failure) => failure.userId) ? 1 : 0;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((err) => {
    console.error("Price check crashed:", errorMessage(err));
    process.exit(1);
  });

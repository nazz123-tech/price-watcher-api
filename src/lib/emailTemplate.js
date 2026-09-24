// Builds the daily deals email: { subject, text, html }.
// Kept plain and transactional (real subject, text part, no images,
// no tracking) so it lands in the inbox and not in spam.

// Makes user-provided text safe to put inside HTML.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 25 -> "25 kr", 22.9 -> "22.90 kr"
function formatPrice(value) {
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(2)} kr`;
}

// "Milk: 22.90 kr at REMA 1000 (your target: 25 kr)"
function dealLine(deal) {
  const store = deal.store ? ` at ${deal.store}` : "";
  return `${deal.name}: ${formatPrice(deal.price)}${store} (your target: ${formatPrice(deal.target_price)})`;
}

/**
 * @param {object} options
 * @param {string} [options.firstName]  greet by name if known
 * @param {Array<{name, price, store, target_price}>} options.deals  at least one
 * @param {string} options.frontendUrl  e.g. https://price-watcher.vercel.app
 */
function buildDealsEmail({ firstName, deals, frontendUrl }) {
  // Trim a trailing slash so links don't become "//groceries".
  const baseUrl = frontendUrl.replace(/\/+$/, "");
  const listUrl = `${baseUrl}/groceries`;
  const settingsUrl = `${baseUrl}/settings`;

  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  let subject;
  let intro;
  if (deals.length === 1) {
    const deal = deals[0];
    const store = deal.store ? ` at ${deal.store}` : "";
    subject = `Deal: ${deal.name} ${formatPrice(deal.price)}${store}`;
    intro = "You have 1 grocery deal today:";
  } else {
    subject = `${deals.length} grocery deals today`;
    intro = `You have ${deals.length} grocery deals today:`;
  }
  // Subjects must be one line, even if a name somehow contains a newline.
  subject = subject.replace(/\s+/g, " ").trim();

  const footer =
    "You're receiving this because price alerts are on for your Price Watcher account.\n" +
    `Turn them off any time in ${settingsUrl}.`;

  const text = [
    greeting,
    "",
    intro,
    "",
    ...deals.map((deal) => `- ${dealLine(deal)}`),
    "",
    `Open your list: ${listUrl}`,
    "",
    footer,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n"); // collapse double blank lines

  const html = `<!doctype html>
<html>
  <body>
    <p>${escapeHtml(greeting)}</p>
    <p>${escapeHtml(intro)}</p>
    <ul>
${deals.map((deal) => `      <li>${escapeHtml(dealLine(deal))}</li>`).join("\n")}
    </ul>
    <p>Open your list: <a href="${escapeHtml(listUrl)}">${escapeHtml(listUrl)}</a></p>
    <p>
      You're receiving this because price alerts are on for your Price Watcher account.<br>
      Turn them off any time in <a href="${escapeHtml(settingsUrl)}">${escapeHtml(settingsUrl)}</a>.
    </p>
  </body>
</html>
`;

  return { subject, text, html };
}

module.exports = { buildDealsEmail, escapeHtml };

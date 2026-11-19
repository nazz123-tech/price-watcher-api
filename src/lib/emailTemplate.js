function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrice(value) {
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(2)} kr`;
}

function dealLine(deal) {
  const store = deal.store ? ` at ${deal.store}` : "";
  return `${deal.name}: ${formatPrice(deal.price)}${store} (your target: ${formatPrice(deal.target_price)})`;
}

function buildDealsEmail({ firstName, deals, frontendUrl }) {
  const baseUrl = frontendUrl.replace(/\/+$/, "");
  const listUrl = `${baseUrl}/groceries`;
  const settingsUrl = `${baseUrl}/settings`;

  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  let subject;
  let intro;
  if (deals.length === 1) {
    const deal = deals[0];
    const store = deal.store ? ` at ${deal.store}` : "";
    subject = `Price alert: ${deal.name} is ${formatPrice(deal.price)}${store}`;
    intro = "1 grocery hit your target price today:";
  } else {
    subject = `Price alert: ${deals.length} groceries hit your target`;
    intro = `${deals.length} groceries hit your target price today:`;
  }
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
    .replace(/\n{3,}/g, "\n\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
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

  return { subject, text, html, unsubscribeUrl: settingsUrl };
}

module.exports = { buildDealsEmail, escapeHtml };

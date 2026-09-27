// Sends one example deals email, to check that Gmail sending works.
//
//   npm run test-email                          -> sends to GMAIL_USER (yourself)
//   npm run test-email -- someone@mail.no       -> sends to that address
//   npm run test-email -- --dry-run             -> only prints the email, sends nothing
//   npm run test-email -- --url=https://x.app   -> use this app address in the links
//
// Links use FRONTEND_URL from .env. Locally that's http://localhost:3000, which
// looks like spam to mail providers (and doesn't work for the recipient), so when
// testing with other people, pass your Vercel address with --url.
//
// Run this on your computer, not on the Render web service (SMTP is blocked there).
require("dotenv").config({ quiet: true });
const { buildDealsEmail } = require("../src/lib/emailTemplate");
const { isEmailConfigured, sendEmail } = require("../src/lib/mailer");

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const urlArg = args.find((arg) => arg.startsWith("--url="));
  const to = args.find((arg) => !arg.startsWith("--")) || process.env.GMAIL_USER;
  const frontendUrl = urlArg ? urlArg.slice("--url=".length) : process.env.FRONTEND_URL || "http://localhost:3000";

  if (/localhost|127\.0\.0\.1/.test(frontendUrl)) {
    console.warn(
      `Warning: links point to ${frontendUrl}. Mail providers often mark that as spam.\n` +
        "         Add --url=https://<your-app>.vercel.app when sending to other people.\n"
    );
  }

  // Realistic example, like a real morning email.
  const email = buildDealsEmail({
    frontendUrl,
    deals: [
      { name: "Milk", price: 22.9, store: "REMA 1000", target_price: 25 },
      { name: "Grandiosa", price: 52.9, store: "KIWI", target_price: 55 },
    ],
  });

  if (dryRun) {
    console.log(`Subject: ${email.subject}\nList-Unsubscribe: ${email.unsubscribeUrl}\n\n${email.text}\n\n--- HTML ---\n${email.html}`);
    return;
  }
  if (!isEmailConfigured()) {
    throw new Error("Set GMAIL_USER and GMAIL_APP_PASSWORD in .env first");
  }

  await sendEmail({ to, ...email });
  console.log(`Sent "${email.subject}" to ${to}`);
}

main().catch((err) => {
  console.error("Sending failed:", err.message);
  process.exit(1);
});

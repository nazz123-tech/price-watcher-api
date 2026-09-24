// Sends one example deals email, to check that Gmail sending works.
//
//   npm run test-email                     -> sends to GMAIL_USER (yourself)
//   npm run test-email -- someone@mail.no  -> sends to that address
//   npm run test-email -- --dry-run        -> only prints the email, sends nothing
//
// Run this on your computer, not on the Render web service (SMTP is blocked there).
require("dotenv").config({ quiet: true });
const { buildDealsEmail } = require("../src/lib/emailTemplate");
const { isEmailConfigured, sendEmail } = require("../src/lib/mailer");

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const to = args.find((arg) => !arg.startsWith("--")) || process.env.GMAIL_USER;

  const email = buildDealsEmail({
    firstName: "Test",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    deals: [
      { name: "Milk", price: 22.9, store: "REMA 1000", target_price: 25 },
      { name: "Grandiosa <Original>", price: 52.9, store: "Kiwi", target_price: 55 },
    ],
  });

  if (dryRun) {
    console.log(`Subject: ${email.subject}\n\n${email.text}\n\n--- HTML ---\n${email.html}`);
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

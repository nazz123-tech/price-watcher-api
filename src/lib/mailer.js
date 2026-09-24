const nodemailer = require("nodemailer");

let transport = null;

function isEmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransport() {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      // App passwords are shown in groups of four; strip the spaces.
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ""),
    },
  });
  return transport;
}

async function sendEmail({ to, subject, text, html }) {
  if (!isEmailConfigured()) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set");
  }
  // Gmail always sends from GMAIL_USER, so REMINDER_FROM only sets the display name.
  const from = process.env.REMINDER_FROM || `Price Watcher <${process.env.GMAIL_USER}>`;
  await getTransport().sendMail({ from, to, subject, text, html });
}

module.exports = { isEmailConfigured, sendEmail };

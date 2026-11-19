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
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ""),
    },
  });
  return transport;
}

async function sendEmail({ to, subject, text, html, unsubscribeUrl }) {
  if (!isEmailConfigured()) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set");
  }
  const from = process.env.REMINDER_FROM || `Price Watcher <${process.env.GMAIL_USER}>`;

  const headers = unsubscribeUrl
    ? { "List-Unsubscribe": `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>, <${unsubscribeUrl}>` }
    : undefined;

  await getTransport().sendMail({ from, to, subject, text, html, headers });
}

module.exports = { isEmailConfigured, sendEmail };

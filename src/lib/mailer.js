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

async function sendEmail({ to, subject, text, html, unsubscribeUrl }) {
  if (!isEmailConfigured()) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set");
  }
  // Gmail always sends from GMAIL_USER, so REMINDER_FROM only sets the display name.
  const from = process.env.REMINDER_FROM || `Price Watcher <${process.env.GMAIL_USER}>`;

  // A List-Unsubscribe header makes Gmail/Outlook show an "Unsubscribe" button.
  // Mail providers trust senders that offer one; without it, people tend to press "Spam" instead.
  // The mailto: lands in our own inbox; the link opens Settings, where alerts can be turned off.
  const headers = unsubscribeUrl
    ? { "List-Unsubscribe": `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>, <${unsubscribeUrl}>` }
    : undefined;

  await getTransport().sendMail({ from, to, subject, text, html, headers });
}

module.exports = { isEmailConfigured, sendEmail };

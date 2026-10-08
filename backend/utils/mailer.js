// utils/mailer.js
// Sends a notification email to the business owner whenever a new
// contact form message arrives. If email env vars aren't set, it just
// logs to the console instead of crashing (so the site still works
// even before you configure email).

const nodemailer = require("nodemailer");

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function notifyNewContact(contact) {
  const transporter = getTransporter();
  const subject = `New enquiry from ${contact.name}`;
  const text = `
New contact form submission:

Name: ${contact.name}
Email: ${contact.email}
Phone: ${contact.phone}
Interested in: ${contact.bhk_interest || "Not specified"}
Budget: ${contact.budget === null || contact.budget === undefined ? "Not specified" : `${contact.budget} Lakh`}
Message: ${contact.message || "(no message)"}
`;

  if (!transporter) {
    console.log("[mailer] Email not configured. Would have sent:\n", text);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFY_EMAIL || process.env.EMAIL_USER,
      subject,
      text,
    });
  } catch (err) {
    console.error("[mailer] Failed to send notification email:", err.message);
  }
}

async function sendReplyEmail(toEmail, toName, replyMessage) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[mailer] Would reply to ${toEmail}: ${replyMessage}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: "Re: Your enquiry",
      text: `Hi ${toName},\n\n${replyMessage}\n\nThank you.`,
    });
  } catch (err) {
    console.error("[mailer] Failed to send reply email:", err.message);
  }
}

module.exports = { notifyNewContact, sendReplyEmail };

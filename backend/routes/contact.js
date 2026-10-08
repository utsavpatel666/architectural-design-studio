const express = require("express");
const db = require("../db/db");
const { notifyNewContact } = require("../utils/mailer");

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9+\-\s()]{7,15}$/.test(phone);
}

router.post("/", async (req, res, next) => {
  const { name, email, phone, message, budget, bhk_interest: bhkInterest } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Name, email, and phone are required." });
  }
  if (name.trim().length < 2 || name.length > 100) {
    return res.status(400).json({ error: "Please enter a valid name." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: "Please enter a valid phone number." });
  }
  if (message && message.length > 1000) {
    return res.status(400).json({ error: "Message is too long (max 1000 characters)." });
  }
  if (budget !== undefined && budget !== "" && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) {
    return res.status(400).json({ error: "Please enter a valid budget." });
  }

  const userId = req.user ? req.user.id : null;

  try {
    const insertResult = await db.query(
      `INSERT INTO contacts (user_id, name, email, phone, bhk_interest, budget, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        name.trim(),
        email.trim(),
        phone.trim(),
        bhkInterest || null,
        budget === undefined || budget === "" ? null : Number(budget),
        message ? message.trim() : null,
      ]
    );

    const contact = insertResult.rows[0];
    notifyNewContact(contact).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Thank you! We'll get back to you soon.",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

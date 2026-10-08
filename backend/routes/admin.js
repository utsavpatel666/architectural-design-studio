const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db/db");
const adminAuth = require("../middleware/adminAuth");
const { sendReplyEmail } = require("../utils/mailer");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const validUsername = username === process.env.ADMIN_USERNAME;
  const validPassword = password === process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = jwt.sign({ role: "admin", username }, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });

  return res.json({ token });
});

router.get("/stats", adminAuth, async (req, res, next) => {
  try {
    const [
      totalVisitors,
      totalPageViews,
      totalMessages,
      newMessages,
      totalGalleryItems,
      totalTeamMembers,
    ] = await Promise.all([
      db.query("SELECT COUNT(DISTINCT ip_hash) AS c FROM visits"),
      db.query("SELECT COUNT(*) AS c FROM visits"),
      db.query("SELECT COUNT(*) AS c FROM contacts"),
      db.query("SELECT COUNT(*) AS c FROM contacts WHERE status = 'new'"),
      db.query("SELECT COUNT(*) AS c FROM gallery"),
      db.query("SELECT COUNT(*) AS c FROM team_members"),
    ]);

    res.json({
      totalVisitors: Number(totalVisitors.rows[0].c),
      totalPageViews: Number(totalPageViews.rows[0].c),
      totalMessages: Number(totalMessages.rows[0].c),
      newMessages: Number(newMessages.rows[0].c),
      totalGalleryItems: Number(totalGalleryItems.rows[0].c),
      totalTeamMembers: Number(totalTeamMembers.rows[0].c),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/messages", adminAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM contacts ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/messages/:id/reply", adminAuth, async (req, res, next) => {
  const { reply } = req.body;
  if (!reply) {
    return res.status(400).json({ error: "Reply message is required." });
  }

  try {
    const contactResult = await db.query(
      "SELECT * FROM contacts WHERE id = $1",
      [req.params.id]
    );
    const contact = contactResult.rows[0];

    if (!contact) {
      return res.status(404).json({ error: "Message not found." });
    }

    await db.query(
      `UPDATE contacts
       SET admin_reply = $1,
           status = 'replied',
           replied_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reply, req.params.id]
    );

    await sendReplyEmail(contact.email, contact.name, reply);

    const whatsappLink = `https://wa.me/${String(contact.phone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(reply)}`;
    res.json({ success: true, whatsappLink });
  } catch (error) {
    next(error);
  }
});

router.put("/messages/:id/status", adminAuth, async (req, res, next) => {
  const { status } = req.body;
  if (!["new", "replied", "closed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  try {
    await db.query("UPDATE contacts SET status = $1 WHERE id = $2", [
      status,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require("express");
const db = require("../db/db");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

router.get("/", async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    const result = await db.query("SELECT key, value FROM settings");
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.put("/", adminAuth, async (req, res, next) => {
  const updates = req.body;
  const entries = Object.entries(updates || {});

  try {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      for (const [key, value] of entries) {
        await client.query(
          `INSERT INTO settings (key, value)
           VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, String(value)]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const result = await db.query("SELECT key, value FROM settings");
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require("express");
const db = require("../db/db");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM faqs ORDER BY sort_order ASC, id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", adminAuth, async (req, res, next) => {
  const { question, answer, sort_order: sortOrder } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: "Question and answer are required." });
  }

  try {
    const result = await db.query(
      `INSERT INTO faqs (question, answer, sort_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [question.trim(), answer.trim(), Number(sortOrder) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", adminAuth, async (req, res, next) => {
  const { question, answer, sort_order: sortOrder } = req.body;

  try {
    const existingResult = await db.query(
      "SELECT * FROM faqs WHERE id = $1",
      [req.params.id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({ error: "FAQ not found." });
    }

    const result = await db.query(
      `UPDATE faqs
       SET question = $1,
           answer = $2,
           sort_order = $3
       WHERE id = $4
       RETURNING *`,
      [
        question ?? existing.question,
        answer ?? existing.answer,
        sortOrder ?? existing.sort_order,
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", adminAuth, async (req, res, next) => {
  try {
    await db.query("DELETE FROM faqs WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

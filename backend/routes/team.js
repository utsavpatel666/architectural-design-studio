const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db/db");
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/upload");

const router = express.Router();
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function removeStoredFile(filePath) {
  if (!filePath || !filePath.startsWith("/uploads/")) {
    return;
  }
  const fullPath = path.join(__dirname, "..", "uploads", path.basename(filePath));
  fs.unlink(fullPath, () => {});
}

function removeUploadedFile(file) {
  if (file?.path) {
    fs.unlink(file.path, () => {});
  }
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSortOrder(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

router.get("/", async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM team_members ORDER BY sort_order ASC, id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", adminAuth, upload.single("photo"), async (req, res, next) => {
  const name = cleanText(req.body.name);
  const role = cleanText(req.body.role);
  const bio = cleanText(req.body.bio);
  const focus = cleanText(req.body.focus);

  if (!req.file) {
    return res.status(400).json({ error: "A member photo is required." });
  }

  if (!imageExtensions.has(path.extname(req.file.filename).toLowerCase())) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error: "Member photos must be JPG, PNG, or WebP images." });
  }

  if (!name || !role || !bio) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error: "Name, role, and biography are required." });
  }

  try {
    const result = await db.query(
      `INSERT INTO team_members (name, role, photo_path, bio, focus, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.slice(0, 100),
        role.slice(0, 120),
        `/uploads/${req.file.filename}`,
        bio.slice(0, 1200),
        focus.slice(0, 180) || null,
        parseSortOrder(req.body.sort_order),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", adminAuth, upload.single("photo"), async (req, res, next) => {
  try {
    const existingResult = await db.query(
      "SELECT * FROM team_members WHERE id = $1",
      [req.params.id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      removeUploadedFile(req.file);
      return res.status(404).json({ error: "Team member not found." });
    }

    if (req.file && !imageExtensions.has(path.extname(req.file.filename).toLowerCase())) {
      removeUploadedFile(req.file);
      return res.status(400).json({ error: "Member photos must be JPG, PNG, or WebP images." });
    }

    const name = cleanText(req.body.name);
    const role = cleanText(req.body.role);
    const bio = cleanText(req.body.bio);
    const focus = cleanText(req.body.focus);

    if (!name || !role || !bio) {
      removeUploadedFile(req.file);
      return res.status(400).json({ error: "Name, role, and biography are required." });
    }

    const photoPath = req.file ? `/uploads/${req.file.filename}` : existing.photo_path;
    const result = await db.query(
      `UPDATE team_members
       SET name = $1,
           role = $2,
           photo_path = $3,
           bio = $4,
           focus = $5,
           sort_order = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        name.slice(0, 100),
        role.slice(0, 120),
        photoPath,
        bio.slice(0, 1200),
        focus.slice(0, 180) || null,
        parseSortOrder(req.body.sort_order, existing.sort_order),
        req.params.id,
      ]
    );

    if (req.file && existing.photo_path !== photoPath) {
      removeStoredFile(existing.photo_path);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", adminAuth, async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM team_members WHERE id = $1", [
      req.params.id,
    ]);
    const member = result.rows[0];

    if (!member) {
      return res.status(404).json({ error: "Team member not found." });
    }

    await db.query("DELETE FROM team_members WHERE id = $1", [req.params.id]);
    removeStoredFile(member.photo_path);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

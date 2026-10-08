const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db/db");
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/upload");

const router = express.Router();

function inferMediaType(filePath) {
  if (!filePath) return "image";
  const ext = path.extname(filePath).toLowerCase();
  return [".mp4", ".mov", ".webm"].includes(ext) ? "video" : "image";
}

function normalizeItem(row) {
  let rowMedia = row.media;
  if (typeof rowMedia === "string") {
    try {
      rowMedia = JSON.parse(rowMedia);
    } catch {
      rowMedia = [];
    }
  }

  const legacyMedia = row.file_path
    ? [{ type: row.media_type || inferMediaType(row.file_path), file_path: row.file_path, is_cover: true }]
    : [];

  const media = Array.isArray(rowMedia) && rowMedia.length
    ? rowMedia.map((entry) => ({
        type: entry && entry.type ? entry.type : inferMediaType(entry && entry.file_path ? entry.file_path : ""),
        file_path: entry && entry.file_path ? entry.file_path : "",
        is_cover: Boolean(entry && entry.is_cover),
      }))
    : legacyMedia;

  const safeMedia = media.filter((entry) => entry && entry.file_path);
  const flaggedCoverIndex = safeMedia.findIndex((entry) => entry.is_cover === true);
  const storedCoverIndex = Number(row.cover_index);
  const coverIndex = flaggedCoverIndex >= 0
    ? flaggedCoverIndex
    : Number.isInteger(storedCoverIndex)
      ? storedCoverIndex
      : 0;

  const normalizedMedia = safeMedia.length
    ? safeMedia.map((entry, index) => ({
        ...entry,
        type: entry.type || inferMediaType(entry.file_path),
        is_cover: index === (coverIndex >= 0 && coverIndex < safeMedia.length ? coverIndex : 0),
      }))
    : [];

  const displayIn = ["portfolio", "gallery3d"].includes(String(row.display_in || "").toLowerCase())
    ? String(row.display_in).toLowerCase()
    : "both";

  return {
    ...row,
    media: normalizedMedia,
    display_in: displayIn,
    cover_index: normalizedMedia.length ? normalizedMedia.findIndex((entry) => entry.is_cover) : 0,
    cover_explicit: Boolean(row.cover_explicit),
    media_type: normalizedMedia[0] ? normalizedMedia[0].type : row.media_type || "image",
    file_path: normalizedMedia[0] ? normalizedMedia[0].file_path : row.file_path || "",
    title: row.title || "Untitled project",
    description: row.description || "",
  };
}

router.get("/", async (req, res, next) => {
  const { bhk } = req.query;

  try {
    const result = bhk
      ? await db.query(
          "SELECT * FROM gallery WHERE bhk_type = $1 ORDER BY sort_order ASC, id DESC",
          [bhk]
        )
      : await db.query(
          "SELECT * FROM gallery ORDER BY sort_order ASC, id DESC"
        );

    res.json(result.rows.map(normalizeItem));
  } catch (error) {
    next(error);
  }
});

router.get("/types", async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT DISTINCT bhk_type FROM gallery ORDER BY bhk_type ASC"
    );
    res.json(result.rows.map((row) => row.bhk_type));
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  adminAuth,
  upload.fields([
    { name: "files", maxCount: 20 },
    { name: "file", maxCount: 20 },
  ]),
  async (req, res, next) => {
  const { title, bhk_type: bhkType, description, sort_order: sortOrder, display_in: displayIn } = req.body;
  const requestedCoverIndex = Number(req.body.cover_index);
  const coverExplicit = String(req.body.cover_explicit).toLowerCase() === "true";
  const uploadedFiles = req.files && !Array.isArray(req.files)
    ? [...(req.files.files || []), ...(req.files.file || [])]
    : Array.isArray(req.files) && req.files.length
      ? req.files
      : req.file
        ? [req.file]
        : [];

  if (!uploadedFiles.length) {
    return res.status(400).json({ error: "At least one image or video is required." });
  }
  if (!title || !bhkType) {
    return res.status(400).json({ error: "Title and BHK type are required." });
  }

  try {
    const safeCoverIndex = Number.isInteger(requestedCoverIndex) && requestedCoverIndex >= 0 && requestedCoverIndex < uploadedFiles.length
      ? requestedCoverIndex
      : 0;
    const media = uploadedFiles.map((file, index) => ({
      type: [".mp4", ".mov", ".webm"].includes(path.extname(file.originalname || file.filename).toLowerCase()) ? "video" : "image",
      file_path: `/uploads/${file.filename}`,
      is_cover: index === safeCoverIndex,
    }));

    const normalizedDisplayIn = ["portfolio", "gallery3d"].includes(String(displayIn || "").toLowerCase())
      ? String(displayIn).toLowerCase()
      : "both";

    const result = await db.query(
      `INSERT INTO gallery (title, bhk_type, media_type, file_path, description, sort_order, display_in, cover_index, cover_explicit, media)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        title.trim(),
        bhkType.trim(),
        media[0].type,
        media[0].file_path,
        description || null,
        Number(sortOrder) || 0,
        normalizedDisplayIn,
        safeCoverIndex,
        coverExplicit,
        JSON.stringify(media),
      ]
    );

    res.status(201).json(normalizeItem(result.rows[0]));
  } catch (error) {
    next(error);
  }
  }
);

router.put("/:id/cover", adminAuth, async (req, res, next) => {
  const { index } = req.body;
  const coverIndex = Number(index);

  try {
    const result = await db.query("SELECT * FROM gallery WHERE id = $1", [req.params.id]);
    const item = result.rows[0];
    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }

    const parsedMedia = typeof item.media === "string"
      ? JSON.parse(item.media || "[]")
      : Array.isArray(item.media) ? item.media : [];
    const media = parsedMedia.length
      ? parsedMedia
      : item.file_path
        ? [{ type: item.media_type || inferMediaType(item.file_path), file_path: item.file_path, is_cover: true }]
        : [];
    if (!media.length || Number.isNaN(coverIndex) || coverIndex < 0 || coverIndex >= media.length) {
      return res.status(400).json({ error: "Invalid cover item index." });
    }

    const updatedMedia = media.map((entry, idx) => ({ ...entry, is_cover: idx === coverIndex }));
    const updated = await db.query(
      `UPDATE gallery
       SET cover_index = $1,
           cover_explicit = TRUE,
           media = $2,
           file_path = $3,
           media_type = $4
       WHERE id = $5
       RETURNING *`,
      [coverIndex, JSON.stringify(updatedMedia), updatedMedia[coverIndex].file_path, updatedMedia[coverIndex].type, req.params.id]
    );

    res.json(normalizeItem(updated.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/media", adminAuth, upload.fields([
  { name: "files", maxCount: 20 },
  { name: "file", maxCount: 20 },
]), async (req, res, next) => {
  const uploadedFiles = req.files && !Array.isArray(req.files)
    ? [...(req.files.files || []), ...(req.files.file || [])]
    : [];
  if (!uploadedFiles.length) {
    return res.status(400).json({ error: "At least one image or video is required." });
  }

  try {
    const result = await db.query("SELECT * FROM gallery WHERE id = $1", [req.params.id]);
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: "Item not found." });

    const existingMedia = typeof item.media === "string"
      ? JSON.parse(item.media || "[]")
      : Array.isArray(item.media) ? item.media : [];
    const appendedMedia = uploadedFiles.map((file) => ({
      type: [".mp4", ".mov", ".webm"].includes(path.extname(file.originalname || file.filename).toLowerCase()) ? "video" : "image",
      file_path: `/uploads/${file.filename}`,
      is_cover: false,
    }));
    const media = existingMedia.length ? [...existingMedia, ...appendedMedia] : appendedMedia;
    const coverIndex = item.cover_explicit ? Number(item.cover_index || 0) : 0;
    media.forEach((entry, index) => { entry.is_cover = index === coverIndex; });

    const updated = await db.query(
      `UPDATE gallery
       SET media = $1, cover_index = $2, file_path = $3, media_type = $4
       WHERE id = $5 RETURNING *`,
      [JSON.stringify(media), coverIndex, media[coverIndex].file_path, media[coverIndex].type, req.params.id]
    );
    res.status(201).json(normalizeItem(updated.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put("/:id/media/order", adminAuth, async (req, res, next) => {
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number) : [];
  try {
    const result = await db.query("SELECT * FROM gallery WHERE id = $1", [req.params.id]);
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: "Item not found." });
    const media = typeof item.media === "string"
      ? JSON.parse(item.media || "[]")
      : Array.isArray(item.media) ? item.media : [];
    if (order.length !== media.length || new Set(order).size !== media.length || order.some((index) => index < 0 || index >= media.length)) {
      return res.status(400).json({ error: "Invalid media order." });
    }

    const reorderedMedia = order.map((index) => media[index]);
    const oldCoverIndex = media.findIndex((entry) => entry && entry.is_cover === true);
    const movedCoverIndex = oldCoverIndex >= 0 ? reorderedMedia.findIndex((entry) => entry === media[oldCoverIndex]) : 0;
    const coverIndex = item.cover_explicit ? Math.max(0, movedCoverIndex) : 0;
    reorderedMedia.forEach((entry, index) => { entry.is_cover = index === coverIndex; });
    const updated = await db.query(
      `UPDATE gallery SET media = $1, cover_index = $2, file_path = $3, media_type = $4 WHERE id = $5 RETURNING *`,
      [JSON.stringify(reorderedMedia), coverIndex, reorderedMedia[coverIndex].file_path, reorderedMedia[coverIndex].type, req.params.id]
    );
    res.json(normalizeItem(updated.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/media/:index", adminAuth, async (req, res, next) => {
  const removeIndex = Number(req.params.index);

  try {
    const result = await db.query("SELECT * FROM gallery WHERE id = $1", [req.params.id]);
    const item = result.rows[0];
    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }

    const parsedMedia = typeof item.media === "string"
      ? JSON.parse(item.media || "[]")
      : Array.isArray(item.media) ? item.media : [];
    const media = parsedMedia.length
      ? parsedMedia
      : item.file_path
        ? [{ type: item.media_type || inferMediaType(item.file_path), file_path: item.file_path, is_cover: true }]
        : [];
    if (!media.length || Number.isNaN(removeIndex) || removeIndex < 0 || removeIndex >= media.length) {
      return res.status(400).json({ error: "Invalid media index." });
    }

    const fileToRemove = media[removeIndex];
    const remainingMedia = media.filter((_, idx) => idx !== removeIndex);
    const nextCoverIndex = remainingMedia.length ? Math.max(0, Math.min(Number(item.cover_index || 0), remainingMedia.length - 1)) : 0;
    const reconciledMedia = remainingMedia.map((entry, idx) => ({
      ...entry,
      is_cover: idx === nextCoverIndex,
    }));

    if (fileToRemove && fileToRemove.file_path) {
      const normalizedPath = String(fileToRemove.file_path || "").replace(/^\/+/, "");
      const fullPath = path.join(__dirname, "..", normalizedPath);
      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, () => {});
      }
    }

    const fallbackFile = reconciledMedia[0] || null;
    const updated = await db.query(
      `UPDATE gallery
       SET media = $1,
           cover_index = $2,
           file_path = $3,
           media_type = $4
       WHERE id = $5
       RETURNING *`,
      [JSON.stringify(reconciledMedia), nextCoverIndex, fallbackFile ? fallbackFile.file_path : null, fallbackFile ? fallbackFile.type : null, req.params.id]
    );

    res.json(normalizeItem(updated.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", adminAuth, async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM gallery WHERE id = $1", [
      req.params.id,
    ]);
    const item = result.rows[0];

    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }

    const media = Array.isArray(item.media) && item.media.length ? item.media : item.file_path ? [{ file_path: item.file_path, type: item.media_type || inferMediaType(item.file_path) }] : [];

    media.forEach((entry) => {
      if (!entry || !entry.file_path) return;
      const normalizedPath = String(entry.file_path || "").replace(/^\/+/, "");
      const filePath = path.join(__dirname, "..", normalizedPath);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    });

    await db.query("DELETE FROM gallery WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

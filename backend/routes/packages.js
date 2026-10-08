const express = require("express");
const db = require("../db/db");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parsePrice(value) {
  const price = Number(value);
  return Number.isInteger(price) && price >= 0 ? price : null;
}

function validateHomeType(name, inclusions) {
  return name && name.length <= 30 && Array.isArray(inclusions) && inclusions.length <= 30 && inclusions.every((item) => String(item).trim().length <= 120);
}

function validatePlan(name, price, note) {
  return name && name.length <= 30 && parsePrice(price) !== null && note.length <= 90;
}

async function readPackages() {
  const [typesResult, plansResult, settingsResult] = await Promise.all([
    db.query("SELECT id, name, inclusions, sort_order, is_active FROM home_types WHERE is_active = true ORDER BY sort_order, id"),
    db.query("SELECT id, home_type_id, name, price, note, is_popular, sort_order FROM plans ORDER BY sort_order, id"),
    db.query("SELECT value FROM settings WHERE key = $1", ["planner_footnote"]),
  ]);
  return {
    footnote: settingsResult.rows[0]?.value || "Prices include POP, paint, electrical work and materials. GST is extra on all plan prices.",
    homeTypes: typesResult.rows.map((type) => ({
      ...type,
      inclusions: Array.isArray(type.inclusions) ? type.inclusions : [],
      plans: plansResult.rows.filter((plan) => String(plan.home_type_id) === String(type.id)),
    })),
  };
}

router.get("/", async (req, res, next) => {
  try {
    res.json(await readPackages());
  } catch (error) {
    next(error);
  }
});

router.get("/admin", adminAuth, async (req, res, next) => {
  try {
    const types = await readPackages();
    const allTypes = await db.query("SELECT id, name, inclusions, sort_order, is_active FROM home_types ORDER BY sort_order, id");
    types.homeTypes = allTypes.rows.map((type) => ({
      ...type,
      inclusions: Array.isArray(type.inclusions) ? type.inclusions : [],
      plans: types.homeTypes.find((item) => String(item.id) === String(type.id))?.plans || [],
    }));
    res.json(types);
  } catch (error) {
    next(error);
  }
});

router.post("/types", adminAuth, async (req, res, next) => {
  const name = cleanText(req.body.name, 30);
  if (!name) return res.status(400).json({ error: "Home type name is required." });
  try {
    const duplicate = await db.query("SELECT 1 FROM home_types WHERE LOWER(name) = LOWER($1)", [name]);
    if (duplicate.rows.length) return res.status(409).json({ error: "That home type already exists." });
    const result = await db.query("INSERT INTO home_types (name, inclusions, sort_order, is_active) VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM home_types), true) RETURNING *", [name, []]);
    const plan = await db.query("INSERT INTO plans (home_type_id, name, price, note, is_popular, sort_order) VALUES ($1, $2, $3, $4, true, 0) RETURNING *", [result.rows[0].id, "New plan", 0, "Add what this plan includes."]);
    res.status(201).json({ ...result.rows[0], plans: [plan.rows[0]] });
  } catch (error) { next(error); }
});

router.put("/types/:id", adminAuth, async (req, res, next) => {
  const name = cleanText(req.body.name, 30);
  const inclusions = Array.isArray(req.body.inclusions) ? req.body.inclusions.map((item) => cleanText(item, 120)).filter(Boolean) : [];
  if (!validateHomeType(name, inclusions)) return res.status(400).json({ error: "Enter a valid home type and inclusions." });
  try {
    const duplicate = await db.query("SELECT 1 FROM home_types WHERE LOWER(name) = LOWER($1) AND id <> $2", [name, req.params.id]);
    if (duplicate.rows.length) return res.status(409).json({ error: "That home type already exists." });
    const result = await db.query("UPDATE home_types SET name = $1, inclusions = $2 WHERE id = $3 RETURNING *", [name, inclusions, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Home type not found." });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

router.delete("/types/:id", adminAuth, async (req, res, next) => {
  try {
    const count = await db.query("SELECT COUNT(*) AS count FROM home_types WHERE is_active = true");
    if (Number(count.rows[0].count) <= 1) return res.status(400).json({ error: "Keep at least one home type." });
    await db.query("DELETE FROM home_types WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post("/types/:id/plans", adminAuth, async (req, res, next) => {
  try {
    const result = await db.query("INSERT INTO plans (home_type_id, name, price, note, is_popular, sort_order) VALUES ($1, $2, 0, $3, false, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM plans WHERE home_type_id = $1)) RETURNING *", [req.params.id, "New plan", "Add what this plan includes."]);
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

router.put("/plans/:id", adminAuth, async (req, res, next) => {
  const name = cleanText(req.body.name, 30);
  const note = cleanText(req.body.note, 90);
  const price = parsePrice(req.body.price);
  if (!validatePlan(name, price, note)) return res.status(400).json({ error: "Enter a valid plan name, whole-number price, and note." });
  try {
    const client = await db.getClient();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT home_type_id FROM plans WHERE id = $1", [req.params.id]);
      if (!current.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Plan not found." }); }
      const popular = Boolean(req.body.is_popular);
      if (popular) await client.query("UPDATE plans SET is_popular = false WHERE home_type_id = $1", [current.rows[0].home_type_id]);
      const result = await client.query("UPDATE plans SET name = $1, price = $2, note = $3, is_popular = $4 WHERE id = $5 RETURNING *", [name, price, note, popular, req.params.id]);
      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) { next(error); }
});

router.delete("/plans/:id", adminAuth, async (req, res, next) => {
  try {
    const result = await db.query("SELECT home_type_id FROM plans WHERE id = $1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Plan not found." });
    const count = await db.query("SELECT COUNT(*) AS count FROM plans WHERE home_type_id = $1", [result.rows[0].home_type_id]);
    if (Number(count.rows[0].count) <= 1) return res.status(400).json({ error: "Keep at least one plan for each home type." });
    await db.query("DELETE FROM plans WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.put("/footnote", adminAuth, async (req, res, next) => {
  const footnote = cleanText(req.body.footnote, 240);
  if (!footnote) return res.status(400).json({ error: "Footnote is required." });
  try {
    await db.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", ["planner_footnote", footnote]);
    res.json({ footnote });
  } catch (error) { next(error); }
});

module.exports = router;

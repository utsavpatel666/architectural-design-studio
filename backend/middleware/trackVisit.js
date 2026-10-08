// trackVisit.js
// Records a lightweight, privacy-friendly visit log for the admin dashboard.
// The IP address is hashed (not stored raw) since we only need rough
// unique-visitor counts, not personal tracking.

const crypto = require("crypto");
const db = require("../db/db");

async function trackVisit(req, res, next) {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    await db.query("INSERT INTO visits (page, ip_hash) VALUES ($1, $2)", [
      req.path,
      ipHash,
    ]);
  } catch (err) {
    // Never let tracking failures break the actual request
    console.error("[trackVisit] failed:", err.message);
  }
  next();
}

module.exports = trackVisit;

// adminAuth.js
// Protects admin-only routes using a JWT issued at admin login.
// The token is expected in the "Authorization: Bearer <token>" header.

const jwt = require("jsonwebtoken");

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing admin token." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ error: "Not authorized." });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

module.exports = adminAuth;

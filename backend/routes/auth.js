// routes/auth.js
// Handles Google login (optional) and lets the frontend check "who am I".
// Users are NOT required to log in - the contact form works as a guest too.

const express = require("express");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const db = require("../db/db");
const authRateLimit = require("../middleware/authRateLimit");
const router = express.Router();

const invalidCredentialsMessage = "Invalid email or password";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8;
}

function publicUser(user) {
  return {
    loggedIn: true,
    name: user.name,
    email: user.email,
    avatar: user.avatar_url,
  };
}

function requireGoogleConfig(req, res, next) {
  if (!passport.googleEnabled) {
    return res.status(503).json({ error: "Google sign-in is not configured." });
  }
  next();
}

// Step 1: redirect the user to Google's login screen
router.get(
  "/google",
  requireGoogleConfig,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Step 2: Google redirects back here after login
router.get(
  "/google/callback",
  requireGoogleConfig,
  passport.authenticate("google", {
    failureRedirect: "/?login=failed",
    session: true,
  }),
  (req, res) => {
    // Successful login -> send them back to the homepage
    res.redirect("/?login=success");
  }
);

router.post("/register", authRateLimit, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;

  if (!name || name.length > 120 || !isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid name and email address." });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const existing = await db.query(
      "SELECT id, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );
    if (existing.rows[0]) {
      return res.status(409).json({
        error: existing.rows[0].password_hash
          ? "An account already exists with this email."
          : "This email is linked to Google login. Use Google login.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, avatar_url`,
      [name, email, passwordHash]
    );
    await new Promise((resolve, reject) => req.login(result.rows[0], (error) => error ? reject(error) : resolve()));
    res.status(201).json(publicUser(result.rows[0]));
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "An account already exists with this email." });
    }
    console.error("Email registration failed:", error.message);
    res.status(500).json({ error: "Unable to create your account right now." });
  }
});

router.post("/login", authRateLimit, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;

  if (!isValidEmail(email) || typeof password !== "string") {
    return res.status(401).json({ error: invalidCredentialsMessage });
  }

  try {
    const result = await db.query(
      "SELECT id, name, email, avatar_url, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );
    const user = result.rows[0];
    const matches = user && user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!matches) {
      return res.status(401).json({ error: invalidCredentialsMessage });
    }

    await new Promise((resolve, reject) => req.login(user, (error) => error ? reject(error) : resolve()));
    res.json(publicUser(user));
  } catch (error) {
    console.error("Email login failed:", error.message);
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});

// Check current logged-in user (used by frontend to show "Hi, Name" or a Login button)
router.get("/me", (req, res) => {
  if (req.user) {
    res.json({
      loggedIn: true,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar_url,
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

module.exports = router;

// server.js
// Main entry point: sets up Express, sessions, Google OAuth, static file
// serving for the frontend, and mounts all API routes.

require("dotenv").config();

const path = require("path");
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const session = require("express-session");
const passport = require("./config/passport");
const { initDb } = require("./db/db");

const trackVisit = require("./middleware/trackVisit");

const authRoutes = require("./routes/auth");
const contactRoutes = require("./routes/contact");
const faqRoutes = require("./routes/faq");
const galleryRoutes = require("./routes/gallery");
const teamRoutes = require("./routes/team");
const settingsRoutes = require("./routes/settings");
const packagesRoutes = require("./routes/packages");
const adminRoutes = require("./routes/admin");

const app = express();
// Connect to the database once, before handling any request (needed on Vercel)
let dbReady;
app.use(async (req, res, next) => {
  try {
    if (!dbReady) dbReady = initDb();
    await dbReady;
    next();
  } catch (error) {
    dbReady = null;
    console.error("Database init failed:", error);
    res.status(500).json({ error: "Database connection failed." });
  }
});
const PORT = process.env.PORT || 5000;
const corsOrigin = process.env.CORS_ORIGIN;

const allowedOrigins = corsOrigin
  ? corsOrigin.split(",").map((o) => o.trim())
  : true;

// --- Core middleware ---
app.use(compression());
app.use(cors({
  origin: Array.isArray(allowedOrigins) && allowedOrigins.length > 1 ? allowedOrigins : (corsOrigin || true),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Sessions (needed for Google OAuth login state) ---
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// --- Serve uploaded photos/videos ---
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "7d" }));

// --- Serve the frontend (public site + admin panel) ---
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath, {
  maxAge: "1d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("index.html") || filePath.endsWith("admin.html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  },
}));

// --- Lightweight visitor tracking on page-ish routes only ---
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
    return trackVisit(req, res, next);
  }
  next();
});

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/admin", adminRoutes);

// Keep API failures machine-readable instead of falling through to an HTML error page.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// --- Fallback: send index.html for any other GET route (simple SPA-style support) ---
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

// --- Error handler (keeps error messages friendly, not leaking stack traces) ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Something went wrong on our end." });
});

async function startServer() {
  try {
    await initDb();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running at:`);
      console.log(`- Local:   http://localhost:${PORT}`);
      console.log(`- Network: http://192.168.29.221:${PORT}`);
      console.log(`- Admin:   http://192.168.29.221:${PORT}/admin.html`);
    });
  } catch (error) {
    console.error("Failed to initialize PostgreSQL:", error);
    process.exit(1);
  }
}

if (process.env.VERCEL) {
  module.exports = app;
} else {
  startServer();
}




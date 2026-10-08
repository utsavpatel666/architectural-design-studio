const attempts = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function authRateLimit(req, res, next) {
  const key = `${req.path}:${req.ip}`;
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many attempts. Please try again later." });
  }

  recent.push(now);
  attempts.set(key, recent);
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of attempts) {
    const recent = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
    if (recent.length) {
      attempts.set(key, recent);
    } else {
      attempts.delete(key);
    }
  }
}, WINDOW_MS).unref();

module.exports = authRateLimit;

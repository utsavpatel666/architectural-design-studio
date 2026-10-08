// upload.js
// Handles photo/video uploads from the admin panel using multer.
// Files are saved under backend/uploads and served statically by server.js.

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = process.env.VERCEL
  ? "/tmp/uploads"
  : path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const allowedTypes = /jpeg|jpg|png|webp|mp4|mov|webm/;

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only image (jpg, png, webp) and video (mp4, mov, webm) files are allowed."));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

module.exports = upload;

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { seedPackages } = require("./seed_packages");

const schemaPath = path.join(__dirname, "schema.sql");
const connectionString = (
  process.env.DATABASE_URL || process.env.DB_PATH || ""
).replace(/^postgresql\+psycopg2:\/\//, "postgresql://") || null;
const useSsl = String(process.env.PG_SSL || "false").toLowerCase() === "true";

const pool = new Pool({
  connectionString,
  host: connectionString ? undefined : process.env.PGHOST || "127.0.0.1",
  port: connectionString ? undefined : Number(process.env.PGPORT || 5432),
  database: connectionString ? undefined : process.env.PGDATABASE,
  user: connectionString ? undefined : process.env.PGUSER,
  password: connectionString ? undefined : process.env.PGPASSWORD,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

let initialized = false;

async function initDb() {
  if (initialized) {
    return;
  }

  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);

  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
  await pool.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS budget NUMERIC");
  await seedPackages({ query });

  await pool.query(`
    ALTER TABLE gallery
      ADD COLUMN IF NOT EXISTS display_in TEXT NOT NULL DEFAULT 'both',
      ADD COLUMN IF NOT EXISTS cover_index INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cover_explicit BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    UPDATE gallery
    SET display_in = CASE
      WHEN display_in IS NULL OR display_in NOT IN ('portfolio', 'gallery3d') THEN 'both'
      ELSE display_in
    END,
        cover_index = CASE
          WHEN cover_index IS NULL OR cover_index < 0 THEN 0
          ELSE cover_index
        END
    WHERE display_in IS NULL OR display_in NOT IN ('portfolio', 'gallery3d') OR cover_index IS NULL OR cover_index < 0;
  `);

  await pool.query(`
    UPDATE gallery
    SET media = CASE
      WHEN media IS NULL OR jsonb_typeof(media) <> 'array' THEN jsonb_build_array(
        jsonb_build_object(
          'type', COALESCE(media_type, CASE WHEN lower(file_path) ~ '\\.(mp4|mov|webm)$' THEN 'video' ELSE 'image' END),
          'file_path', file_path,
          'is_cover', true
        )
      )
      ELSE media
    END,
        file_path = CASE
          WHEN file_path IS NULL AND media IS NOT NULL AND jsonb_typeof(media) = 'array' AND jsonb_array_length(media) > 0 THEN media->0->>'file_path'
          ELSE file_path
        END,
        media_type = CASE
          WHEN media_type IS NULL OR media_type = '' THEN
            CASE
              WHEN media IS NOT NULL AND jsonb_typeof(media) = 'array' AND jsonb_array_length(media) > 0 THEN media->0->>'type'
              WHEN lower(file_path) ~ '\\.(mp4|mov|webm)$' THEN 'video'
              ELSE 'image'
            END
          ELSE media_type
        END
    WHERE file_path IS NOT NULL OR media IS NULL OR jsonb_typeof(media) <> 'array';
  `);

  initialized = true;
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

module.exports = {
  pool,
  initDb,
  query,
  getClient,
};

-- ============================================
-- Interior Design Website - PostgreSQL Schema
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    google_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    bhk_interest TEXT,
    budget NUMERIC,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    admin_reply TEXT,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faqs (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gallery (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    bhk_type TEXT NOT NULL,
    media_type TEXT NOT NULL,
    file_path TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    display_in TEXT NOT NULL DEFAULT 'both',
    cover_index INTEGER NOT NULL DEFAULT 0,
    cover_explicit BOOLEAN NOT NULL DEFAULT FALSE,
    media JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    photo_path TEXT NOT NULL,
    bio TEXT NOT NULL,
    focus TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS home_types (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    inclusions TEXT[] NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS plans (
    id BIGSERIAL PRIMARY KEY,
    home_type_id BIGINT NOT NULL REFERENCES home_types(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    note TEXT NOT NULL DEFAULT '',
    is_popular BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visits (
    id BIGSERIAL PRIMARY KEY,
    page TEXT,
    ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_gallery_bhk_type ON gallery(bhk_type);
CREATE INDEX IF NOT EXISTS idx_gallery_sort_order ON gallery(sort_order, id DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_sort_order ON team_members(sort_order, id ASC);
CREATE INDEX IF NOT EXISTS idx_faqs_sort_order ON faqs(sort_order, id ASC);
CREATE INDEX IF NOT EXISTS idx_visits_ip_hash ON visits(ip_hash);

INSERT INTO settings (key, value)
VALUES
    ('whatsapp_number', '+919999999999'),
    ('instagram_url', 'https://instagram.com/yourpage'),
    ('contact_email', 'hello@yourdomain.com'),
    ('location_url', ''),
    ('site_tagline', 'Turning houses into homes.'),
    ('planner_footnote', 'Prices include POP, paint, electrical work and materials. GST is extra on all plan prices.')
ON CONFLICT (key) DO NOTHING;

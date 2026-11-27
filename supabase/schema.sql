-- Run this schema in Supabase SQL Editor if using SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
-- (If using DATABASE_URL / PostgreSQL connection string directly, tables are created automatically.)

CREATE TABLE IF NOT EXISTS kimura_app_state (
  id INTEGER PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kimura_media (
  id TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  data_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

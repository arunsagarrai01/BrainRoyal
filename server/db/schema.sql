-- BrainRoyale schema. Safe to run on every server start (idempotent).
--
-- NOTE: do not use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` here.
-- PGlite (the embedded wasm Postgres used as a dev fallback) throws
--   23505 duplicate key value violates unique constraint "pg_attribute_relid_attnam_index"
-- when that statement runs against a table that already has the column.
-- A guarded ALTER inside a DO block behaves correctly on both PGlite and real Postgres.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'player',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- Columns added after the first release: keep older databases in sync.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'users'::regclass AND attname = 'role' AND NOT attisdropped
  ) THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'player';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'users'::regclass AND attname = 'last_login_at' AND NOT attisdropped
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  run_id VARCHAR(64),
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per play-through; the score is updated as the run progresses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'scores'::regclass
      AND attname = 'run_id'
      AND NOT attisdropped
  ) THEN
    ALTER TABLE scores ADD COLUMN run_id VARCHAR(64);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS scores_user_run_idx ON scores (user_id, run_id);

CREATE TABLE IF NOT EXISTS game_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  ended_at TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Sessions: server-side session store that backs the httpOnly session cookie.
-- Only a SHA-256 hash of the session token is persisted, so a leaked database
-- dump cannot be replayed as a valid login.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  user_agent VARCHAR(255),
  ip VARCHAR(64),
  remember BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Login attempt throttling: one row per throttling key ("email:..." / "ip:...").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key VARCHAR(160) PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMPTZ
);

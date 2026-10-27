CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  run_id VARCHAR(64),
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per play-through; the score is updated as the run progresses.
ALTER TABLE scores ADD COLUMN IF NOT EXISTS run_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS scores_user_run_idx ON scores (user_id, run_id);

CREATE TABLE IF NOT EXISTS game_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  ended_at TIMESTAMP
);

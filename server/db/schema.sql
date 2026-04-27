-- lingua-app database schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nickname VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_languages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  level_cefr VARCHAR(5) DEFAULT 'A1',
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_seen TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, language)
);

CREATE TABLE IF NOT EXISTS placement_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  answers_json JSONB NOT NULL DEFAULT '[]',
  level_cefr VARCHAR(5) NOT NULL,
  weak_areas_json JSONB NOT NULL DEFAULT '[]',
  taken_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  messages_json JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vocab_deck (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  language VARCHAR(50) NOT NULL,
  item VARCHAR(500) NOT NULL,
  translation VARCHAR(500) NOT NULL,
  next_review TIMESTAMP DEFAULT NOW(),
  interval_days INTEGER DEFAULT 1,
  ease_factor FLOAT DEFAULT 2.5,
  repetitions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_languages_user_id ON user_languages(user_id);
CREATE INDEX IF NOT EXISTS idx_placement_results_user_id ON placement_results(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_deck_user_id ON vocab_deck(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_deck_next_review ON vocab_deck(next_review);

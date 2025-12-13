-- Add scoring metadata to leagues
ALTER TABLE leagues
  ALTER COLUMN platform SET DEFAULT 'sleeper',
  ADD COLUMN IF NOT EXISTS season INT,
  ADD COLUMN IF NOT EXISTS scoring_format TEXT;

UPDATE leagues SET platform = 'sleeper' WHERE platform IS NULL;

-- League teams mapping
CREATE TABLE IF NOT EXISTS league_teams (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id VARCHAR NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  external_user_id TEXT,
  external_roster_id TEXT,
  display_name TEXT NOT NULL,
  is_commissioner BOOLEAN DEFAULT FALSE,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS league_teams_league_roster_idx ON league_teams(league_id, external_roster_id);
CREATE UNIQUE INDEX IF NOT EXISTS league_teams_league_user_idx ON league_teams(league_id, external_user_id);

-- User league preferences
CREATE TABLE IF NOT EXISTS user_league_preferences (
  user_id TEXT PRIMARY KEY,
  active_league_id VARCHAR REFERENCES leagues(id) ON DELETE SET NULL,
  active_team_id VARCHAR REFERENCES league_teams(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

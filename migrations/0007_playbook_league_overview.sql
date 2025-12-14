-- Add user platform profiles for linking external accounts
CREATE TABLE IF NOT EXISTS user_platform_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  platform text NOT NULL DEFAULT 'sleeper',
  external_user_id text NOT NULL,
  username text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_platform_profiles_user_platform_idx
  ON user_platform_profiles (user_id, platform);

-- Cacheable league dashboard snapshots
CREATE TABLE IF NOT EXISTS league_dashboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id text NOT NULL,
  week integer,
  season integer,
  payload jsonb NOT NULL,
  computed_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS league_dashboard_snapshots_key
  ON league_dashboard_snapshots (league_id, week, season);

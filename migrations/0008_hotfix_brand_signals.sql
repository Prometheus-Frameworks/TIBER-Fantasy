-- Ensure uuid helper exists (usually already there)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS brand_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  season integer NOT NULL,
  week integer NOT NULL,
  player_id text NOT NULL,
  signal_key text NOT NULL,
  signal_value real,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Constraints / indexes (matches your schema naming)
CREATE UNIQUE INDEX IF NOT EXISTS brand_signals_unique
  ON brand_signals (brand, season, week, player_id, signal_key);

CREATE INDEX IF NOT EXISTS brand_signals_brand_season_week_idx
  ON brand_signals (brand, season, week);

CREATE INDEX IF NOT EXISTS brand_signals_player_brand_idx
  ON brand_signals (player_id, brand);

CREATE INDEX IF NOT EXISTS brand_signals_key_idx
  ON brand_signals (signal_key);

CREATE INDEX IF NOT EXISTS brand_signals_value_idx
  ON brand_signals (signal_value);

CREATE INDEX IF NOT EXISTS brand_signals_created_at_idx
  ON brand_signals (created_at);

CREATE INDEX IF NOT EXISTS brand_signals_player_season_brand_idx
  ON brand_signals (player_id, season, brand);

CREATE INDEX IF NOT EXISTS brand_signals_brand_signal_value_idx
  ON brand_signals (brand, signal_key, signal_value);

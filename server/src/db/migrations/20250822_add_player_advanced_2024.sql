CREATE TABLE IF NOT EXISTS player_advanced_2024 (
  id SERIAL PRIMARY KEY,
  player_id TEXT,
  player_name TEXT,
  team TEXT,
  position TEXT,
  games SMALLINT,
  -- WR/TE
  adot NUMERIC,
  yprr NUMERIC,           -- null in v1.5
  racr NUMERIC,
  target_share NUMERIC,
  wopr NUMERIC,
  -- RB
  rush_expl_10p NUMERIC,
  -- QB
  aypa NUMERIC,
  epa_per_play NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_padv24_pid ON player_advanced_2024(player_id);
CREATE INDEX IF NOT EXISTS idx_padv24_pos ON player_advanced_2024(position);
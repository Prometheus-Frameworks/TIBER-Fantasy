CREATE TABLE IF NOT EXISTS player_profile (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('QB','RB','WR','TE')),
  team TEXT,
  age NUMERIC,                -- years with decimals ok
  draft_round SMALLINT,
  draft_pick SMALLINT,
  contract_yrs_left SMALLINT,
  guarantees_usd NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_player_profile_pos ON player_profile(position);
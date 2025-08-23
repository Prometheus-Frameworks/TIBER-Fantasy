CREATE TABLE IF NOT EXISTS player_inputs (
  player_id TEXT NOT NULL,
  season SMALLINT NOT NULL,
  week SMALLINT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('QB','RB','WR','TE')),
  team TEXT NOT NULL,

  -- Opportunity / Usage
  snap_pct NUMERIC,                    -- 0..100
  routes NUMERIC,
  tprr NUMERIC,                        -- targets per route run 0..1
  rush_share NUMERIC,                  -- 0..1
  target_share NUMERIC,                -- 0..1
  goalline_share NUMERIC,              -- 0..1
  two_min_share NUMERIC,               -- 0..1

  -- Efficiency
  yprr NUMERIC,
  yac_per_rec NUMERIC,
  mtf NUMERIC,                         -- missed tackles forced (per game or per att - pick one consistently)
  succ_rate NUMERIC,                   -- 0..1
  epa_per_play_qb NUMERIC,

  -- Team environment
  team_epa_play NUMERIC,
  team_pace NUMERIC,
  team_rz_plays NUMERIC,
  team_pass_rate NUMERIC,              -- 0..1

  -- Health / flags
  injury_status TEXT,                  -- 'healthy','questionable','out' ...
  dnp_weeks_rolling SMALLINT DEFAULT 0,

  -- SOS v2 (contextual, next 3 weeks blended or week-specific)
  sos_ctx NUMERIC,

  PRIMARY KEY (player_id, season, week)
);

CREATE INDEX IF NOT EXISTS idx_inputs_lookup
  ON player_inputs(season, week, position);

CREATE INDEX IF NOT EXISTS idx_inputs_player_time
  ON player_inputs(player_id, season, week);
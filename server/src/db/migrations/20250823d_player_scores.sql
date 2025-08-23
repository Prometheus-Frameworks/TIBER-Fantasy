CREATE TABLE IF NOT EXISTS player_scores (
  player_id TEXT NOT NULL,
  season SMALLINT NOT NULL,
  week SMALLINT,                              -- NULL for dynasty seasonal if needed
  format TEXT NOT NULL CHECK (format IN ('redraft','dynasty')),
  position TEXT NOT NULL CHECK (position IN ('QB','RB','WR','TE')),
  score NUMERIC NOT NULL,                     -- 0..100
  vor NUMERIC,                                -- Value over replacement (position-normalized)
  tier SMALLINT,                              -- 1 = elite tier, increasing numbers down
  weights_json JSONB,                         -- weights actually used
  debug_json JSONB,                           -- component breakdown
  PRIMARY KEY (player_id, season, week, format)
);

CREATE INDEX IF NOT EXISTS idx_scores_listing
  ON player_scores(season, week, format, position, score DESC);
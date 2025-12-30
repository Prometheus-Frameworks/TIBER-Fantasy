-- Metric Matrix Player Vectors cache table
CREATE TABLE IF NOT EXISTS metric_matrix_player_vectors (
  player_id text NOT NULL,
  season integer NOT NULL DEFAULT 0,
  week integer NOT NULL DEFAULT 0,
  mode text NOT NULL,
  axes_json jsonb NOT NULL,
  confidence real,
  missing_inputs text[] DEFAULT '{}',
  computed_at timestamptz DEFAULT now(),
  PRIMARY KEY (player_id, season, week, mode)
);

CREATE INDEX IF NOT EXISTS metric_matrix_player_vectors_mode_idx
  ON metric_matrix_player_vectors (mode);

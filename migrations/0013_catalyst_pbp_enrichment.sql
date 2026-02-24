-- Phase 0 CATALYST enrichment: expose win probability and score differential on bronze play rows
ALTER TABLE bronze_nflfastr_plays
  ADD COLUMN IF NOT EXISTS wp real,
  ADD COLUMN IF NOT EXISTS score_differential integer;

UPDATE bronze_nflfastr_plays
SET
  wp = COALESCE(wp, NULLIF(raw_data->>'wp', '')::real),
  score_differential = COALESCE(
    score_differential,
    NULLIF(raw_data->>'score_differential', '')::numeric::integer
  )
WHERE raw_data IS NOT NULL
  AND (wp IS NULL OR score_differential IS NULL);

CREATE INDEX IF NOT EXISTS bronze_nflfastr_wp_idx
  ON bronze_nflfastr_plays (season, week, wp);

CREATE INDEX IF NOT EXISTS bronze_nflfastr_score_diff_idx
  ON bronze_nflfastr_plays (season, week, score_differential);

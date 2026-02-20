-- QB FIRE v1 foundation: expected fantasy points by week (opportunity + role pillars)

CREATE TABLE IF NOT EXISTS qb_xfp_weekly (
  season int NOT NULL,
  week int NOT NULL,
  player_id text NOT NULL,
  team text,
  dropbacks int NOT NULL DEFAULT 0,
  pass_attempts int NOT NULL DEFAULT 0,
  sacks int NOT NULL DEFAULT 0,
  scrambles int NOT NULL DEFAULT 0,
  qb_rush_attempts int NOT NULL DEFAULT 0,
  inside20_dropbacks int NOT NULL DEFAULT 0,
  inside10_dropbacks int NOT NULL DEFAULT 0,
  inside5_dropbacks int NOT NULL DEFAULT 0,
  exp_pass_yards real NOT NULL DEFAULT 0,
  exp_pass_td real NOT NULL DEFAULT 0,
  exp_int real NOT NULL DEFAULT 0,
  exp_rush_yards real NOT NULL DEFAULT 0,
  exp_rush_td real NOT NULL DEFAULT 0,
  xfp_redraft real NOT NULL DEFAULT 0,
  xfp_dynasty real NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  PRIMARY KEY (season, week, player_id)
);

CREATE INDEX IF NOT EXISTS qb_xfp_weekly_season_week_idx
  ON qb_xfp_weekly (season, week);

DROP MATERIALIZED VIEW IF EXISTS fantasy_metrics_weekly_mv;

CREATE MATERIALIZED VIEW fantasy_metrics_weekly_mv AS
WITH latest_snapshot AS (
  SELECT season, week, id AS snapshot_id
  FROM (
    SELECT
      sm.season,
      sm.week,
      sm.id,
      ROW_NUMBER() OVER (
        PARTITION BY sm.season, sm.week
        ORDER BY sm.is_official DESC, sm.validation_passed DESC, sm.snapshot_at DESC, sm.id DESC
      ) AS rn
    FROM datadive_snapshot_meta sm
  ) ranked
  WHERE rn = 1
),
weekly_base AS (
  SELECT
    spw.season,
    spw.week,
    spw.player_id,
    spw.player_name,
    spw.position,
    spw.team_id,
    spw.snaps,
    spw.snap_share,
    spw.targets,
    spw.target_share,
    spw.routes,
    spw.route_rate,
    spw.rush_attempts,
    spw.air_yards,
    spw.rz_targets,
    spw.rz_rush_attempts
  FROM datadive_snapshot_player_week spw
  INNER JOIN latest_snapshot ls
    ON ls.snapshot_id = spw.snapshot_id
),
market_facts_latest AS (
  SELECT
    pmf.canonical_player_id,
    pmf.season,
    pmf.avg_adp,
    pmf.adp_volatility,
    pmf.average_ownership,
    pmf.ownership_trend_7d,
    pmf.week,
    ROW_NUMBER() OVER (
      PARTITION BY pmf.canonical_player_id, pmf.season
      ORDER BY COALESCE(pmf.week, 0) DESC, pmf.calculated_at DESC, pmf.id DESC
    ) AS rn
  FROM player_market_facts pmf
),
market_signals_latest AS (
  SELECT
    ms.canonical_player_id,
    ms.signal_type,
    ms.source,
    ms.value,
    ms.overall_rank,
    ROW_NUMBER() OVER (
      PARTITION BY ms.canonical_player_id, ms.signal_type
      ORDER BY ms.season DESC, COALESCE(ms.week, 0) DESC, ms.extracted_at DESC, ms.id DESC
    ) AS rn
  FROM market_signals ms
  WHERE ms.signal_type IN ('adp', 'ownership')
),
adp_latest AS (
  SELECT
    canonical_player_id,
    source AS adp_source,
    value AS adp_latest,
    overall_rank AS adp_rank_latest
  FROM market_signals_latest
  WHERE signal_type = 'adp' AND rn = 1
),
ownership_latest AS (
  SELECT
    canonical_player_id,
    value AS rostered_pct_latest
  FROM market_signals_latest
  WHERE signal_type = 'ownership' AND rn = 1
)
SELECT
  wb.player_id,
  wb.season,
  wb.week,
  wb.position,
  COALESCE(pim.full_name, wb.player_name) AS player_name,
  wb.team_id AS team,

  wb.snaps,
  wb.snap_share,
  wb.targets,
  wb.target_share,
  wb.routes,
  wb.route_rate AS route_participation,
  wb.rush_attempts AS carries,
  NULL::real AS rush_share,
  wb.air_yards,
  NULL::real AS air_yards_share,
  wb.rz_targets,
  wb.rz_rush_attempts AS rz_rushes,
  (COALESCE(wb.rz_targets, 0) + COALESCE(wb.rz_rush_attempts, 0))::integer AS red_zone_touches,

  xfp.x_ppr_v2,
  xfp.xfpgoe_ppr_v2,
  NULL::real AS x_half_ppr,
  NULL::real AS x_std,

  qx.xfp_redraft AS qb_xfp_redraft,
  qx.xfp_dynasty AS qb_xfp_dynasty,
  qx.exp_pass_td AS qb_exp_pass_td,
  qx.exp_int AS qb_exp_int,
  qx.exp_rush_td AS qb_exp_rush_td,
  qx.dropbacks AS qb_dropbacks,
  qx.qb_rush_attempts,
  qx.inside10_dropbacks,
  qx.exp_pass_yards,
  qx.exp_rush_yards,

  adp.adp_latest,
  adp.adp_rank_latest,
  adp.adp_source,
  COALESCE(mf.adp_volatility, NULL)::real AS adp_stddev,
  COALESCE(own.rostered_pct_latest, mf.average_ownership)::real AS rostered_pct_latest,
  mf.ownership_trend_7d AS ownership_trend,
  COALESCE(mf.week, NULL)::integer AS market_week_reference
FROM weekly_base wb
LEFT JOIN datadive_expected_fantasy_week xfp
  ON xfp.season = wb.season
  AND xfp.week = wb.week
  AND xfp.player_id = wb.player_id
LEFT JOIN qb_xfp_weekly qx
  ON qx.season = wb.season
  AND qx.week = wb.week
  AND qx.player_id = wb.player_id
LEFT JOIN player_identity_map pim
  ON pim.canonical_id = wb.player_id
LEFT JOIN market_facts_latest mf
  ON mf.canonical_player_id = wb.player_id
  AND mf.season = wb.season
  AND mf.rn = 1
LEFT JOIN adp_latest adp
  ON adp.canonical_player_id = wb.player_id
LEFT JOIN ownership_latest own
  ON own.canonical_player_id = wb.player_id;

CREATE UNIQUE INDEX IF NOT EXISTS fantasy_metrics_weekly_mv_pk
  ON fantasy_metrics_weekly_mv (season, week, player_id);

CREATE INDEX IF NOT EXISTS fantasy_metrics_weekly_mv_season_week_idx
  ON fantasy_metrics_weekly_mv (season, week);

CREATE INDEX IF NOT EXISTS fantasy_metrics_weekly_mv_player_idx
  ON fantasy_metrics_weekly_mv (player_id);

CREATE INDEX IF NOT EXISTS fantasy_metrics_weekly_mv_position_idx
  ON fantasy_metrics_weekly_mv (position);

CREATE INDEX IF NOT EXISTS fantasy_metrics_weekly_mv_season_position_week_idx
  ON fantasy_metrics_weekly_mv (season, position, week);

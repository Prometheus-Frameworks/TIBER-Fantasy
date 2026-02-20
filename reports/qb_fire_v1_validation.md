# QB FIRE v1 — Validation Report

## Environment note

`DATABASE_URL` is not configured in this execution environment, so DB-backed validation queries and API runtime checks are documented as runnable SQL/API commands but could not be executed here.

## 1) Null audit (QB xFP field population)

Planned checks:

```sql
SELECT
  COUNT(*) AS qb_rows,
  COUNT(*) FILTER (WHERE qb_xfp_redraft IS NULL) AS qb_xfp_redraft_nulls,
  COUNT(*) FILTER (WHERE qb_xfp_dynasty IS NULL) AS qb_xfp_dynasty_nulls,
  COUNT(*) FILTER (WHERE qb_dropbacks IS NULL) AS qb_dropbacks_nulls
FROM fantasy_metrics_weekly_mv
WHERE position = 'QB';
```

```sql
SELECT
  COUNT(*) FILTER (WHERE xfp_redraft = 0 AND xfp_dynasty = 0 AND dropbacks > 0) AS suspicious_zero_rows
FROM qb_xfp_weekly;
```

Expected: near-zero nulls after ETL + MV refresh.

## 2) Rolling window sanity (2025 W14 rolling 11–14)

Planned redraft ranking:

```sql
WITH w AS (
  SELECT *
  FROM qb_xfp_weekly
  WHERE season = 2025 AND week BETWEEN 11 AND 14
)
SELECT
  player_id,
  SUM(xfp_redraft) AS xfp_redraft_r,
  SUM(exp_pass_td) AS exp_pass_td_r,
  SUM(exp_rush_td) AS exp_rush_td_r,
  SUM(exp_rush_yards) AS exp_rush_yards_r
FROM w
GROUP BY player_id
ORDER BY xfp_redraft_r DESC
LIMIT 10;
```

Planned dynasty ranking:

```sql
WITH w AS (
  SELECT *
  FROM qb_xfp_weekly
  WHERE season = 2025 AND week BETWEEN 11 AND 14
)
SELECT
  player_id,
  SUM(xfp_dynasty) AS xfp_dynasty_r,
  SUM(exp_pass_td) AS exp_pass_td_r,
  SUM(exp_rush_td) AS exp_rush_td_r,
  SUM(exp_rush_yards) AS exp_rush_yards_r
FROM w
GROUP BY player_id
ORDER BY xfp_dynasty_r DESC
LIMIT 10;
```

Expectation to verify:
- Rushing QBs move up in redraft (4pt pass TD).
- High pass-TD-expectation QBs gain in dynasty (6pt pass TD).

## 3) RoleScore sanity

```sql
WITH w AS (
  SELECT *
  FROM fantasy_metrics_weekly_mv
  WHERE season = 2025 AND week BETWEEN 11 AND 14 AND position = 'QB'
), agg AS (
  SELECT
    player_id,
    SUM(COALESCE(qb_dropbacks,0)) AS dropbacks_r,
    SUM(COALESCE(qb_rush_attempts,0)) AS qb_rush_attempts_r,
    SUM(COALESCE(inside10_dropbacks,0)) AS inside10_dropbacks_r
  FROM w
  GROUP BY player_id
)
SELECT *
FROM agg
ORDER BY dropbacks_r DESC, qb_rush_attempts_r DESC
LIMIT 15;
```

Expectation to verify: top RoleScore candidates should show high dropbacks and/or rushing usage.

## 4) Performance (FIRE QB batch)

Suggested check:

```bash
time curl "http://localhost:5000/api/fire/eg/batch?season=2025&week=14&position=QB&scoringPreset=redraft"
```

Expectation: sub-second response on warm DB cache.

## 5) Known limitations

- QB conversion pillar/FPOE is intentionally omitted in v1.
- QB FIRE composite is Opportunity (0.75) + Role (0.25) only.
- DELTA endpoint remains RB/WR/TE only until QB conversion is available.

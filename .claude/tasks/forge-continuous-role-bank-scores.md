# FORGE Continuous Role Bank Scores — Codex Task Spec

**Created:** 2026-02-17
**Status:** Open — can be done independently of other tasks
**Priority:** P2 — Improves ranking granularity but not a correctness bug
**Assignee:** Codex

---

## Problem

The role bank tables produce quantized/bucketed scores rather than continuous distributions. This limits FORGE's ability to distinguish between similarly-ranked players.

Current state of quantization (2025 season data):

| Position | Distinct volume_score values | Range | Example values |
|----------|------------------------------|-------|---------------|
| QB | 11 | 22-100 | 22, 31, 35, 40, 44, 50, 55, 69, 83, 93, 100 |
| RB | 33 | 18-93 | 18, 21, 23, 24, 27, 29, 30, 33... |
| WR | 17 | 13-85 | 13, 18, 22, 30, 34, 40, 44, 50... |
| TE | 18 | 19-93 | 19, 27, 31, 34, 39, 43, 51... |

QB is the worst — only 11 distinct values means ~3 QBs per bucket. The 15th and 25th ranked QB both get `volume_score=44`, and FORGE can't tell them apart.

### Why This Matters

The QB volume pillar currently uses 5 role bank metrics (line 198-204 of `forgeEngine.ts`):
```typescript
const QB_PILLARS = {
  volume: {
    metrics: [
      { metricKey: 'volume_score', source: 'role_bank', weight: 0.35 },
      { metricKey: 'dropbacks_per_game', source: 'role_bank', weight: 0.25 },
      { metricKey: 'passing_attempts', source: 'role_bank', weight: 0.20 },
      { metricKey: 'rush_attempts_per_game', source: 'role_bank', weight: 0.10 },
      { metricKey: 'red_zone_dropbacks_per_game', source: 'role_bank', weight: 0.10 },
    ],
  },
  ...
};
```

The `volume_score` (35% weight) is the most quantized. But `dropbacks_per_game`, `passing_attempts`, `rush_attempts_per_game` are also from role bank and may be pre-bucketed.

Meanwhile, the WR/RB/TE volume pillar already solved this by using `xfp_per_game` from derived source (computed from raw snapshot data), giving continuous scores.

## Solution: Extend xFP Volume to QBs

The cleanest fix is to give QBs the same xFP treatment that WR/RB/TE already have.

### Step 1: Verify QB xFP computation works

Check `xfpVolumePillar.ts` line 129-134 — the QB case already exists:
```typescript
case 'QB': {
  const qbXfp = dropbacks * xfpV3Coefficients.QB.dropback + rushAttempts * xfpV3Coefficients.QB.rushAttempt;
  return qbXfp;
}
```

And `xfpV3Coefficients.QB` is defined in `server/services/xFptsConfig.ts`. Verify these coefficients produce reasonable xFP/game values:
- Elite QB (35 dropbacks + 5 rushes): should give xFP ~15-25
- Average QB (30 dropbacks + 3 rushes): should give xFP ~12-18

If the QB xFP coefficients aren't tuned yet, calibrate them:
```sql
-- Get average PPR FPTS per dropback and per rush attempt for QBs
SELECT 
  AVG(fpts_ppr / NULLIF(dropbacks + rush_attempts, 0)) as fpts_per_play,
  AVG(fpts_ppr / NULLIF(dropbacks, 0)) as fpts_per_dropback,
  AVG(fpts_ppr / NULLIF(rush_attempts, 0)) as fpts_per_rush
FROM datadive_snapshot_player_week spw
JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
WHERE spw.position = 'QB'
  AND sm.season = 2025 AND sm.is_official = true
  AND spw.dropbacks >= 15;
```

### Step 2: Switch QB volume pillar to xFP

Change the QB_PILLARS volume config in `forgeEngine.ts` from the 5-metric role bank blend to the single derived xFP metric:

```typescript
const QB_PILLARS: PositionPillarConfig = {
  volume: {
    metrics: [
      { metricKey: 'xfp_per_game', source: 'derived', weight: 1.0 },
    ],
  },
  // ... efficiency, teamContext, stability stay the same
};
```

### Step 3: Verify QB xFP normalization range

Check `xfpNormalizationRanges` in `server/services/xFptsConfig.ts` has appropriate QB min/max:
```typescript
export const xfpNormalizationRanges: Record<string, { min: number; max: number }> = {
  QB: { min: X, max: Y },  // Verify these produce a 0-100 spread
  ...
};
```

Calculate appropriate ranges from actual data:
```sql
-- Get xFP distribution for QBs to set normalization range
-- Use p5 and p95 of per-game xFP
WITH qb_weekly AS (
  SELECT spw.player_id,
    spw.dropbacks * 0.5 + spw.rush_attempts * 0.8 as weekly_xfp  -- adjust coefficients
  FROM datadive_snapshot_player_week spw
  JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
  WHERE spw.position = 'QB' AND sm.season = 2025 AND sm.is_official = true
    AND spw.dropbacks >= 15
),
qb_avg AS (
  SELECT player_id, AVG(weekly_xfp) as xfp_per_game
  FROM qb_weekly GROUP BY player_id HAVING COUNT(*) >= 5
)
SELECT 
  PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY xfp_per_game) as p5,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY xfp_per_game) as median,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY xfp_per_game) as p95
FROM qb_avg;
```

Set `min = p5`, `max = p95` so the 0-100 range naturally spans from low-volume backup to elite starter.

### Step 4: Validate results

After the change, compare QB rankings before/after:
```bash
# Before (save current rankings)
curl -s "http://localhost:5000/api/forge/eg/batch?position=QB&season=2025&limit=15" | jq '.scores[] | {playerName, alpha, pillars}'

# After code change
curl -s "http://localhost:5000/api/forge/eg/batch?position=QB&season=2025&limit=15" | jq '.scores[] | {playerName, alpha, pillars}'
```

Key checks:
- Volume scores should now be continuous (not 11 discrete values)
- Elite QBs (Allen, Mahomes, Prescott) should still be top-5
- The overall ranking order should be broadly similar (Spearman ρ > 0.7 with old rankings)
- No QB should have volume = 0 or volume = 100 (proper spread)

### Optional: Also fix Efficiency Pillar Quantization

The efficiency pillar for QB uses `efficiency_score` (0.30) and `epa_per_play` (0.25) from role bank. These may also be quantized. If so, consider using derived metrics from snapshot data:
- `epa_per_play` can be fetched raw from snapshot
- `cpoe` can be fetched raw from snapshot
- This would give continuous efficiency scores

However, this is a larger change and could be deferred. The FPOE task (task spec #4) will eventually replace the efficiency pillar entirely.

### Files to Modify

| File | Change |
|------|--------|
| `server/modules/forge/forgeEngine.ts` | Change QB_PILLARS volume to use `xfp_per_game` derived source |
| `server/services/xFptsConfig.ts` | Verify/add QB xFP coefficients and normalization range |
| `server/modules/forge/xfpVolumePillar.ts` | Verify QB case in `computeWeekXfp()` produces reasonable values |

### Validation Criteria

1. QB volume scores are continuous (≥ 20 distinct values across 15+ QBs)
2. Elite QBs (Allen, Mahomes, Prescott) remain in top 5
3. Volume pillar spread: min > 10, max < 95, with good distribution
4. No regression in other positions (RB/WR/TE rankings unchanged)
5. All existing tests pass

---

## Post-Task Checklist

1. [ ] QB volume pillar switched to xFP derived source
2. [ ] xFP normalization range calibrated for QBs
3. [ ] QB rankings verified — elite starters in top 5
4. [ ] Volume scores are continuous, not bucketed
5. [ ] Other positions unaffected
6. [ ] Append to `.claude/context-log.md`
7. [ ] Update `.claude/agents/codex.md`

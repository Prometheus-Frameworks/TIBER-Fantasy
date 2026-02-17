# FORGE FPOE Efficiency Pillar — Codex Task Spec

**Created:** 2026-02-17
**Status:** Open — depends on xFP volume working correctly (which it does for RB/WR/TE; needs QB fix from task #3)
**Priority:** P2 — Clean architectural improvement, not a bug fix
**Assignee:** Codex

---

## Problem

The volume and efficiency pillars currently use **different baselines**, creating overlap and double-counting:

- **Volume pillar** (WR/RB/TE): Uses `xfp_per_game` — expected fantasy points from opportunity quality
- **Efficiency pillar**: Uses a blend of role bank scores (`efficiency_score`, `ppr_per_target`, `high_value_usage_score`, `epa_per_play`) — these metrics partially reflect volume, partially efficiency

The result: a player with high volume gets boosted in BOTH pillars because `efficiency_score` from the role bank correlates with volume. The pillars aren't orthogonal.

### The Clean Decomposition

If we define:
- **Volume = xFP per game** (what the opportunities are worth at league-average efficiency)
- **Efficiency = FPOE per game** (Fantasy Points Over Expected = actual PPR FPTS minus xFP)

Then the two pillars become **perfectly complementary** with zero overlap:
- `actual_fpts_per_game = xfp_per_game + fpoe_per_game`
- A player with high volume but average efficiency gets credit only in the volume pillar
- A player with low volume but elite efficiency gets credit only in the efficiency pillar
- A player with both gets credit in both — correctly

This is exactly what the `xfpVolumePillar.ts` already computes: it returns `{ xfpPerGame, fpoePerGame, weeksUsed }`. The `fpoePerGame` is already calculated but only used as a single metric (`fpoe_per_game` at line 415-421 of `forgeEngine.ts`), not as the primary efficiency signal.

## Solution: Replace Efficiency Pillar with FPOE

### Step 1: Update position pillar configs

Change the efficiency pillar for each position to use FPOE as the primary (or sole) metric:

**WR Efficiency (currently lines 110-116 of `forgeEngine.ts`):**
```typescript
// Before:
efficiency: {
  metrics: [
    { metricKey: 'efficiency_score', source: 'role_bank', weight: 0.30 },
    { metricKey: 'efficiency_index', source: 'role_bank', weight: 0.25 },
    { metricKey: 'ppr_per_target', source: 'role_bank', weight: 0.25 },
    { metricKey: 'deep_target_rate', source: 'role_bank', weight: 0.20 },
  ],
},

// After:
efficiency: {
  metrics: [
    { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.70 },
    { metricKey: 'deep_target_rate', source: 'role_bank', weight: 0.15 },
    { metricKey: 'ppr_per_target', source: 'role_bank', weight: 0.15 },
  ],
},
```

**RB Efficiency (currently lines 142-147):**
```typescript
// Before:
efficiency: {
  metrics: [
    { metricKey: 'high_value_usage_score', source: 'role_bank', weight: 0.40 },
    { metricKey: 'ppr_per_opportunity', source: 'role_bank', weight: 0.35 },
    { metricKey: 'red_zone_touches_per_game', source: 'role_bank', weight: 0.25 },
  ],
},

// After:
efficiency: {
  metrics: [
    { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.70 },
    { metricKey: 'red_zone_touches_per_game', source: 'role_bank', weight: 0.15 },
    { metricKey: 'ppr_per_opportunity', source: 'role_bank', weight: 0.15 },
  ],
},
```

**TE Efficiency (currently lines 173-177):**
```typescript
// After:
efficiency: {
  metrics: [
    { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.70 },
    { metricKey: 'ppr_per_target', source: 'role_bank', weight: 0.15 },
    { metricKey: 'red_zone_targets_per_game', source: 'role_bank', weight: 0.15 },
  ],
},
```

**QB Efficiency (currently lines 207-214):**
```typescript
// After:
efficiency: {
  metrics: [
    { metricKey: 'fpoe_per_game', source: 'derived', weight: 0.50 },
    { metricKey: 'epa_per_play', source: 'role_bank', weight: 0.20 },
    { metricKey: 'cpoe', source: 'role_bank', weight: 0.15 },
    { metricKey: 'sack_rate', source: 'role_bank', weight: 0.15, invert: true },
  ],
},
```

Note: QB efficiency keeps more role bank metrics (EPA, CPOE, sack rate) because these are genuinely efficiency metrics that aren't captured by FPOE alone. FPOE for QBs reflects passing + rushing efficiency combined, while EPA/CPOE isolate passing skill.

### Step 2: Verify FPOE normalization

The derived metric `fpoe_per_game` is already handled in `computeDerivedMetric()` at line 415-421:
```typescript
case 'fpoe_per_game': {
  const xfpData = context.xfpData;
  if (!xfpData || xfpData.weeksUsed === 0) return 50;
  // Normalize FPOE: -5 to +10 range → 0-100
  const normalized = ((xfpData.fpoePerGame - (-5)) / (10 - (-5))) * 100;
  return Math.max(0, Math.min(100, normalized));
}
```

**IMPORTANT:** Verify the normalization range `[-5, +10]` is appropriate:
```sql
-- Get FPOE distribution to validate normalization range
WITH player_fpoe AS (
  SELECT 
    spw.player_id,
    spw.position,
    AVG(spw.fpts_ppr) as avg_actual,
    COUNT(*) as weeks
  FROM datadive_snapshot_player_week spw
  JOIN datadive_snapshot_meta sm ON sm.id = spw.snapshot_id
  WHERE sm.season = 2025 AND sm.is_official = true
    AND spw.fpts_ppr > 0
  GROUP BY spw.player_id, spw.position
  HAVING COUNT(*) >= 5
)
SELECT position,
  PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY avg_actual) as p5,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_actual) as median,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY avg_actual) as p95
FROM player_fpoe
GROUP BY position;
```

If the actual FPOE range differs significantly from [-5, +10], adjust the normalization parameters.

The normalized range determines how much spread the efficiency pillar has:
- Too narrow: most players cluster at 50 → pillar has low discriminative power
- Too wide: almost everyone is at 0 or 100 → pillar becomes binary
- Ideal: good spread from 20-80 with elite outliers at 85+ and poor at 15-

### Step 3: Rebalance pillar weights (if needed)

Since FPOE is now the primary efficiency signal and it's perfectly complementary to xFP volume, the volume-efficiency correlation should drop significantly. This might mean the pillar weights need slight rebalancing.

Run a quick check after the change:
```bash
# Get pillar scores for top 20 RBs
curl -s "http://localhost:5000/api/forge/eg/batch?position=RB&season=2025&limit=20" | \
  jq '[.scores[] | {name: .playerName, vol: .pillars.volume, eff: .pillars.efficiency}]'
```

If volume and efficiency are now uncorrelated (which they should be), the existing weights should work fine. If they're negatively correlated (high volume players systematically have low FPOE), that's actually correct and expected — it means the pillars are capturing different information.

### Step 4: Validate rankings

Compare before/after rankings for all positions:
1. Top 5 players per position should be broadly similar (±3 positions)
2. Efficiency scores should have better spread (not all clustering at 50-70)
3. Players known for efficiency (e.g., elite WRs with low volume but high per-target production) should rank higher in efficiency than volume — this is the key qualitative check

### Files to Modify

| File | Change |
|------|--------|
| `server/modules/forge/forgeEngine.ts` | Update efficiency metric configs for WR, RB, TE, QB (lines 110-214) |
| `server/modules/forge/forgeEngine.ts` | Verify `fpoe_per_game` normalization range in `computeDerivedMetric()` |

### Edge Cases

1. **Players with 0 weeksUsed**: The `computeDerivedMetric` already returns 50 as default — this is correct (assume average efficiency when we have no data)
2. **Negative FPOE**: Perfectly valid — means the player underperforms his opportunities. The normalization handles this (maps -5 → 0)
3. **QB xFP not yet fixed**: If task #3 (continuous role bank scores) hasn't been deployed, QB FPOE may be inaccurate because QB xFP coefficients may not be calibrated. The FPOE efficiency change can still be made — it will improve once QB xFP is fixed.

### Validation Criteria

1. Volume and efficiency pillars are now complementary (low correlation)
2. Efficiency scores have good spread: min < 30, max > 80 for each position
3. Known efficient players (Puka Nacua, Nico Collins, etc.) rank higher in efficiency than volume
4. Top 5 rankings per position are stable (similar to pre-change, ±3 positions)
5. No player with ≥ 10 games has efficiency = 0.0
6. All existing tests pass
7. FPOE normalization produces reasonable distribution (mean ~45-55, stdev ~15-25)

---

## Architecture Note

After this change, the FORGE pillar decomposition becomes cleaner:

```
Volume     = What the opportunities are worth (xFP/game)
Efficiency = How much the player beats/misses expectations (FPOE/game)
Team Context = Environmental factors (team pace, SoS, offensive quality)
Stability  = Role consistency week-to-week (CV of usage metrics)
```

Each pillar captures orthogonal information:
- Volume × Efficiency = Total production explained
- Team Context = External factors outside player control
- Stability = Week-to-week reliability

This is a textbook clean decomposition — the kind of architecture that makes future tuning easier because changing one pillar doesn't leak into others.

---

## Post-Task Checklist

1. [ ] Efficiency configs updated for all 4 positions
2. [ ] FPOE normalization range validated
3. [ ] Rankings verified — no regressions
4. [ ] Volume-efficiency correlation reduced (ideally < 0.3)
5. [ ] Append to `.claude/context-log.md`
6. [ ] Update `.claude/agents/codex.md`
7. [ ] Update `replit.md` with note about FPOE efficiency pillar

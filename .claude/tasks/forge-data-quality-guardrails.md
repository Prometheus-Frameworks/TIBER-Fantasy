# FORGE Data Quality Guardrails — Codex Task Spec

**Created:** 2026-02-17
**Status:** Open
**Priority:** P0 — Every derived metric in FORGE is one bad data week away from producing garbage
**Assignee:** Codex

---

## Problem

The FORGE pipeline consumes snapshot data from `datadive_snapshot_player_week` without validation. Known data quality issues in 2025 season data:

| Week | Issue | Impact |
|------|-------|--------|
| 17 | 26 players have `snap_share = 1.0` (should be ~0.03-0.12) | Inflates snap-based metrics |
| 17 | 22 players have `snap_share IS NULL` | Causes NaN/0 in derived calculations |
| 18 | ALL 322 rows have `snap_share IS NULL` | Entire week is unusable for snap-based metrics |
| 18 | 5 players have all zeros (targets, rush_attempts, routes, dropbacks all = 0) | Ghost rows pollute per-game averages |
| Various | Players with zero primary metrics but non-zero snap counts | Partial data rows |

These issues directly caused:
- Baker Mayfield stability = 0.0 (week 18 zero-dropback row included in CV calculation)
- RB snap_share CV calculations producing garbage (snap_share ~0.07-0.09 instead of 0.5-0.9)
- Josh Allen dropping from rankings (data anomalies in volume computation)

## Solution: `snapshotDataValidator.ts`

Create a validation module at `server/modules/forge/snapshotDataValidator.ts` that sits between the database query and pillar computation. Every function that queries `datadive_snapshot_player_week` should pass the results through this validator before computing scores.

### Architecture

```
DB Query → snapshotDataValidator → Pillar Computation
```

The validator does NOT modify the database. It operates on in-memory query results, flagging or filtering bad rows.

### Validation Rules

Implement these validation rules. Each rule has a severity level:

| Rule | Check | Severity | Action |
|------|-------|----------|--------|
| `NULL_SNAP_SHARE` | `snap_share IS NULL` | WARN | Replace with position-appropriate default (0.0) and flag |
| `ANOMALOUS_SNAP_SHARE` | `snap_share = 1.0` or `snap_share > 0.5` for individual players | WARN | Clip to `0.12` (max reasonable per-player share) and flag |
| `GHOST_ROW` | All primary metrics = 0 (`targets + rush_attempts + routes + dropbacks = 0`) | DROP | Remove row entirely |
| `INACTIVE_WEEK` | Primary metric below position threshold (QB: dropbacks < 10, RB: touches < 3, WR/TE: routes < 3) | DROP | Remove row — player didn't meaningfully play |
| `EXTREME_OUTLIER` | Any metric > 3σ from player's own season mean | WARN | Flag but keep — let downstream decide |

### Interface

```typescript
export interface ValidationResult<T> {
  cleanRows: T[];
  droppedCount: number;
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  week: number;
  playerId: string;
  rule: string;
  field: string;
  originalValue: number | null;
  correctedValue?: number;
  message: string;
}

export function validateSnapshotRows(
  rows: SnapshotPlayerWeekRow[],
  position: Position,
  playerId: string
): ValidationResult<SnapshotPlayerWeekRow>;
```

### Integration Points

The validator must be called in these three files that query `datadive_snapshot_player_week`:

1. **`server/modules/forge/xfpVolumePillar.ts`** (line ~50-65)
   - Currently: `const weeks = result.rows as Record<string, any>[];` → iterates directly
   - After: Pass through validator, use `cleanRows`
   - This prevents ghost rows from deflating xFP/game averages

2. **`server/modules/forge/roleConsistencyPillar.ts`** (line ~137-168, `fetchWeeklyRoleData()`)
   - Currently: Returns raw query results
   - After: Pass through validator before returning
   - This is where the stability=0 bug originated (week 18 zeros in CV)
   - Note: `roleConsistencyPillar.ts` already has `filterActiveWeeks()` at line 176-190 which does part of this. The validator's `INACTIVE_WEEK` rule should subsume this, but keep `filterActiveWeeks()` as a safety net.

3. **`server/modules/forge/forgeEngine.ts`** (line ~870-950, `fetchForgeContext()`)
   - The context fetcher queries snapshot data for team context metrics
   - Less critical since it's aggregated, but still worth validating

### Logging

- Log a summary line per player: `[DataValidator] baker-mayfield (QB): 16 weeks → 15 clean (1 dropped: GHOST_ROW wk18), 2 warnings`
- Do NOT log per-row details unless the player has < 5 clean weeks (to aid debugging)
- Warnings should include enough context to debug issues without flooding logs

### Files to Create/Modify

| File | Action |
|------|--------|
| `server/modules/forge/snapshotDataValidator.ts` | **CREATE** — Core validation module |
| `server/modules/forge/xfpVolumePillar.ts` | **MODIFY** — Import and call validator after DB query (line ~72) |
| `server/modules/forge/roleConsistencyPillar.ts` | **MODIFY** — Import and call validator in `fetchWeeklyRoleData()` (line ~157) |
| `server/modules/forge/__tests__/snapshotDataValidator.test.ts` | **CREATE** — Unit tests for all validation rules |

### Testing

Unit tests should cover:
1. Ghost row removal: rows with all-zero primary metrics are dropped
2. Null snap_share: replaced with 0.0 and warning emitted
3. Anomalous snap_share=1.0: clipped to 0.12
4. Inactive week filtering: QB row with dropbacks=5 is dropped
5. Clean data: all rows pass through unchanged
6. Edge case: player with < 3 clean weeks returns early with warning
7. Extreme outlier detection: a week with 4x normal targets is flagged

### Validation Criteria

After deploying this change:
1. Baker Mayfield stability should remain ≥ 30 (week 18 ghost row filtered)
2. No player with 14+ games should have stability = 0.0
3. Week 18 data should not affect per-game averages for players who sat
4. Log output should show validation summaries during batch computation
5. All existing unit tests pass
6. Run batch endpoint for all 4 positions and verify no regressions:
   ```bash
   for pos in QB RB WR TE; do
     curl -s "http://localhost:5000/api/forge/eg/batch?position=$pos&season=2025&limit=5" | jq '.scores[] | {playerName, alpha, tier}'
   done
   ```

---

## Post-Task Checklist

1. [ ] `snapshotDataValidator.ts` created with all 5 validation rules
2. [ ] `xfpVolumePillar.ts` calls validator
3. [ ] `roleConsistencyPillar.ts` calls validator
4. [ ] Unit tests pass for all validation rules
5. [ ] Batch endpoint produces reasonable results for all positions
6. [ ] Append to `.claude/context-log.md`
7. [ ] Update `.claude/agents/codex.md`

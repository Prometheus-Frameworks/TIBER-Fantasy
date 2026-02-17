# Fix New Pillar Bugs — Claude Code Task Spec

**Created:** 2026-02-17
**Status:** Open
**Priority:** Critical — Live scoring bugs from pillar redesign commit `6c086fec`
**Branch:** main (or `codex/fix-pillar-bugs` if preferred)

---

## Context

Commit `6c086fec` ("Redesign FORGE volume, stability, and QB context pillars") introduced three new pillar implementations. The code compiles and the pipeline runs, but two bugs are producing bad live scores:

1. **Stability scores near-zero for many players** (including elite starters)
2. **Josh Allen missing from top QB rankings** (the exact problem the QB context fix was supposed to solve)

---

## Bug 1: Stability Pillar Returning Near-Zero Scores

### Symptom

Live API (`/api/forge/eg/batch?position=QB`) returns stability scores of 0.0 or 2.6 for elite QBs:

```
Baker Mayfield     stab=0.0   (should be ~60-80, started all 17 games)
Dak Prescott       stab=2.6   (should be ~70-90, elite starter)
Matthew Stafford   stab=2.6   (should be ~60-80)
R.Dowdle (RB)      stab=0.0   (played 18 games)
```

Meanwhile the **cache** (from the pre-redesign recompute) has reasonable stability for these players:
```
Baker Mayfield     stab=80.2 (cache)  vs  0.0 (live)
Dak Prescott       stab=92.4 (cache)  vs  2.6 (live)
```

Even RB stability scores are suspiciously low (CMC=31.1, Bijan=32.2) — elite bellcows should have role consistency scores of 60+.

### Root Cause Analysis

**File:** `server/modules/forge/roleConsistencyPillar.ts`

**Problem 1 — `dropbacks` column is all zeros in the database:**
```sql
SELECT dropbacks FROM datadive_snapshot_player_week LIMIT 5;
-- Result: 0, 0, 0, 0, 0
```
The `roleConsistencyPillar.ts` QB path uses `dropbacks` as the primary metric. Since all values are 0, CV calculation produces garbage → stability = 0.

**Problem 2 — RB uses raw touch counts, not touch share:**
Line 151: `const touchesPerWeek = weeks.map(w => w.rushAttempts + w.targets);`
This gives raw counts (e.g., 18, 22, 15), not shares. CV on raw counts is meaningful but produces higher variance than share-based metrics. A player with 20±3 touches has CV=0.15, which after the `cv_cap=0.50` clamp gives a reasonable score — but the magnitudes may need tuning.

**Problem 3 — `snap_share` values are team-relative fractions (0.07-0.08), not player snap percentages:**
The `snap_share` column in `datadive_snapshot_player_week` stores values like 0.077 (appears to be player snaps / total snaps across ALL players, not player snaps / team snaps). CV on these tiny fractions may produce unexpected results.

### Fix

1. **QB stability:** Fall back to `pass_attempts` or `completions` (which have data) instead of `dropbacks`. Or compute dropbacks as `pass_attempts + sacks` if sack data exists. Check available columns:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'datadive_snapshot_player_week' ORDER BY column_name;
   ```

2. **RB stability:** Verify the CV math produces reasonable scores (30-80 range for starters). If raw touches give too-low scores, consider using `snap_share` normalized to team level, or adjusting `cv_cap` values.

3. **All positions:** Add a debug log line when stability returns < 10 for a player with 10+ games, so we can catch these in the future:
   ```
   [RoleConsistency] WARNING: {player} ({position}) stability={score} with {weeks} weeks — possible data gap
   ```

### Validation

After fix:
- Baker Mayfield stability ≥ 50
- Dak Prescott stability ≥ 60
- CMC stability ≥ 50
- No player with 14+ games should have stability < 15
- Run: `curl -s "http://localhost:5000/api/forge/eg/batch?position=QB&season=2025&asOfWeek=17&limit=10"` and verify all stability > 0

---

## Bug 2: Josh Allen Missing from Top QB Rankings

### Symptom

The live API only returns 10 QBs, and Josh Allen is not among them. The cache shows Allen at 67.6 alpha. The whole point of the QB context redesign was to fix Allen being ranked below Wentz.

### Root Cause Hypothesis

The new team context pillar in `forgeEngine.ts` may be:
1. Failing to resolve Allen's player ID → team mapping (check `player_identity_map` for Allen's `canonical_id`)
2. Using a data source that doesn't have BUF team stats
3. Timing out during the batch computation (the batch endpoint is very slow — 20+ seconds for 10 QBs)

### Debug Steps

1. Check if Allen's canonical_id resolves correctly:
   ```sql
   SELECT * FROM player_identity_map WHERE display_name ILIKE '%Allen%' AND position = 'QB';
   ```

2. Check Allen's team context computation in the logs:
   ```
   grep "Allen\|00-0034857" /tmp/logs/Start_application_*.log
   ```

3. Try computing Allen individually:
   ```
   curl -s "http://localhost:5000/api/forge/eg/batch?position=QB&season=2025&asOfWeek=17&limit=40"
   ```
   (The limit=10 default may be cutting him off if his alpha dropped)

### Validation

After fix:
- Josh Allen appears in top 5 QBs by alpha
- Allen's alpha > 75 (he's a 22.4 PPG QB)
- Allen's team context score reflects BUF's elite offense

---

## Bug 3 (If Time): Recompute Grade Cache

The `forge_grade_cache` table still has scores from the **old** pillar design (pre-`6c086fec`). The Tiers page (`/tiers`) reads from this cache, so users see stale rankings.

### Action

Trigger a full recompute:
```bash
curl -X POST "http://localhost:5000/api/forge/compute-grades" \
  -H "x-admin-key: $FORGE_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"season": 2025, "asOfWeek": 17, "position": "ALL", "limit": 200}'
```

This takes ~5 minutes. Verify after with:
```sql
SELECT position, count(*) as cnt,
  round(min(alpha)::numeric,1) as min_a, round(max(alpha)::numeric,1) as max_a,
  count(*) FILTER (WHERE tier = 'T1') as t1
FROM forge_grade_cache WHERE season = 2025
GROUP BY position ORDER BY position;
```

### Validation

- RB T1 count: 5-10
- No stability scores of 0.0 for starters with 14+ games
- Josh Allen in QB T1 or T2

---

## Files to Modify

| File | Change |
|---|---|
| `server/modules/forge/roleConsistencyPillar.ts` | Fix QB data source (dropbacks→pass_attempts), validate RB CV ranges, add warning logs |
| `server/modules/forge/forgeEngine.ts` | Verify Allen's team context resolution, add debug logging |
| `.claude/context-log.md` | Append entry after fixes |
| `replit.md` | Update if architecture changed |

---

## Post-Task Checklist

1. Run `curl` against `/api/forge/eg/batch` for all 4 positions to verify no zeros
2. Trigger full recompute and verify cache
3. Append to `.claude/context-log.md`
4. Update `.claude/agents/claude-code.md` with work log

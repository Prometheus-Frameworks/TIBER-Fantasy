# Phase 2 Metrics Implementation Plan

**Status**: Ready to Start
**Created**: 2026-01-06
**Prerequisites**: ✅ Phase 1 Complete (22 metrics added)

---

## 🎯 Phase 2 Goals

Add **situational context metrics** that reveal player performance in high-leverage scenarios. Focus on metrics derivable from existing NFLfastR Bronze layer data (no external APIs needed).

**Total Target**: 15-20 new metrics across 4 categories

---

## 📊 Category 1: Red Zone Efficiency (Priority: HIGH)

**Why**: Red zone performance is critical for fantasy scoring and player evaluation. TD conversion rates matter more than raw volume.

### Metrics to Add

#### All Skill Positions:
- `rzSnaps` - Snaps inside opponent 20-yard line
- `rzSnapRate` - % of team's RZ snaps player was on field
- `rzSuccessRate` - Success rate on RZ plays (different threshold than regular plays)

#### QB:
- `rzPassAttempts` - Pass attempts in RZ
- `rzPassTds` - Passing TDs in RZ
- `rzTdRate` - TD rate in RZ (TDs / attempts)
- `rzInterceptions` - INTs in RZ (costly mistakes)

#### RB:
- `rzRushAttempts` - Already exists, verify populated
- `rzRushTds` - Rush TDs in RZ
- `rzRushTdRate` - TD rate on RZ rushes
- `rzTargets` - Targets in RZ
- `rzReceptions` - Receptions in RZ
- `rzRecTds` - Receiving TDs in RZ

#### WR/TE:
- `rzTargets` - Targets in RZ
- `rzReceptions` - Receptions in RZ
- `rzRecTds` - Receiving TDs in RZ
- `rzTargetShare` - % of team's RZ targets
- `rzCatchRate` - Catch rate in RZ (high pressure)

**Data Source**: `raw_data->>'yardline_100' <= 20`

**Estimated Complexity**: Medium (straightforward filters, similar to existing metrics)

**Estimated Time**: 2-3 hours (schema + ETL + testing)

---

## 📊 Category 2: Down & Distance Context (Priority: HIGH)

**Why**: Third down performance separates good players from great ones. Critical for real NFL value.

### Metrics to Add

#### All Skill Positions:
- `thirdDownSnaps` - Snaps on 3rd down
- `thirdDownConversions` - 3rd downs converted (first down or TD)
- `thirdDownConversionRate` - Conversion rate on 3rd down
- `earlyDownSuccessRate` - Success rate on 1st/2nd down
- `lateDownSuccessRate` - Success rate on 3rd/4th down

#### RB Specific:
- `shortYardageAttempts` - Rush attempts on 3rd/4th & <= 2 yards to go
- `shortYardageConversions` - Conversions on short yardage
- `shortYardageRate` - Conversion rate in short yardage

#### WR/TE Specific:
- `thirdDownTargets` - Targets on 3rd down
- `thirdDownReceptions` - Receptions on 3rd down
- `thirdDownConversions` - 3rd down targets that resulted in conversions

**Data Source**:
- `raw_data->>'down'` (1, 2, 3, 4)
- `raw_data->>'ydstogo'` (yards to go)
- `raw_data->>'first_down_pass'`, `raw_data->>'first_down_rush'`

**Estimated Complexity**: Medium (requires down/distance logic)

**Estimated Time**: 2-3 hours

---

## 📊 Category 3: Game Script / Situational (Priority: MEDIUM)

**Why**: Player usage and efficiency changes based on game script. Elite players perform regardless of situation.

### Metrics to Add

#### All Skill Positions:
- `trailingSnaps` - Snaps when trailing by 9+ points
- `leadingSnaps` - Snaps when leading by 9+ points
- `neutralSnaps` - Snaps in one-score game (within 8 points)
- `trailingSuccessRate` - Success rate when trailing (negative game script)
- `leadingSuccessRate` - Success rate when leading (positive game script)

#### RB Specific:
- `trailingTargetShare` - Target share when trailing (pass-catching RBs)
- `leadingCarryShare` - Carry share when leading (clock-killing)

#### WR/TE Specific:
- `trailingTargetShare` - Target share when trailing (volume boost)
- `trailingAdot` - Average depth of target when trailing

**Data Source**:
- `raw_data->>'score_differential'` (positive = leading, negative = trailing)
- Filter garbage time: `raw_data->>'qtr' < 4` OR `ABS(score_differential) < 17`

**Estimated Complexity**: Medium-High (score differential logic, garbage time filtering)

**Estimated Time**: 3-4 hours

**Considerations**:
- Define thresholds: Trailing = -9 or worse, Leading = +9 or better, Neutral = -8 to +8
- Filter garbage time (4th quarter with 17+ point lead/deficit)

---

## 📊 Category 4: Two-Minute & Hurry-Up (Priority: MEDIUM-LOW)

**Why**: High-pressure situations reveal clutch performers. Important for playoffs and close games.

### Metrics to Add

#### All Skill Positions:
- `twoMinuteSnaps` - Snaps in final 2 minutes of half
- `twoMinuteSuccessRate` - Success rate in 2-minute drill
- `hurryUpSnaps` - Snaps in no-huddle/hurry-up offense
- `hurryUpSuccessRate` - Success rate in hurry-up

#### WR/TE Specific:
- `twoMinuteTargets` - Targets in 2-minute drill
- `twoMinuteReceptions` - Receptions in 2-minute drill

**Data Source**:
- `raw_data->>'half_seconds_remaining' <= 120`
- `raw_data->>'no_huddle' = 1` (already using for no_huddle_rate)

**Estimated Complexity**: Low-Medium (time filtering)

**Estimated Time**: 1-2 hours

---

## 🚫 Not in Phase 2 (Requires External APIs)

These are valuable but not achievable with current data:

1. **Target Separation** - Requires NextGen Stats API
2. **Yards After Contact** - Requires PFF API
3. **Broken Tackles** - Requires PFF API
4. **Route Running Win Rate** - Requires NextGen Stats API
5. **Time to Throw** - Requires NextGen Stats API
6. **Pressure Rate** - Requires PFF/NextGen Stats API

**Future Consideration**: If APIs become available, these would be Phase 3+

---

## 📋 Implementation Phases

### Phase 2A: Red Zone & Down/Distance (Week 1)
**Metrics**: 15-18 metrics
**Priority**: HIGH
**Rationale**: Highest fantasy value, most actionable for users

### Phase 2B: Game Script & Situational (Week 2)
**Metrics**: 8-10 metrics
**Priority**: MEDIUM
**Rationale**: Important context, but more complex logic

### Phase 2C: Two-Minute Drill (Optional)
**Metrics**: 4-6 metrics
**Priority**: LOW
**Rationale**: Nice to have, but limited sample size

---

## 🗺️ Detailed Implementation Roadmap

### Step 1: Schema Updates
**Files**: `shared/schema.ts`
- Add all new columns to `datadive_snapshot_player_week` table
- Group by category for clarity
- Add comments for each metric

### Step 2: Bronze Layer Verification
**Action**: Query Bronze to verify all needed fields exist
```sql
-- Verify red zone data
SELECT COUNT(*) FROM bronze_nflfastr_plays
WHERE raw_data->>'yardline_100' IS NOT NULL;

-- Verify down/distance data
SELECT DISTINCT raw_data->>'down' FROM bronze_nflfastr_plays LIMIT 10;
SELECT DISTINCT raw_data->>'ydstogo' FROM bronze_nflfastr_plays LIMIT 10;

-- Verify game script data
SELECT COUNT(*) FROM bronze_nflfastr_plays
WHERE raw_data->>'score_differential' IS NOT NULL;

-- Verify time data
SELECT COUNT(*) FROM bronze_nflfastr_plays
WHERE raw_data->>'half_seconds_remaining' IS NOT NULL;
```

### Step 3: Gold ETL Extensions
**File**: `server/etl/goldDatadiveETL.ts`

**3A: Extend getPlayByPlayStats() function**
- Add red zone aggregations
- Add down/distance aggregations
- Add game script aggregations
- Add two-minute aggregations

**3B: Calculate rates in main loop**
- RZ rates (targets, TDs, success)
- 3rd down rates
- Game script rates
- Two-minute rates

**3C: Add to INSERT statement**
- Add all new columns to INSERT
- Add all new values to VALUES

### Step 4: Database Migration
```bash
npm run db:push
# OR manual ALTER TABLE if needed
```

### Step 5: Testing
```bash
# Run Gold ETL for test week
npx tsx server/etl/goldDatadiveETL.ts 2025 17 17

# Run QA sanity check
npm run qa:gold 2025 17 17

# Manual spot checks
psql $DATABASE_URL -c "
  SELECT player_name, position, rz_targets, rz_rec_tds, third_down_conversion_rate
  FROM datadive_snapshot_player_week
  WHERE season=2025 AND week=17 AND position='WR'
  ORDER BY rz_rec_tds DESC NULLS LAST
  LIMIT 10;
"
```

### Step 6: QA Script Updates
**File**: `server/scripts/qaGoldDatadiveSanityCheck.ts`
- Add null rate checks for new metrics
- Add range checks (rates should be 0-1)
- Add statistical summaries

---

## 📊 Expected Outcomes

### Data Quality
- All new metrics follow same quality standards as Phase 1
- Null rates appropriate for situation (many players won't have RZ snaps)
- All rates bounded 0-1
- Statistics reasonable across positions

### User Value
- **RZ metrics**: Identify TD-dependent vs TD-efficient players
- **3rd down metrics**: Measure "chain-moving" value beyond raw stats
- **Game script**: Understand usage patterns in different situations
- **Two-minute**: Identify clutch performers

### FORGE Integration Potential
- RZ efficiency → Opportunity pillar weight adjustment
- 3rd down rate → Efficiency pillar input
- Game script consistency → Stability pillar input
- Clutch performance → Context-aware alpha adjustments

---

## 🎯 Success Criteria

Phase 2 is complete when:

1. ✅ 15-20 new metrics added to Gold layer
2. ✅ All metrics tested with Week 17 data
3. ✅ QA script passes (100% checks)
4. ✅ Null rates within expected thresholds
5. ✅ Range checks pass for all rate metrics
6. ✅ Statistical summaries look reasonable
7. ✅ Documentation updated (SESSION_STATE.md)
8. ✅ Ready for UI integration

---

## 📝 Notes & Considerations

### Sample Size Concerns
- **RZ snaps**: Many players will have 0 (only ~10-15% of snaps are RZ)
- **3rd down**: Better sample size (~25-30% of snaps)
- **Two-minute**: Very small sample (~5-10% of snaps)
- **Game script**: Depends on game flow (some games never have large leads)

**Solution**: Accept high null rates (50-70% for RZ metrics is normal). Focus on range validation for non-null values.

### Garbage Time Filtering
**Definition**: 4th quarter with 17+ point differential

**Implementation**:
```sql
-- Filter out garbage time
WHERE NOT (
  raw_data->>'qtr' = '4'
  AND ABS((raw_data->>'score_differential')::int) >= 17
)
```

**Rationale**: Prevents stat-padding in blowouts from skewing metrics

### Red Zone Definition
**Standard**: Inside opponent's 20-yard line (`yardline_100 <= 20`)

**Alternative**: Some use 25-yard line, but 20 is industry standard

**Goal Line**: May want separate tracking for `yardline_100 <= 5` (super high-value)

---

## 🚀 Ready to Begin

**Next Steps**:
1. Verify Bronze layer has all required fields
2. Start with Phase 2A (Red Zone + Down/Distance)
3. Schema first, then ETL, then testing
4. Update QA script as we go
5. Commit frequently to avoid losing work to rate limits

**Estimated Total Time**: 8-12 hours across multiple sessions

Let's ship it! 🎉

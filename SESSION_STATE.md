# Session State Tracker
> **Purpose**: Track progress across Claude Code sessions to resume work when rate limits hit

**Last Updated**: 2026-01-09

> **IMPORTANT**: Read `AGENT_README.md` first for constraints, safe scope, and hard rules.

---

## ✅ DATA STATUS NOTE

- Phase 1 metrics: ✅ Complete (all weeks)
- Phase 2A metrics: ✅ Complete (all weeks 1-17)
- Phase 2B (Game Script): ⛔ Not started
- Phase 2C (Two-Minute Drill): ✅ Complete (all weeks 1-17 backfilled)

---

## ✅ Just Completed (This Session)

### ✅ FORGE Weight Recalibration (Based on Correlation Analysis)

**What was done**:
1. ✅ Created `scripts/feature_correlation.py` - analyzes which Gold metrics predict next-week fpts
2. ✅ Updated pillar weights in `server/modules/forge/forgeGrading.ts` based on data
3. ✅ Re-validated with backtest

**Feature Correlation Findings (Week N → Week N+1 fpts)**:
| Position | Top Predictors | Efficiency Correlation |
|----------|----------------|------------------------|
| RB | rush_attempts (0.515), rush_yards (0.465), rz_snap_rate (0.371) | Near-zero (0.019) |
| WR | target_share (0.417), wopr (0.407), targets (0.393) | **NEGATIVE (-0.042)** |
| TE | target_share (0.379), targets (0.359), air_yards (0.325) | Negative |
| QB | yac_per_rec (0.729), yprr (0.685), epa_per_target (0.498) | Positive (0.274) |

**Key Insight**: Volume metrics dominate for RB/WR/TE. Efficiency metrics are noise (or negative!) for pass catchers. QB is the exception - efficiency matters.

**Weight Changes (Redraft mode)**:
| Position | Old Volume | New Volume | Old Efficiency | New Efficiency |
|----------|------------|------------|----------------|----------------|
| WR | 0.45 | **0.55** | 0.30 | **0.15** |
| RB | 0.475 | **0.50** | 0.31 | **0.25** |
| TE | 0.40 | **0.55** | 0.37 | **0.15** |
| QB | 0.29 | **0.25** | 0.41 | **0.45** |

**Backtest Results After Recalibration**:
| Position | Monotonic? | Win vs Naive | Win vs Rolling3 |
|----------|------------|--------------|-----------------|
| RB       | ✅ YES     | 53.4% (+2.0) | 45.7% (+1.2)    |
| WR       | ❌ NO      | **57.3% (+4.0)** | **50.9% (+4.4)** |
| TE       | ❌ NO      | 56.5% (+3.0) | 49.7% (+0.5)    |
| QB       | ✅ YES     | 24.0%        | 21.6%           |

**Key Win**: WR now beats Rolling 3-Week Average >50% of the time. This is a meaningful edge.

**Files Created/Modified**:
- `scripts/feature_correlation.py` - Feature correlation analysis
- `scripts/forge_backtest.py` - Updated with new weights
- `server/modules/forge/forgeGrading.ts` - Updated POSITION_WEIGHTS and DYNASTY_WEIGHTS

---

### ✅ Phase 2C: Two-Minute Drill & Hurry-Up Metrics

**What was done**:
1. ✅ Added Phase 2C columns to database via SQL ALTER TABLE
   - `two_minute_snaps`, `two_minute_successful`, `two_minute_success_rate`
   - `hurry_up_snaps`, `hurry_up_successful`, `hurry_up_success_rate`
   - `two_minute_targets`, `two_minute_receptions` (WR/TE)

2. ✅ Updated GoldPlayerWeek interface with Phase 2C fields

3. ✅ Added getTwoMinuteStats query to Gold ETL
   - Two-minute drill: final 2 minutes of half, close game (≤8 points)
   - Hurry-up: no_huddle plays from NFLfastR
   - Success rate calculated from EPA

**Phase 2C Testing Results** (Week 17, 2025):
- ✅ C.Williams (QB): 16 two-minute snaps, 31.25% success rate
- ✅ A.Rodgers (QB): 16 two-minute snaps, 62.5% success rate, 9 hurry-up snaps
- ✅ C.Ward (QB): 12 two-minute snaps, 41.7% success rate
- ✅ Backfill Weeks 1-17 complete (all 17 weeks have 2-min data)

**Files Modified**:
- `server/etl/goldDatadiveETL.ts` - Added Phase 2C interface, query, and INSERT wiring
- Database: `datadive_snapshot_player_week` table (8 new columns)

---

### ✅ Data Lab UI - FULL Gold Layer Integration

**What was done**:
1. ✅ Updated `PlayerWeekData` interface with ALL Gold layer fields (~70 fields total)
   - Phase 1: xYAC, Run Gap/Location, Target Depth/Location, QB Formation
   - Phase 2A: All RZ and 3rd Down metrics

2. ✅ Added columns to Data Lab table (single week view):
   - **RZ TD** (red) - Combined receiving + rushing TDs in red zone
   - **3D%** (orange) - 3rd down conversion rate

3. ✅ Added comprehensive PlayerDrawer sections:

   **All Positions:**
   - **xYAC Section** (teal): xYAC, YAC vs Expected, xYAC Beat%
   - **Red Zone** (red): RZ Snaps, RZ Tgt, RZ Rec, RZ TDs, RZ Succ%, RZ Tgt Share
   - **3rd Down / Situational** (orange): 3D Snaps, 3D Conv, 3D Conv%, Early Down%, Late Down%

   **WR/TE Specific:**
   - **Target Profile** (indigo): Deep%, Intermediate%, Short%, Catch%, RACR, WOPR, Slot%, Target EPA

   **RB Specific:**
   - **Rush Efficiency**: Stuffed, Stuff%, 1st Downs, 1D Rate
   - **Run Profile** (lime): Inside%, Outside%, Inside Succ%, Outside Succ%, Left/Middle/Right%
   - **Short Yardage** (amber): Attempts, Conversions, Conv%

   **QB Specific:**
   - **QB Profile** (violet): CPOE, Pass aDOT, Deep%, 1D Rate, Shotgun%, No Huddle%, Sack%, Scrambles

4. ✅ Fixed pre-existing bug: removed undefined `fantasyMode` variable

**Files Modified**:
- `client/src/pages/TiberDataLab.tsx`

---

### ✅ QA Script Updated for Phase 2A Validation

**What was done**:
1. ✅ Added Phase 2A null rate checks (RZ + 3rd Down metrics)
2. ✅ Added Phase 2A range checks (rate metrics 0-1, count metrics >= 0)
3. ✅ Added Phase 2A statistical summary (min/max/avg for all positions)
4. ✅ Adjusted null rate thresholds for rate metrics (backup players have sparse data)

**QA Results** (Week 17, 2025):
- 64 total checks, 100% passing
- RZ metrics: 0% null rate on count columns (rz_snaps, rz_targets)
- 3rd Down metrics: 0% null rate on count columns (third_down_snaps)
- Rate metrics have expected null rates (60-82%) for backup players

---

### ✅ VERIFIED: Phase 2A Complete - RZ + 3rd Down Metrics! 🎉

**What was done**:
1. ✅ Added Red Zone (RZ) Efficiency metrics
   - `rz_snaps`, `rz_targets`, `rz_receptions`, `rz_rec_tds`
   - `rz_pass_attempts`, `rz_pass_tds`, `rz_interceptions` (QB)
   - `rz_rush_attempts`, `rz_rush_tds` (RB)
   - `rz_success_rate`, `rz_target_share`
   - Source: `bronze_nflfastr_plays` WHERE `yardline_100 <= 20`

2. ✅ Added Down & Distance Context metrics
   - `third_down_snaps`, `third_down_conversions`, `third_down_conversion_rate`
   - `early_down_success_rate` (1st/2nd down)
   - `late_down_success_rate` (3rd/4th down)
   - `short_yardage_attempts`, `short_yardage_conversions` (RB)
   - `third_down_targets`, `third_down_receptions`, `third_down_rec_conversions` (WR/TE)
   - Source: `raw_data->>'down'` and `raw_data->>'ydstogo'`

3. ✅ Fixed SQL query bugs
   - Changed `touchdown = 1` → `touchdown = true` (boolean column)
   - Changed `interception = 1` → `interception = true` (boolean column)
   - Changed `complete_pass` → `complete_pass = true` (explicit boolean)
   - Simplified RZ query (removed unnecessary position JOIN)

**Phase 2A Testing Results** (Week 17, 2025):
- ✅ ETL completed successfully: 1,816 player records
- ✅ **RZ metrics verified**:
  - J.Chase: 2 RZ snaps, 2 RZ targets, 2 RZ receiving TDs, 100% 3rd down conv
  - D.Goedert: 3 RZ snaps, 3 RZ targets, 1 RZ receiving TD
  - C.Godwin: 1 RZ target, 1 RZ TD, 50% 3rd down conversion rate
  - M.Evans: 1 RZ target, 1 RZ TD, 50% 3rd down conversion rate
- ✅ All boolean comparisons fixed (no more SQL type errors)

**Files Modified**:
- `server/etl/goldDatadiveETL.ts` - Added RZ + 3rd down queries, fixed boolean comparisons
- `shared/schema.ts` - Added ~15 new Phase 2A columns (already existed from prior session)
- Database: `datadive_snapshot_player_week` table (Phase 2A columns populated)

---

## 📊 Progress Summary

### Phase 1: COMPLETE (6/6 Metrics) ✅
1. ✅ Success rate (QB/RB/WR/TE)
2. ✅ xYAC metrics (WR/TE/RB receiving)
3. ✅ Shotgun/No-huddle rates (QB)
4. ✅ Target quality (WR/TE/RB)
5. ✅ Pass location/depth splits (WR/TE)
6. ✅ Run gap/location splits (RB)

**Phase 1 Total: 22 metrics implemented**

### Phase 2A: COMPLETE (RZ + 3rd Down) ✅
1. ✅ Red Zone snaps/targets/TDs (all positions)
2. ✅ RZ success rate and target share
3. ✅ Third down snaps/conversions/rate
4. ✅ Early/late down success rates
5. ✅ Short yardage attempts/conversions (RB)
6. ✅ Third down receiving stats (WR/TE)

**Phase 2A Total: ~15 metrics implemented**

### Phase 2B: PENDING (Game Script Context)
- Score differential impact on usage
- Leading vs trailing stats
- Garbage time identification
- **Status**: Not started

### Phase 2C: COMPLETE (Two-Minute Drill) ✅
- Two-minute snaps, successful plays, success rate
- Hurry-up (no-huddle) snaps and success rate
- WR/TE two-minute targets and receptions
- **Status**: Complete (8 new metrics)

---

## 📋 Next Steps

**Immediate**:
1. ✅ Run full Gold ETL backfill (Weeks 1-17) to populate Phase 2A data for all weeks - DONE
2. ✅ Update QA script to validate Phase 2A metrics - DONE
3. ✅ UI updates to display RZ/3rd down metrics in Data Lab - DONE

**Future**:
4. Phase 2B: Game Script Context metrics (score differential, leading/trailing, garbage time)
5. Phase 2C: Two-Minute Drill metrics (hurry-up offense)
6. FORGE engine restructure - correlate Alpha scores with actual fantasy outcomes (backtesting)
7. Tech debt cleanup pass (fix pre-existing type errors across codebase)
8. Tiber Chat enhancements - intelligent teaching systems for natural language data surfacing

---

## 🔧 Key Commands

```bash
# Run Gold ETL for single week
npx tsx server/etl/goldDatadiveETL.ts 2025 17 17

# Run Gold ETL for all weeks (backfill)
npx tsx server/etl/goldDatadiveETL.ts 2025 1 17

# QA: Run Gold DataDive sanity check
npm run qa:gold                 # Check Week 17, 2025 (default)
npm run qa:gold 2025 14 17      # Check Weeks 14-17, 2025

# Verify Phase 2A RZ metrics
psql $DATABASE_URL -c "SELECT player_name, position, rz_snaps, rz_targets, rz_rec_tds, third_down_conversion_rate FROM datadive_snapshot_player_week WHERE season=2025 AND week=17 AND rz_snaps > 0 ORDER BY rz_rec_tds DESC LIMIT 10;"

# Check database columns
psql $DATABASE_URL -c "\d datadive_snapshot_player_week"

# Start dev server
npm run dev
```

---

## 🚨 Important Context

**Bronze→Silver→Gold Architecture**:
- **Bronze**: Raw NFLfastR data in `bronze_nflfastr_plays.raw_data` (JSONB)
- **Silver**: `silver_player_weekly_stats` (aggregated play-by-play)
- **Gold**: `datadive_snapshot_player_week` (analytics-ready with derived metrics)

**SQL Bug Fixes Applied**:
- Bronze table uses **boolean** columns for `touchdown`, `interception`, `complete_pass`, `first_down_pass`, `first_down_rush`
- Must compare with `= true` not `= 1`
- Silver table uses `position` not `position_abbr`

**All metrics flow to**:
- Data Lab UI (sortable columns)
- FORGE Alpha engine (pillar inputs)
- Chart Builder (X/Y axis options)
- Player cards (contextual stats)

**Data Sources Available**:
- ✅ NFLfastR (play-by-play, snap counts) - **PRIMARY SOURCE**
- ✅ player_usage table (slot rate, inline rate)
- ❌ NextGen Stats (would need API - separation, time to throw)
- ❌ PFF (would need API - broken tackles, yards after contact)

---

## 📝 Session Notes

- Phase 2A now complete with RZ + 3rd Down metrics
- Boolean comparison bugs fixed in SQL queries
- Week 17 data verified with spot checks
- Full backfill for Weeks 1-17 still pending (Phase 2A only in Week 17 currently)
- QA script may need updates to validate new Phase 2A columns

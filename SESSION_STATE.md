# Session State Tracker
> **Purpose**: Track progress across Claude Code sessions to resume work when rate limits hit

**Last Updated**: 2026-01-10 (State Machine Diagrams added)

> **IMPORTANT**: Read `AGENT_README.md` first for constraints, safe scope, and hard rules.

---

## ✅ DATA STATUS NOTE

- Phase 1 metrics: ✅ Complete (all weeks)
- Phase 2A metrics: ✅ Complete (all weeks 1-17)
- Phase 2B (Game Script): ⛔ Not started
- Phase 2C (Two-Minute Drill): ✅ Complete (all weeks 1-17 backfilled)

---

## ✅ Just Completed (This Session)

### ✅ Data Lab Fixes (January 2026)

**Issues Fixed**:
1. **Single-week mode returning 0 routes** - The query was selecting broken snapshots (routes=0 for all players)
2. **Black text in dropdowns** - shadcn components using light mode CSS variables on dark background
3. **Snapshot debug header cluttering UI** - Removed unnecessary "Snapshot #X, 2025 Week Y" card

**Root Causes & Solutions**:

1. **Valid Snapshot Selection** (dataLabRoutes.ts):
   - Week 17 had 14 official snapshots, most broken with routes=0
   - Added CTE to count players with routes > 0 per snapshot
   - Now selects snapshot with highest player_count, falling back to most recent
   ```sql
   WITH valid_snapshots AS (
     SELECT sm.id, sm.week, sm.snapshot_at,
            (SELECT COUNT(*) FROM datadive_snapshot_player_week spw 
             WHERE spw.snapshot_id = sm.id AND spw.week = sm.week AND spw.routes > 0) as player_count
     FROM datadive_snapshot_meta sm
   ),
   best_snapshot AS (
     SELECT id FROM valid_snapshots
     WHERE player_count > 0
     ORDER BY player_count DESC, snapshot_at DESC
     LIMIT 1
   )
   ```

2. **Dark Mode Fix** (main.tsx):
   - Added `document.documentElement.classList.add("dark")` on app load
   - All shadcn components now use `.dark` CSS variables (white text, dark backgrounds)

3. **UI Cleanup** (TiberDataLab.tsx):
   - Removed snapshot meta debug card for cleaner user experience

**Data Quality Note**:
- Weeks 11 and 13 have broken snapshots (routes=0 for all players)
- This limits max GP (Games Played) to 15 instead of 17 for season totals
- Would require Gold ETL rerun for those weeks to fix

**Files Modified**:
- `server/routes/dataLabRoutes.ts` - Valid snapshot selection CTE
- `client/src/main.tsx` - Global dark mode class
- `client/src/pages/TiberDataLab.tsx` - Removed debug header

---

### ✅ State Machine Diagrams for System Architecture

**What was built**:
Comprehensive state machine diagrams documenting all major stateful components in the codebase, rendered as PNG images for easy visualization.

**Diagrams Created** (`docs/diagrams/`):

| # | Diagram | Description | Source File |
|---|---------|-------------|-------------|
| 0 | **System Overview** | Master architecture diagram showing how all components connect | All modules |
| 1 | **Recursive Alpha Engine** | Two-pass scoring with week-over-week state persistence | `recursiveAlphaEngine.ts` |
| 2 | **FORGE ELT Pipeline** | Bronze→Silver→Gold data flow: FetchContext → BuildMetrics → ComputePillars → FootballLens | `forgeEngine.ts` |
| 3 | **Dynasty Context** | Injury-aware QB evaluation with 3 branching paths (HealthyStarter, PartialSeason, PotentialInjury) | `forgeEngine.ts:641-850` |
| 4 | **Start/Sit Decision** | Multi-factor recommendation: BuildProfile → ScoreFactors → Verdict (START/FLEX/SIT) | `startSitAgent.ts` |
| 5 | **Football Lens** | Position-specific rule engine (WR/RB/TE/QB branches → GlobalChecks) | `forgeFootballLens.ts` |
| 6 | **ForgeLab UI** | React component states: Idle → Loading → Loaded with Inspecting/Exporting sub-flows | `ForgeLab.tsx` |

**Files Created**:
- `docs/diagrams/00-system-overview.mmd` + `.png` - Master architecture
- `docs/diagrams/01-recursive-alpha.mmd` + `.png` - FORGE recursive scoring
- `docs/diagrams/02-forge-pipeline.mmd` + `.png` - ELT pipeline
- `docs/diagrams/03-dynasty-context.mmd` + `.png` - Dynasty WR context
- `docs/diagrams/04-start-sit.mmd` + `.png` - Start/sit engine
- `docs/diagrams/05-football-lens.mmd` + `.png` - Position rules
- `docs/diagrams/06-forgelab-ui.mmd` + `.png` - UI state machine
- `docs/state-machine-diagrams.md` - Full documentation with all diagrams in Mermaid format

**Key Architectural Insights Documented**:
- FORGE uses **week-over-week state persistence** (alphaPrev, momentum, volatility stored in `forge_player_state`)
- Dynasty context has **injury-aware branching** - detects when franchise QB is injured and adjusts weights
- Football Lens applies **position-specific rules** before global checks
- Frontend components follow **Idle → Loading → Loaded** pattern with sub-states for inspection/export

**Rendering Method**: Kroki.io API with zlib compression for PNG generation

---

### ✅ FORGE Transparency ID Resolution Fix

**Issue**: The FORGE transparency page (`/forge`) was showing "NA" and blank values for all metrics - player name was "Unknown", games played was 0, alpha scores were incorrect, and all pillar metrics showed null values.

**Root Cause**: 
- Role bank tables (`wr_role_bank`, `rb_role_bank`, etc.) and `weekly_stats` use **GSIS IDs** (format: `00-0036900`)
- The FORGE engine was querying using **canonical IDs** (format: `jamarr-chase`)
- No ID translation was happening, so all queries returned empty results

**Fix Applied** (in `server/modules/forge/forgeEngine.ts`):
1. Updated `fetchRoleBankData()` to first lookup GSIS ID from `player_identity_map`
2. Updated `fetchForgeContext()` to translate canonical ID → GSIS ID before querying `weekly_stats`
3. Both functions now use `nfl_data_py_id` (or `gsis_id` fallback) for data table queries
4. Graceful fallback to canonical ID if no mapping exists

**Before Fix**:
```
Ja'Marr Chase: Name="Unknown", GP=0, Alpha=48.5, Tier=T4
Volume/Efficiency: All metrics = null
```

**After Fix**:
```
Ja'Marr Chase: Name="Ja'Marr Chase", GP=15, Alpha=77, Tier=T2
Volume: score=81.8, Volume Score=85, Targets/Game=11.7
Efficiency: score=55.3, Efficiency Score=60
```

**Files Modified**:
- `server/modules/forge/forgeEngine.ts` - Added ID translation layer in `fetchRoleBankData()` and `fetchForgeContext()`

**Commit**: `6a78e5c2` - "Update player data retrieval to use GSIS IDs for accurate statistics"

**Future Optimization**: Consider hoisting the `player_identity_map` lookup to a single call per request to avoid duplicate queries (currently fetches GSIS ID separately in both functions).

---

### ✅ FORGE Transparency Page (`/forge`)

**What was built**:
A new public-facing page that exposes exactly how FORGE scores a player - complete transparency with no black box.

**Backend API** (`server/modules/forge/routes.ts`):
- Added `GET /api/forge/transparency/:playerId` endpoint
- Returns comprehensive scoring breakdown:
  - Player info (id, name, position, team)
  - Alpha scores (raw pass 0, final pass 1, tier)
  - Pillar breakdown with contributing metrics and weights
  - Recursion data (volatility, momentum, stability adjustment, expected alpha)
  - Weekly alpha history for trend charts
  - Football lens issues/flags
  - Auto-generated plain English summary

**Frontend Page** (`client/src/pages/ForgeTransparency.tsx`):
- **Header**: "FORGE Transparency" with tagline "See exactly how every score is calculated"
- **Player Search**: Autocomplete using `/api/forge/search-players` endpoint
- **Week Selector**: Dropdown for weeks 1-17
- **Alpha Score Hero**: Large score display with progress bar, tier badge, position badge
- **Pillar Breakdown**: 4 expandable cards (Volume, Efficiency, Team Context, Stability)
  - Each shows score, weight%, visual bar, and contributing metrics
- **Recursive Adjustments Panel**:
  - Shows volatility, momentum, stability adjustment
  - Math breakdown: Raw + Adjustment = Final
- **Weekly Trend Chart**: Recharts line chart showing alpha over weeks
- **Football Lens Flags**: Visual display of detected issues
- **Plain English Summary**: Human-readable explanation of the score

**Route Registration** (`client/src/App.tsx`):
- Added `/forge` route pointing to ForgeTransparency component

**Helper Functions Added**:
- `buildPillarBreakdown()` - Constructs pillar data with metric details
- `formatMetricName()` - Converts metric keys to human-readable names
- `generatePlainEnglishSummary()` - Template-based score explanation

**UI/UX**:
- Dark theme consistent with TIBER brand (`bg-[#0a0e1a]`, `bg-[#141824]`)
- Purple/teal gradient accents for score visualization
- Position badges with color coding (QB=red, RB=green, WR=blue, TE=yellow)
- Mobile responsive design with stacking layout

**Files Created/Modified**:
- `client/src/pages/ForgeTransparency.tsx` - **NEW** (614 lines)
- `server/modules/forge/routes.ts` - Added transparency endpoint (+327 lines)
- `client/src/App.tsx` - Added route (+4 lines)

**Commit**: `f1c3ed50` - "Add a page to display detailed player scoring calculations"

---

### ✅ Data Lab GP (Games Played) Display Fix (Previous)

**Issues Identified**:
1. **GP was capped at 10** - The search query grouped by both `player_id` AND `player_name`, causing players with name variations (e.g., "C.McCaffrey" vs "Christian McCaffrey") to be split into separate aggregations.
2. **Single week filter showed inflated values** - Multiple official snapshots existed per week (14 snapshots for week 17 alone), and the query was summing data across ALL snapshots instead of using just one per week.
3. **Empty data for single week mode** - When selecting the "latest" snapshot per week, it picked broken/incomplete snapshots that had 0 routes data.

**Root Causes**:
- `GROUP BY spw.player_id, spw.player_name` → split data for players with name variations
- `SELECT DISTINCT sm.id` without DISTINCT ON(week) → selected ALL snapshots per week
- Some snapshots (especially newer ones) have broken/empty data (routes = 0 for all players)

**Fixes Applied** (in `server/routes/dataLabRoutes.ts`):
1. Changed `GROUP BY spw.player_id, spw.player_name` → `GROUP BY spw.player_id` with `MAX(spw.player_name)`
2. Added CTE to select ONE snapshot per week (the one with highest player_count with routes > 0)
3. Query now uses `valid_snapshots` CTE that counts players_with_routes per snapshot, then picks best snapshot per week

**Before**:
```sql
WITH snapshot_weeks AS (
  SELECT DISTINCT sm.id as snapshot_id, sm.week
  FROM datadive_snapshot_meta sm
  WHERE ...
)
...
GROUP BY spw.player_id, spw.player_name
```

**After**:
```sql
WITH valid_snapshots AS (
  SELECT sm.id, sm.week, sm.snapshot_at,
         (SELECT COUNT(*) FROM datadive_snapshot_player_week spw 
          WHERE spw.snapshot_id = sm.id AND spw.week = sm.week AND spw.routes > 0) as player_count
  FROM datadive_snapshot_meta sm
  WHERE ...
),
snapshot_weeks AS (
  SELECT DISTINCT ON (week) id as snapshot_id, week
  FROM valid_snapshots
  WHERE player_count > 0
  ORDER BY week, player_count DESC, snapshot_at DESC
)
...
GROUP BY spw.player_id
```

**Results**:
- Season mode: McCaffrey shows GP=13 (correct - he missed weeks 11-14 with injury)
- Single week mode: Chris Olave shows 11 targets, 25.9 FPTS for Week 17 (realistic single-game numbers)

---

## 🔧 Known Data Quality Issues

### Multiple Official Snapshots Per Week
- Week 17 has 14 official snapshots, most with broken data (routes = 0)
- Only snapshot ID 73 (oldest) has real routes data for week 17
- **Impact**: Queries must select the "best" snapshot per week, not just any official one
- **Future Fix**: Clean up broken snapshots or add data quality validation to snapshot creation

---

## ✅ Previously Completed

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
# Regenerate state machine diagrams (if mermaid files updated)
cd docs/diagrams && for f in *.mmd; do
  base="${f%.mmd}"
  encoded=$(cat "$f" | python3 -c "import sys, base64, zlib; print(base64.urlsafe_b64encode(zlib.compress(sys.stdin.read().encode(), 9)).decode())")
  curl -sL "https://kroki.io/mermaid/png/${encoded}" -o "${base}.png"
done

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

**Player ID Resolution Pattern**:
- **Canonical IDs**: Human-readable slugs (e.g., `jamarr-chase`) used in URLs and frontend
- **GSIS IDs**: NFL's official IDs (e.g., `00-0036900`) used in role_bank tables and weekly_stats
- **Translation**: `player_identity_map.canonical_id` → `player_identity_map.nfl_data_py_id` (GSIS)
- **Critical**: Any FORGE/analytics query against role_bank or weekly_stats MUST translate canonical→GSIS first

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

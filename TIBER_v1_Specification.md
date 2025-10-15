# TIBER v1 Specification
**Tactical Index for Breakout Efficiency and Regression**

---

## Overview

TIBER is a volatility and regression analysis module designed to quantify player breakout potential and regression risk using multi-source contextual NFL data. The goal is to provide fantasy football users with a simple 0-100 score that answers critical decision-making questions.

**Core Philosophy:** 
Tactical balance between hype and truth. TIBER is a fluid analytical organism that transforms NFLfastR play-by-play data into clear buy/sell/hold signals with transparent reasoning.

---

## User Questions TIBER Answers

1. **Start/Sit Decisions**
   - Player compare feature combining matchup data + TIBER scores
   - Output: "Start Player A: Better matchup + stable usage (TIBER: 78)"

2. **Waiver Wire Intelligence**
   - Identify players rising in usage (NFLfastR snap %) with low roster %
   - Context flags: Injury replacement vs role expansion vs matchup spike
   - Output: TIBER sustainability score → bid or skip

3. **Trade Analysis**
   - Player compare with ROS (rest of season) context
   - Dynasty factors: Age, contract, team environment
   - Output: TIBER trend arrows (Rising ↗️ vs Regressing ↘️)

---

## TIBER Score Formula (0-100)

### Inputs & Weights

**1. EPA Efficiency (40% weight)**
- **Source:** NFLfastR play-by-play data (Week 1-6 currently loaded)
- **Metrics:**
  - EPA per play (rushing plays)
  - EPA per target (receiving plays)
  - Trend analysis: 3-week rolling average vs season average
- **Logic:** Higher EPA = more efficient production = sustainable

**2. Usage Volatility (30% weight)**
- **Source:** NFLfastR snap counts + target/carry distribution
- **Metrics:**
  - Snap % trends (week-to-week variance)
  - Target share or carry share consistency
  - Sudden spikes flag matchup anomalies vs organic growth
- **Logic:** Consistent usage = stable role; volatile usage = regression risk

**3. TD Regression Flag (20% weight)**
- **Source:** NFLfastR scoring plays + red zone usage
- **Metrics:**
  - TD rate (TDs per target or per carry)
  - League average comparison (>15% TD rate = unsustainable)
  - Red zone usage vs TD production ratio
- **Logic:** Abnormally high TD rates regress to mean

**4. Team Context (10% weight)**
- **Source:** Aggregated NFLfastR team offense EPA
- **Metrics:**
  - Team offensive EPA ranking (1-32)
  - Role change context: Injury replacement vs organic expansion
  - Offense trending up/down
- **Logic:** Rising offense lifts all players; injury fill-ins may not stick

---

## Scoring Scale

| Score Range | Rating | Color | Interpretation |
|-------------|--------|-------|----------------|
| **80-100** | 🟢 Breakout Candidate | Green | High efficiency + rising usage + sustainable TDs = BUY/HOLD |
| **50-79** | 🟡 Stable/Neutral | Yellow | Average metrics, no major red flags = HOLD |
| **0-49** | 🔴 Regression Risk | Red | Low efficiency OR volatile usage OR TD regression = SELL |

---

## Example Calculations

### Player A: Breakout Candidate (TIBER Score: 87)
- **EPA Efficiency:** 0.28 EPA/target (top 15%) → **38/40 points**
- **Usage Volatility:** Snap % rising steadily (45% → 58% → 65%) → **28/30 points**
- **TD Regression:** 12% TD rate (league avg 11%) → **18/20 points**
- **Team Context:** Offense ranked 8th in EPA, organic role growth → **9/10 points**
- **Total: 87/100** → 🟢 Breakout Candidate

### Player B: Regression Risk (TIBER Score: 38)
- **EPA Efficiency:** 0.15 EPA/target (below average) → **22/40 points**
- **Usage Volatility:** Erratic snaps (62% → 38% → 71%) → **12/30 points**
- **TD Regression:** 22% TD rate (way above 11% avg) → **4/20 points**
- **Team Context:** Filled in for injury, starter returning → **3/10 points**
- **Total: 41/100** → 🔴 Regression Risk

---

## Data Sources

### Primary Data Pipeline
1. **NFLfastR Play-by-Play** (Bronze Layer)
   - Source: `https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_2025.parquet`
   - Current Coverage: Week 1-6 (16,011 plays)
   - Schema: `bronzeNflfastrPlays` table with composite unique (game_id, play_id)

2. **Player Identity Mapping**
   - Service: `PlayerIdentityService`
   - Maps Sleeper/Fantasy IDs → NFLfastR IDs
   - API: `/api/player-identity/player/:canonicalId`

3. **Sleeper API Integration**
   - Roster % data for waiver wire intelligence
   - League sync for user rosters
   - Routes: `/api/sleeper/*`

### Supporting Data
- **DvP (Defense vs Position):** Existing matchup ratings API at `/api/dvp/*`
- **SOS (Strength of Schedule):** Team analytics API at `/api/sos/*`
- **OVR Ratings:** Madden-style player ratings at `/api/ovr/*`

---

## Implementation Architecture

### Backend Components Needed
1. **TIBER Calculation Engine** (`server/services/tiberService.ts`)
   - Calculate EPA efficiency scores from NFLfastR data
   - Analyze usage volatility (snap % variance)
   - Flag TD regression candidates
   - Weight team context factors
   - Output: TIBER score (0-100) + breakdown

2. **TIBER API Routes** (`server/routes/tiberRoutes.ts`)
   - `GET /api/tiber/score/:playerId` - Single player TIBER score
   - `GET /api/tiber/compare?playerA=:id1&playerB=:id2` - Compare two players
   - `GET /api/tiber/waivers?position=:pos&threshold=:score` - Waiver wire candidates
   - `GET /api/tiber/league/:leagueId/roster/:rosterId` - Team TIBER analysis

3. **Database Schema** (if needed)
   - Consider caching calculated TIBER scores
   - Historical TIBER tracking for trend analysis

### Frontend Components Needed
1. **TIBER Score Badge** - Display on player cards (0-100 with color coding)
2. **Player Compare View** - Side-by-side with TIBER breakdown
3. **Waiver Wire Intelligence Page** - Rising usage + TIBER sustainability
4. **Trade Analyzer** - ROS context + TIBER trends

---

## Open Questions for Review

1. **Weighting Accuracy:** Are the weights (40% EPA, 30% Usage, 20% TD, 10% Team) appropriate, or should they be adjusted?

2. **Additional Metrics:** Should we add YPRR (Yards Per Route Run) for WRs/TEs?

3. **Position-Specific Scoring:** Should QBs, RBs, WRs, TEs have different formulas, or one universal score?

4. **Historical Baseline:** Use 2024 data to establish league averages and thresholds, or start fresh with 2025?

5. **Update Frequency:** Calculate TIBER scores weekly after games? Daily with new data imports?

6. **Roster % Integration:** How should Sleeper roster % factor into waiver wire scoring? Higher undiscovered value if low roster%?

---

## Success Metrics

**TIBER v1 is successful if:**
1. Users can see a simple 0-100 score on any player
2. Score accurately predicts breakout/regression trends
3. Waiver wire recommendations surface hidden gems
4. Start/Sit decisions have clear TIBER-driven reasoning
5. All scoring logic is transparent (no black box)

---

## Next Steps After Review

1. Finalize scoring weights and formula
2. Build TIBER calculation engine
3. Create API endpoints
4. Design UI components
5. Test with known 2024 breakouts/busts for validation
6. Launch TIBER v1 to users

---

**Version:** 1.0  
**Date:** October 15, 2025  
**Status:** Specification Draft - Awaiting Agent Review

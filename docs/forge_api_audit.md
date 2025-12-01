# FORGE API Audit - Complete Data Flow Analysis

**Generated:** December 2025  
**Version:** FORGE v0.2  
**Purpose:** Comprehensive inventory of all TIBER/FORGE APIs organized by data dependency layer

---

## Dependency Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LAYER 5: CONSUMER ENDPOINTS                           │
│  /api/forge/preview  /api/forge/batch  /api/forge/score/:id  /api/forge/sos/*  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 4: FORGE SCORING ENGINE                          │
│   alphaEngine.ts → calculateAlphaScore() → subScores → rawAlpha → calibrated   │
│   Features: volume, efficiency, roleLeverage, stability, contextFit            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 3: DERIVED METRICS                                │
│   FPR (Fibonacci Pattern)  │  SoS (Strength of Schedule)  │  DvP (Def vs Pos)  │
│   environmentService.ts    │  sosService.ts               │  matchupService.ts │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LAYER 2: RAW STATS                                    │
│   weekly_stats  │  game_logs  │  player_season_2024  │  player_advanced_2024   │
│   (nfl-data-py) │  (Sleeper)  │  (nfl-data-py)       │  (nfl-data-py)          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: FOUNDATION                                     │
│   player_identity_map  │  schedule  │  forge_team_env_context  │  teams        │
│   PlayerIdentityService│  NFLverse  │  forge_team_matchup_ctx  │  Sleeper API  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Foundation

### 1.1 Player Identity

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forge/search-players` | GET | Search players by name, returns basic identity info |
| `/api/forge/player-context/:playerId` | GET | Full player context with identity resolution |
| `/api/sync/sleeper-identity/*` | Various | Sleeper identity sync endpoints |

**Key Service:** `PlayerIdentityService.ts`
- Canonical ID resolution across platforms (Sleeper, NFL-Data-Py, etc.)
- Name fingerprint matching for deduplication
- External ID mapping: `sleeper_id`, `nfl_data_py_id`, `espn_id`

**Database Table:** `player_identity_map`
```
Fields: canonical_id, full_name, position, nfl_team, sleeper_id, nfl_data_py_id, 
        name_fingerprint, merged_into, is_active, data_completeness
```

**Upstream:** None (foundation layer)  
**Downstream:** All FORGE scoring endpoints

---

### 1.2 Schedule

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/schedule/:season/:week` | GET | Get schedule for specific week |
| `/api/schedule/sync` | POST | Sync schedule from NFLverse |

**Database Table:** `schedule`
```
Fields: season, week, home_team, away_team, game_date, game_time
```

**Upstream:** NFLverse data (nfl-data-py)  
**Downstream:** SoS calculations, matchup context

---

### 1.3 Team Environment Context

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forge/env` | GET | Single team environment score |
| `/api/forge/env/all` | GET | All 32 teams environment scores |
| `/api/forge/env-debug` | GET | Debug breakdown of env calculation |
| `/api/forge/env-season` | GET | Season-level environment data |

**Database Table:** `forge_team_env_context`
```
Fields: team, season, week, env_score_100, pace, proe, ol_grade, qb_stability, 
        red_zone_efficiency, scoring_environment
```

**Response Structure:**
```json
{
  "team": "KC",
  "env_score_100": 72,
  "env_multiplier": 1.044,
  "components": { "pace": 0.65, "proe": 0.48, ... }
}
```

---

### 1.4 Team Matchup Context

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forge/matchup` | GET | Single matchup score (offense vs defense) |
| `/api/forge/matchup/defense` | GET | All position matchups for a defense |
| `/api/forge/matchup-debug` | GET | Debug breakdown of matchup calculation |
| `/api/forge/matchups` | GET | All weekly matchup cards |

**Database Table:** `forge_team_matchup_context`
```
Fields: season, week, offense_team, defense_team, position, matchup_score_100, 
        defense_rank, fantasy_points_allowed
```

---

## Layer 2: Raw Stats

### 2.1 Weekly Stats

**Database Table:** `weekly_stats`
```
Fields: player_id, season, week, fantasy_points_ppr, targets, receptions, 
        receiving_yards, receiving_tds, rush_attempts, rushing_yards, rushing_tds,
        passing_yards, passing_tds, interceptions, snap_pct
```

**Source:** nfl-data-py weekly player data  
**Player ID Format:** GSIS ID (e.g., `00-0036900`)  
**Used By:** 
- `forgeService.getForgeScoresBatch()` - fetches top players by fantasy points
- `contextFetcher.fetchFromWeeklyStats()` - season aggregation

---

### 2.2 Game Logs

**Database Table:** `game_logs`
```
Fields: player_id, season, week, fantasy_points_ppr, targets, receptions,
        receiving_yards, rush_attempts, rushing_yards, completions, pass_attempts
```

**Source:** Sleeper API game log data  
**Used By:**
- FPR (Fibonacci Pattern Resonance) calculations
- Weekly volatility analysis

---

### 2.3 Player Season 2024

**Database Table:** `player_season_2024`
```
Fields: player_id, games, targets, receptions, receiving_yards, receiving_tds,
        rush_attempts, rushing_yards, rushing_tds, routes, snap_count
```

**Source:** nfl-data-py seasonal aggregates  
**Used By:** 
- Role metrics (routeRate calculation)
- Historical baseline comparisons

---

### 2.4 Advanced Metrics

**Database Table:** `player_advanced_2024`
```
Fields: player_id, adot, yac, target_share, air_yards_share, wopr, racr
```

**Source:** nfl-data-py advanced metrics  
**Used By:** Efficiency sub-score calculations

---

## Layer 3: Derived Metrics

### 3.1 FPR (Fibonacci Pattern Resonance)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forge/fpr/:playerId` | GET | FPR analysis for player usage patterns |

**File:** `fibonacciPatternResonance.ts`

**Calculation:**
1. Fetches weekly usage history (targets, carries, etc.)
2. Computes week-over-week ratios
3. Matches ratios to Fibonacci targets (φ=1.618, 1/φ=0.618, 1.0)
4. Calculates resonance score based on deviation from target

**FPR Bands:**
| Score Range | Band |
|-------------|------|
| ≥ 85 | HIGH_RESONANCE |
| ≥ 60 | MEDIUM |
| ≥ 30 | LOW |
| < 30 | NOISE |

**Response Structure:**
```json
{
  "fpr": {
    "score": 72.5,
    "pattern": "FIB_GROWTH",
    "band": "MEDIUM",
    "forgeConfidenceModifier": 1.08,
    "forgeVolatilityIndex": 0.23
  }
}
```

---

### 3.2 Strength of Schedule (SoS)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/forge/sos/team-position` | GET | Team + position SoS |
| `/api/forge/sos/player/:playerId` | GET | Player-specific SoS |
| `/api/forge/sos/rankings` | GET | All teams ranked by SoS |

**File:** `sosService.ts`

**Calculation:**
1. Looks up remaining schedule from `schedule` table
2. For each opponent, fetches defense rating from `forge_team_matchup_context`
3. Averages opponent ratings for RoS, Next 3, and Playoffs (weeks 15-17)
4. Converts to 0-100 scale (higher = easier schedule)

**SoS Multiplier:**
```typescript
// sosNorm: 0-1 scale where 0.5 = neutral
const sosMultiplier = 0.90 + (sosNorm * 0.20);  // Range: 0.90 - 1.10
const adjustedAlpha = baseAlpha * sosMultiplier;
```

**Response Structure:**
```json
{
  "meta": { "team": "DAL", "position": "WR", "remainingWeeks": 6 },
  "sos": {
    "ros": 68,      // 0-100, higher = easier
    "next3": 72,
    "playoffs": 45
  }
}
```

---

### 3.3 Defense vs Position (DvP)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dvp/rankings` | GET | All teams ranked by fantasy points allowed |
| `/api/dvp/team/:teamCode` | GET | Single team DvP breakdown |

**Database Table:** `defense_vs_position_stats`
```
Fields: defense_team, position, season, games_played, fantasy_pts_ppr, 
        avg_pts_per_game_ppr, rank
```

**Source:** Calculated from NFLfastR play-by-play data

---

## Layer 4: FORGE Scoring Engine

### 4.1 Sub-Score Calculation

**File:** `alphaEngine.ts` → `calculateSubScores()`

| Sub-Score | Weight (WR) | Weight (RB) | Weight (TE) | Weight (QB) |
|-----------|-------------|-------------|-------------|-------------|
| Volume | 0.35 | 0.38 | 0.30 | 0.25 |
| Efficiency | 0.30 | 0.25 | 0.28 | 0.35 |
| RoleLeverage | 0.18 | 0.20 | 0.25 | 0.15 |
| Stability | 0.12 | 0.12 | 0.10 | 0.10 |
| ContextFit | 0.05 | 0.05 | 0.07 | 0.15 |

**Feature Files:**
- `features/wrFeatures.ts` - WR-specific calculations
- `features/rbFeatures.ts` - RB-specific calculations  
- `features/teFeatures.ts` - TE-specific calculations
- `features/qbFeatures.ts` - QB-specific calculations

---

### 4.2 Alpha Calculation Pipeline

```
rawAlpha = Σ(subScore × weight)
    ↓
modifiedAlpha = applyForgeModifiers(rawAlpha, env, matchup)
    ↓
calibratedAlpha = calibrateAlpha(position, modifiedAlpha)
    ↓
finalAlpha = applySosMultiplier(calibratedAlpha, sosRos)
```

**Calibration Parameters (types.ts):**
```typescript
ALPHA_CALIBRATION = {
  WR: { p10: 30, p90: 52, outMin: 25, outMax: 90 },  // Remaps 30-52 → 25-90
  RB: { p10: 24, p90: 48, outMin: 25, outMax: 90 },  // Remaps 24-48 → 25-90
  TE: undefined,  // Pass-through (NO CALIBRATION)
  QB: undefined,  // Pass-through (NO CALIBRATION)
}
```

---

### 4.3 Confidence Scoring

**File:** `alphaEngine.ts` → `calculateConfidence()`

**Factors:**
- Games played (more games = higher confidence)
- Data quality flags (advanced stats, snap data, DvP data)
- FPR volatility index
- Missing data caps

---

### 4.4 Trajectory Detection

**Thresholds (types.ts):**
```typescript
TRAJECTORY_THRESHOLDS = {
  risingMinDelta: 0.15,   // 15% improvement = rising
  decliningMaxDelta: -0.10  // 10% decline = declining
}
```

Compares recent 3-week average to season average.

---

## Layer 5: Consumer Endpoints

### 5.1 Preview (Main Rankings)

| Endpoint | `/api/forge/preview` |
|----------|---------------------|
| Method | GET |
| Query Params | `position`, `season`, `week`, `limit`, `minGamesPlayed`, `minConfidence` |

**Description:** Primary rankings endpoint. Uses weekly_stats-ranked player pool (sorted by fantasy points).

**Upstream Dependencies:**
- `forgeService.getForgeScoresBatch()` → Layer 4
- `enrichWithSoS()` → Layer 3 SoS
- `fetchPlayerIdsForBatch()` → Layer 2 weekly_stats

**Response Structure:**
```json
{
  "success": true,
  "meta": {
    "position": "WR",
    "season": 2025,
    "returnedCount": 50,
    "sosIntegrated": true
  },
  "scores": [
    {
      "playerId": "jaxon-smith-njigba",
      "playerName": "Jaxon Smith-Njigba",
      "position": "WR",
      "alpha": 89.5,
      "alphaBase": 88.2,
      "subScores": { "volume": 82, "efficiency": 91, ... },
      "gamesPlayed": 10,
      "confidence": 70,
      "trajectory": "rising",
      "sosRos": 65,
      "sosMultiplier": 1.03
    }
  ]
}
```

---

### 5.2 Single Player Score

| Endpoint | `/api/forge/score/:playerId` |
|----------|------------------------------|
| Method | GET |
| Path Params | `playerId` (canonical ID) |
| Query Params | `season`, `week` |

**Description:** Get FORGE score for a specific player with full sub-score breakdown.

---

### 5.3 Batch Scoring

| Endpoint | `/api/forge/batch` |
|----------|-------------------|
| Method | GET |
| Query Params | `position`, `limit`, `season`, `week` |

**Description:** Batch scoring for multiple players. Similar to preview but allows higher limits (up to 500).

---

### 5.4 Player Context

| Endpoint | `/api/forge/player-context/:playerId` |
|----------|---------------------------------------|
| Method | GET |
| Path Params | `playerId` |
| Query Params | `season` |

**Description:** Comprehensive player profile including identity, stats, game logs, FORGE alpha, and environment/matchup modifiers.

---

## Known Issues & Technical Debt

### Issue 1: roleLeverage Returns 50 for All Players

**Location:** `context/contextFetcher.ts` → `fetchRoleMetrics()`

**Root Cause:** Role metrics (slotRate, deepTargetShare, redZoneRouteShare, backfieldTouchShare, etc.) are not being populated from any data source. The function has a `TODO` comment and returns mostly `undefined` values.

**Impact:** When roleMetrics are undefined, feature builders default to `50` (neutral score), making roleLeverage meaningless across all players.

**Fix Required:** Wire `fetchRoleMetrics()` to actual snap/route data when available.

---

### Issue 2: QB/TE Alpha Scores Not Calibrated

**Location:** `types.ts` → `ALPHA_CALIBRATION`

**Root Cause:** 
```typescript
TE: undefined,  // Pass-through
QB: undefined,  // Pass-through
```

**Impact:** QB/TE raw alphas (~45-50) are not expanded to the 0-90 scale like WR/RB, causing them to appear much lower (Mahomes 49.1 vs Achane 90.4).

**Fix Required:** Define calibration parameters for QB/TE based on observed p10/p90 distributions:
```typescript
TE: { p10: 25, p90: 45, outMin: 25, outMax: 90 },
QB: { p10: 28, p90: 48, outMin: 25, outMax: 90 },
```

---

### Issue 3: Legacy Sandbox Endpoints Still Active

**Location:** `server/infra/apiRegistry.ts` lines 216-256

**Endpoints:**
- `/api/admin/wr-rankings-sandbox`
- `/api/admin/rb-rankings-sandbox`
- `/api/admin/te-rankings-sandbox`
- `/api/admin/qb-rankings-sandbox`

**Status:** These provide experimental alpha scoring separate from FORGE. Consider deprecating or consolidating with FORGE.

---

### Issue 4: rawAlpha vs alphaBase Confusion

**Clarification:**
- **rawAlpha**: Pre-calibration weighted sum of sub-scores (in `ForgeScore.rawAlpha`)
- **alphaBase**: Pre-SoS alpha after calibration (added by `enrichWithSoS()` in routes.ts)

Both are still in use:
- `rawAlpha` for debugging calibration tuning
- `alphaBase` for SoS transparency in consumer endpoints

---

### Issue 5: Missing Snap Data Pipeline

**Current State:** `hasSnapData` flag is often `false` because snap data isn't being ingested consistently.

**Impact:** 
- roleLeverage sub-score capped
- Confidence scores reduced
- Feature calculations fall back to neutral values

**Data Sources Needed:**
- nfl-data-py snap counts
- Sleeper snap percentages

---

## Appendix: Complete Endpoint Registry

| Key | Path | Layer | Tags |
|-----|------|-------|------|
| forge_preview | /api/forge/preview | 5 | core, rankings |
| forge_score_player | /api/forge/score/:playerId | 5 | core, player |
| forge_batch | /api/forge/batch | 5 | core, rankings |
| forge_health | /api/forge/health | 5 | system |
| forge_player_context | /api/forge/player-context/:playerId | 5 | player, profile |
| forge_search_players | /api/forge/search-players | 1 | utility |
| forge_env | /api/forge/env | 3 | environment |
| forge_env_all | /api/forge/env/all | 3 | environment |
| forge_env_debug | /api/forge/env-debug | 3 | debug |
| forge_matchup | /api/forge/matchup | 3 | matchup |
| forge_matchup_defense | /api/forge/matchup/defense | 3 | matchup |
| forge_matchups_all | /api/forge/matchups | 3 | matchup, weekly |
| forge_fpr | /api/forge/fpr/:playerId | 3 | analysis, pattern |
| forge_sos_team_position | /api/forge/sos/team-position | 3 | sos, schedule |
| forge_sos_player | /api/forge/sos/player/:playerId | 3 | sos, player |
| forge_sos_rankings | /api/forge/sos/rankings | 3 | sos, rankings |
| forge_debug_distribution | /api/forge/debug/distribution | 4 | debug, calibration |
| dvp_rankings | /api/dvp/rankings | 3 | dvp, defense |
| dvp_team | /api/dvp/team/:teamCode | 3 | dvp, defense |
| schedule_week | /api/schedule/:season/:week | 1 | schedule |
| schedule_sync | /api/schedule/sync | 1 | schedule, admin |
| tiber_player | /api/tiber/:playerId | 5 | player, profile |

---

## Next Steps

1. **Fix roleLeverage** - Wire snap/route data to `fetchRoleMetrics()`
2. **Calibrate QB/TE** - Define calibration params based on distribution analysis
3. **Consolidate Sandbox** - Merge sandbox logic into FORGE or deprecate
4. **Snap Data Pipeline** - Establish reliable snap ingestion from nfl-data-py
5. **API Versioning** - Consider versioning consumer endpoints (v1, v2)

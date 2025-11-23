# WR Role Bank v1.1 - Complete Computation Specification & Audit

**Version**: v1.1 (Deep Target Integration)  
**Date**: November 23, 2025  
**Purpose**: Objective player role evaluation using play-by-play deep target data (20+ air yards)

---

## 1. Data Inputs (Source Tables & Fields)

### 1.1 Primary Source: `weekly_stats` Table
- **playerId**: NFLfastR player identifier (e.g., "00-0036900")
- **season**: NFL season year (e.g., 2025)
- **week**: Game week number (1-18)
- **team**: Team abbreviation (e.g., "CIN", "DAL")
- **targets**: Total passes thrown to this player in the week
- **routes**: Total routes run by the player (from NFLfastR snap data)
- **fantasyPointsPpr**: PPR fantasy points scored in the week

### 1.2 Secondary Source: `player_usage` Table (LEFT JOIN)
- **targetSharePct**: Player's share of team targets (stored as 0-100, converted to 0-1)
- **routesSlot**: Estimated routes run from slot alignment
- **routesOutside**: Estimated routes run from outside alignment
- **routesInline**: Estimated routes run from inline alignment (rarely used for WR)

### 1.3 Tertiary Source: `bronze_nflfastr_plays` Table (Play-by-Play)
- **receiver_player_id**: NFLfastR ID of the target receiver
- **season**: NFL season year
- **week**: Game week number
- **play_type**: Must be 'pass' for target plays
- **complete_pass**: Boolean indicating completion
- **incomplete_pass**: Boolean indicating incompletion
- **air_yards**: Depth of target in yards (distance from line of scrimmage to catch/incompletion point)
- **deep_targets_20_plus**: COUNT of targets where air_yards >= 20 (calculated field)

**Critical Join Logic**: Deep targets are joined by (playerId, season, week). Weeks without play-by-play data return NULL for `deepTargets20Plus`.

### 1.4 Player Identity Enrichment
- **player_identity_map**: Joins NFLfastR ID to canonical player names and Sleeper IDs
- **player_positions**: View sourced from player_identity_map.nfl_data_py_id for position filtering

---

## 2. Feature Engineering Steps

### 2.1 Weekly Data Aggregation
```typescript
// Step 1: Fetch weekly stats with LEFT JOIN to player_usage
SELECT 
  weekly_stats.playerId,
  weekly_stats.season,
  weekly_stats.week,
  weekly_stats.team,
  weekly_stats.targets,
  player_usage.targetSharePct,      // Converted from 0-100 to 0-1
  weekly_stats.routes,
  weekly_stats.fantasyPointsPpr,
  player_usage.routesSlot,
  player_usage.routesOutside,
  player_usage.routesInline
FROM weekly_stats
LEFT JOIN player_usage ON (
  weekly_stats.playerId = player_usage.playerId AND
  weekly_stats.season = player_usage.season AND
  weekly_stats.week = player_usage.week
)
WHERE playerId = ? AND season = ?

// Step 2: Fetch deep targets from play-by-play
SELECT 
  week,
  COUNT(*) FILTER (WHERE air_yards >= 20) as deep_targets_20_plus
FROM bronze_nflfastr_plays
WHERE receiver_player_id = ?
  AND season = ?
  AND play_type = 'pass'
  AND (complete_pass = true OR incomplete_pass = true)
GROUP BY week

// Step 3: Merge by week (NULL if no play-by-play data exists for that week)
deepTargets20Plus = deepTargetsByWeek.get(week) ?? null
```

### 2.2 Season-Level Metrics

**Games Played**:
```typescript
gamesPlayed = COUNT(weeks where targets > 0 OR fantasyPointsPpr > 0)
```

**Targets Per Game**:
```typescript
totalTargets = SUM(targets) across all weeks
targetsPerGame = totalTargets / gamesPlayed
```

**Target Share Average**:
```typescript
targetShareValues = [targetSharePct values where NOT NULL]
targetShareAvg = MEAN(targetShareValues)  // Range: 0-1
```

**Routes Per Game**:
```typescript
routesValues = [routes values where NOT NULL]
totalRoutes = SUM(routesValues)
routesPerGame = totalRoutes / gamesPlayed
```

**PPR Per Target**:
```typescript
totalFantasy = SUM(fantasyPointsPpr) across all weeks
pprPerTarget = totalFantasy / totalTargets
```

### 2.3 Deep Target Metrics (v1.1 Critical Logic)

**CRITICAL FILTERING**: Only include weeks with play-by-play data coverage.

```typescript
// Step 1: Filter to weeks with play-by-play data
weeksWithPlayByPlay = weeklyRows.filter(r => 
  r.deepTargets20Plus !== undefined && r.deepTargets20Plus !== null
)

// Step 2: Calculate deep target totals (ALIGNED SAMPLE)
totalDeepTargets = SUM(deepTargets20Plus) across weeksWithPlayByPlay
totalTargetsWithPlayByPlay = SUM(targets) across weeksWithPlayByPlay

// Step 3: Compute rates
deepTargetsPerGame = totalDeepTargets / gamesPlayed
deepTargetRate = totalDeepTargets / totalTargetsWithPlayByPlay
```

**Why This Matters**: Play-by-play data lags weekly stats by 3-4 weeks. If Ja'Marr Chase played 11 games but only 7 have play-by-play data, we MUST only count his targets from those 7 weeks in the denominator to avoid underestimating his deep target rate.

### 2.4 Consistency Metrics

**Target Standard Deviation**:
```typescript
validTargets = [targets where targets > 0]
targetStdDev = STANDARD_DEVIATION(validTargets)
```

**Fantasy Standard Deviation**:
```typescript
validFantasy = [fantasyPointsPpr where fantasyPointsPpr > 0]
fantasyStdDev = STANDARD_DEVIATION(validFantasy)
```

### 2.5 Momentum Calculation

**Recent vs Season Targets**:
```typescript
last3Weeks = weeklyRows.slice(-3)  // Most recent 3 weeks
last3Targets = [targets from last3Weeks where targets > 0]
recentTargetsPerGame = SUM(last3Targets) / COUNT(last3Targets)

momentumDelta = recentTargetsPerGame - targetsPerGame
```

### 2.6 Route Alignment Metrics

**Slot Route Share**:
```typescript
totalRoutesAll = SUM(routes) across all weeks
totalSlotRoutes = SUM(routesSlot) across all weeks
slotRouteShareEst = totalSlotRoutes / totalRoutesAll  // Range: 0-1
```

**Outside Route Share**:
```typescript
totalOutsideRoutes = SUM(routesOutside) across all weeks
outsideRouteShareEst = totalOutsideRoutes / totalRoutesAll  // Range: 0-1
```

---

## 3. Scoring Algorithm (WR Role Bank v1.1)

### 3.1 Volume Score (Weight: 55%)

**Sub-Components**:
```typescript
targetsScore = scaleTargetsPerGame(targetsPerGame)
shareScore = scaleTargetShare(targetShareAvg) ?? targetsScore  // Fallback if NULL
routesScore = scaleRoutesPerGame(routesPerGame) ?? targetsScore  // Fallback if NULL

volumeScore = 0.5 * targetsScore + 0.3 * shareScore + 0.2 * routesScore
```

**Targets Per Game Scaling** (→ 0-100):
```
targetsPerGame >= 12  → 100
targetsPerGame >= 10  → 90
targetsPerGame >= 8   → 75
targetsPerGame >= 6   → 55
targetsPerGame >= 4   → 35
targetsPerGame >= 2   → 20
else                  → 10
```

**Target Share Scaling** (0-1 → 0-100):
```
targetShare >= 0.30  → 100
targetShare >= 0.27  → 90
targetShare >= 0.24  → 80
targetShare >= 0.20  → 65
targetShare >= 0.15  → 45
targetShare >= 0.10  → 30
else                 → 15
```

**Routes Per Game Scaling** (→ 0-100):
```
routesPerGame >= 40  → 100
routesPerGame >= 35  → 85
routesPerGame >= 30  → 70
routesPerGame >= 25  → 55
routesPerGame >= 20  → 40
routesPerGame >= 15  → 25
else                 → 15
```

### 3.2 Consistency Score (Weight: 15%)

**Formula**:
```typescript
function scaleConsistencyFromStdDev(targetStdDev: number | null): number {
  if (targetStdDev === null) return 60;  // Default for insufficient data
  
  const capped = Math.min(targetStdDev, 7);  // Cap at 7 for extreme outliers
  const score = 100 - (capped / 7) * 60;     // Linear decay: 7 stdDev → 40, 0 stdDev → 100
  
  return clamp(score, 40, 100);  // Ensure score stays in [40, 100]
}
```

**Interpretation**: Lower standard deviation = higher consistency = higher score.

### 3.3 High-Value Usage Score (Weight: 20%) - v1.1 CRITICAL CHANGE

**Formula (Deep Target Rate)**:
```typescript
function scaleDeepTargetRate(
  deepTargetRate: number | null, 
  totalTargetsWithPlayByPlay: number
): number {
  // Insufficient sample size guard
  if (deepTargetRate === null || totalTargetsWithPlayByPlay < 30) {
    return 50;  // Neutral score for players without enough data
  }
  
  // Deep target rate thresholds
  if (deepTargetRate >= 0.30) return 100;  // Elite deep threat (30%+ deep)
  if (deepTargetRate >= 0.25) return 90;   // Strong deep role
  if (deepTargetRate >= 0.20) return 75;   // Moderate deep role
  if (deepTargetRate >= 0.15) return 60;   // Some deep usage
  if (deepTargetRate >= 0.10) return 45;   // Limited deep role
  if (deepTargetRate >= 0.05) return 30;   // Minimal deep usage
  return 20;                               // Pure underneath/screen WR
}
```

**Key Change from v1.0**: Replaced `pprPerTarget` with `deepTargetRate` to objectively measure high-value usage without requiring red zone or end zone data.

### 3.4 Momentum Score (Weight: 10%)

**Formula**:
```typescript
function computeMomentumScore(
  seasonTargetsPerGame: number | null,
  recentTargetsPerGame: number | null
): number {
  if (seasonTargetsPerGame === null || recentTargetsPerGame === null) {
    return 60;  // Neutral default
  }
  
  const delta = recentTargetsPerGame - seasonTargetsPerGame;
  
  if (delta >= 3)   return 95;  // Surging usage (+3 targets/game)
  if (delta >= 1)   return 80;  // Rising usage (+1-2 targets/game)
  if (delta > -1)   return 60;  // Stable usage
  if (delta > -3)   return 45;  // Declining usage (-1 to -3 targets/game)
  return 30;                    // Cratering usage (-3+ targets/game)
}
```

### 3.5 Final Role Score

**Formula**:
```typescript
roleScore = ROUND(
  0.55 * volumeScore +
  0.15 * consistencyScore +
  0.20 * highValueUsageScore +
  0.10 * momentumScore
)
```

**Weight Distribution (v1.1)**:
- Volume: 55% (targets, target share, routes)
- Consistency: 15% (target standard deviation)
- High-Value Usage: 20% (deep target rate)
- Momentum: 10% (recent vs season targets)

---

## 4. Tier Logic

### 4.1 Tier Assignment Algorithm

**Inputs**:
```typescript
shareForTier = targetShareAvg ?? 0
volForTier = volumeScore
```

**Tier Hierarchy** (evaluated top to bottom):

```typescript
if (volForTier >= 90 AND shareForTier >= 0.27) {
  roleTier = 'ALPHA'
} 
else if (volForTier >= 80 AND shareForTier >= 0.22) {
  roleTier = 'CO_ALPHA'
} 
else if (slotRouteShareEst >= 0.60 AND volForTier >= 70) {
  roleTier = 'PRIMARY_SLOT'
} 
else if (volForTier >= 60) {
  roleTier = 'SECONDARY'
} 
else if (volForTier >= 40) {
  roleTier = 'ROTATIONAL'
} 
else {
  roleTier = 'UNKNOWN'
}
```

### 4.2 Tier Definitions

| Tier | Volume Score | Target Share | Description |
|------|--------------|--------------|-------------|
| **ALPHA** | ≥90 | ≥27% | True WR1, dominates target share |
| **CO_ALPHA** | ≥80 | ≥22% | High-end WR1/WR2, strong role |
| **PRIMARY_SLOT** | ≥70 | — | Slot-dominant receiver (≥60% slot routes) |
| **SECONDARY** | ≥60 | — | WR2/WR3, reliable role |
| **ROTATIONAL** | ≥40 | — | WR3/WR4, situational usage |
| **UNKNOWN** | <40 | — | Minimal usage or insufficient data |

### 4.3 Binary Flags

**Cardio WR Flag**:
```typescript
cardioWrFlag = (routesPerGame >= 30 AND targetsPerGame <= 5)
// High route volume but low target conversion (potential QB issue or role mismatch)
```

**Breakout Watch Flag**:
```typescript
breakoutWatchFlag = (
  roleTier !== 'ALPHA' AND 
  volumeScore < 85 AND 
  momentumScore >= 80
)
// Rising usage trajectory, not yet elite volume
```

**Fake Spike Flag**:
```typescript
// Requires at least 3 weeks of data
lastWeekFantasy >= 2 * avgPreviousFantasy AND
abs(lastWeekTargets - avgPreviousTargets) <= 1
// Unsustainable efficiency spike without volume increase
```

---

## 5. Sample Rows (2025 Season, Current Production Data)

### 5.1 Complete Player Breakdown

| Player | Tier | Role Score | Volume | Consistency | High-Value | Momentum | Targets/G | Share | Deep % | Deep/G |
|--------|------|------------|--------|-------------|------------|----------|-----------|-------|--------|--------|
| **CeeDee Lamb** | CO_ALPHA | 74 | 80 | 82 | 60 | 60 | 10.17 | 28.5% | 18.8% | 1.0 |
| **Emeka Egbuka** | SECONDARY | 74 | 67 | 78 | **90** | 80 | 8.60 | 25.8% | **29.1%** | 1.6 |
| **Ja'Marr Chase** | CO_ALPHA | 68 | 83 | 52 | 45 | 60 | 11.70 | 32.4% | 12.5% | 1.0 |
| **Puka Nacua** | SECONDARY | 62 | 70 | 68 | 45 | 45 | 9.67 | 29.0% | 13.8% | 1.0 |
| **Tetairoa McMillan** | SECONDARY | 69 | 70 | 82 | 60 | 60 | 8.09 | 28.2% | 17.0% | 0.82 |
| **Wan'Dale Robinson** | SECONDARY | 68 | 67 | 75 | 60 | 80 | 8.09 | 26.3% | 15.7% | 0.91 |
| **Amon-Ra St. Brown** | CO_ALPHA | 64 | 73 | 82 | 20 | 80 | 9.70 | 29.0% | 1.6% | 0.10 |

### 5.2 Detailed Field-Level Audit

#### CeeDee Lamb
```yaml
playerId: "00-0036358"
season: 2025
gamesPlayed: 6

# Volume Metrics
targetsPerGame: 10.17       → targetsScore: 90
targetShareAvg: 0.285       → shareScore: 90
routesPerGame: 20.33        → routesScore: 40
volumeScore: 0.5*90 + 0.3*90 + 0.2*40 = 80

# Consistency
targetStdDev: ~2.1          → consistencyScore: 82

# High-Value Usage
deepTargetsPerGame: 1.0
deepTargetRate: 0.1875 (18.8%)
totalTargetsWithPlayByPlay: 32  → highValueUsageScore: 60

# Momentum
recentTargetsPerGame: 10.5
delta: 10.5 - 10.17 = +0.33 → momentumScore: 60

# Final Role Score
roleScore: 0.55*80 + 0.15*82 + 0.20*60 + 0.10*60 = 74

# Tier Assignment
volumeScore: 80, targetShare: 0.285
→ 80 >= 80 AND 0.285 >= 0.22 → CO_ALPHA
```

#### Emeka Egbuka (Elite Deep Threat Example)
```yaml
playerId: "00-0040129"
season: 2025
gamesPlayed: 10

# Volume Metrics
targetsPerGame: 8.6         → targetsScore: 75
targetShareAvg: 0.258       → shareScore: 80
routesPerGame: 17.2         → routesScore: 25
volumeScore: 0.5*75 + 0.3*80 + 0.2*25 = 67

# Consistency
targetStdDev: ~2.5          → consistencyScore: 78

# High-Value Usage (CRITICAL)
deepTargetsPerGame: 1.6
deepTargetRate: 0.291 (29.1%)  ← Elite deep threat!
totalTargetsWithPlayByPlay: 55  → highValueUsageScore: 90

# Momentum
recentTargetsPerGame: 10.3
delta: 10.3 - 8.6 = +1.7    → momentumScore: 80

# Final Role Score
roleScore: 0.55*67 + 0.15*78 + 0.20*90 + 0.10*80 = 74

# Tier Assignment
volumeScore: 67, targetShare: 0.258
→ 67 >= 60 → SECONDARY (not CO_ALPHA due to volume < 80)

# Flags
breakoutWatch: TRUE (volume < 85, momentum >= 80)
```

#### Ja'Marr Chase
```yaml
playerId: "00-0036900"
season: 2025
gamesPlayed: 10

# Volume Metrics
targetsPerGame: 11.7        → targetsScore: 90
targetShareAvg: 0.324       → shareScore: 100
routesPerGame: 23.4         → routesScore: 55
volumeScore: 0.5*90 + 0.3*100 + 0.2*55 = 83

# Consistency
targetStdDev: ~4.8          → consistencyScore: 52  ← High variance

# High-Value Usage
deepTargetsPerGame: 1.0
deepTargetRate: 0.125 (12.5%)
totalTargetsWithPlayByPlay: 80  → highValueUsageScore: 45

# Momentum
recentTargetsPerGame: 12.0
delta: 12.0 - 11.7 = +0.3   → momentumScore: 60

# Final Role Score
roleScore: 0.55*83 + 0.15*52 + 0.20*45 + 0.10*60 = 68

# Tier Assignment
volumeScore: 83, targetShare: 0.324
→ 83 >= 80 AND 0.324 >= 0.22 → CO_ALPHA
```

#### Amon-Ra St. Brown (Comparison: Non-Deep Threat)
```yaml
playerId: "00-0036389"
season: 2025
gamesPlayed: 10

# Volume Metrics
targetsPerGame: 9.7         → targetsScore: 90
targetShareAvg: 0.290       → shareScore: 90
routesPerGame: 19.3         → routesScore: 40
volumeScore: 0.5*90 + 0.3*90 + 0.2*40 = 73

# Consistency
targetStdDev: ~2.1          → consistencyScore: 82

# High-Value Usage
deepTargetsPerGame: 0.1
deepTargetRate: 0.016 (1.6%)  ← Pure underneath receiver
totalTargetsWithPlayByPlay: 61  → highValueUsageScore: 20

# Momentum
recentTargetsPerGame: 12.0
delta: 12.0 - 9.7 = +2.3    → momentumScore: 80

# Final Role Score
roleScore: 0.55*73 + 0.15*82 + 0.20*20 + 0.10*80 = 64

# Tier Assignment
volumeScore: 73, targetShare: 0.290
→ 73 < 80 but >= 60 → SECONDARY
  (does not qualify for CO_ALPHA due to volume < 80)

# Notes
Low deep target rate (1.6%) significantly reduces highValueUsageScore,
dropping final roleScore despite strong volume and momentum.
```

---

## 6. Key Implementation Notes

### 6.1 Data Alignment Bug Fix (Critical)

**Problem**: Original v1.1 implementation calculated `deepTargetRate` using deep targets from weeks with play-by-play data, but used `totalTargets` from ALL weeks in the denominator. This caused systematic underestimation of deep target rates.

**Solution**: 
```typescript
// CORRECT (v1.1 final)
const weeksWithPlayByPlay = sorted.filter(r => 
  r.deepTargets20Plus !== undefined && r.deepTargets20Plus !== null
);
const totalDeepTargets = SUM(deepTargets20Plus from weeksWithPlayByPlay);
const totalTargetsWithPlayByPlay = SUM(targets from weeksWithPlayByPlay);
const deepTargetRate = totalDeepTargets / totalTargetsWithPlayByPlay;
```

**Impact**: Ja'Marr Chase's deep target rate increased from 8.5% (incorrect) to 12.5% (correct) after this fix.

### 6.2 Sample Size Thresholds

- **Minimum for deep target scoring**: 30 targets with play-by-play coverage
- **Default score for insufficient data**: 50 (neutral)
- **Games played minimum**: 1 (players with 0 games are filtered out)

### 6.3 NULL Handling

- `targetShareAvg = NULL` → Use `targetsScore` as fallback for `shareScore`
- `routesPerGame = NULL` → Use `targetsScore` as fallback for `routesScore`
- `deepTargetRate = NULL` → Return 50 for `highValueUsageScore`
- `targetStdDev = NULL` → Return 60 for `consistencyScore`

### 6.4 Rounding

All final scores are rounded to integers:
```typescript
roleScore: Math.round(0.55*vol + 0.15*con + 0.20*hv + 0.10*mom)
volumeScore: Math.round(volumeScore)
consistencyScore: Math.round(consistencyScore)
highValueUsageScore: Math.round(highValueUsageScore)
momentumScore: Math.round(momentumScore)
```

---

## 7. API Response Structure

### 7.1 Endpoint
```
GET /api/role-bank/WR/:season
```

### 7.2 Response Fields
```typescript
{
  playerId: string,           // NFLfastR ID
  canonicalId: string,        // Canonical player ID
  sleeperId: string | null,   // Sleeper platform ID
  playerName: string,         // Display name
  team: string,               // Team abbreviation
  position: string,           // Always "WR"
  roleScore: number,          // 0-100
  roleTier: WRRoleTier,       // ALPHA | CO_ALPHA | PRIMARY_SLOT | SECONDARY | ROTATIONAL | UNKNOWN
  gamesPlayed: number,
  
  // Volume metrics
  targetsPerGame: number,
  targetShareAvg: number,     // 0-1
  routesPerGame: number | null,
  
  // Efficiency
  pprPerTarget: number | null,
  
  // v1.1: Deep target fields
  deepTargetsPerGame: number | null,
  deepTargetRate: number | null,  // 0-1
  
  // Sub-scores
  volumeScore: number,        // 0-100
  consistencyScore: number,   // 0-100
  highValueUsageScore: number, // 0-100
  momentumScore: number,      // 0-100
  
  // Flags
  flags: {
    cardioWr: boolean,
    breakoutWatch: boolean
  }
}
```

---

## 8. Validation Queries

### 8.1 Manual Deep Target Rate Check (Ja'Marr Chase Example)

```sql
-- Step 1: Get weeks with play-by-play data
SELECT 
  week,
  COUNT(*) FILTER (WHERE air_yards >= 20) as deep_targets,
  COUNT(*) as total_targets
FROM bronze_nflfastr_plays
WHERE receiver_player_id = '00-0036900'
  AND season = 2025
  AND play_type = 'pass'
  AND (complete_pass = true OR incomplete_pass = true)
GROUP BY week
ORDER BY week;

-- Step 2: Compare with weekly_stats
SELECT 
  week,
  targets
FROM weekly_stats
WHERE playerId = '00-0036900'
  AND season = 2025
ORDER BY week;

-- Step 3: Validate rate calculation
-- Expected: 10 deep targets / 80 total targets (from play-by-play weeks) = 12.5%
```

### 8.2 Tier Distribution Check

```sql
SELECT 
  roleTier,
  COUNT(*) as count,
  AVG(roleScore) as avg_score,
  MIN(roleScore) as min_score,
  MAX(roleScore) as max_score
FROM wr_role_bank
WHERE season = 2025
GROUP BY roleTier
ORDER BY AVG(roleScore) DESC;
```

---

## 9. Performance Benchmarks

**2025 Season Computation**:
- Total candidates: 303 WRs
- Success rate: 100% (303/303)
- Duration: ~67 seconds
- Database: PostgreSQL with pgvector extension
- Deep target join: ~0.2s per player

**Storage Requirements**:
- `wr_role_bank` table: ~1.5 KB per player/season row
- `bronze_nflfastr_plays` index: ~250 MB for full season play-by-play data

---

## 10. Known Limitations

1. **Play-by-Play Data Lag**: NFLfastR play-by-play data typically lags weekly stats by 3-4 weeks during the season. This means deep target rates may be incomplete for recent weeks.

2. **Sample Size Bias**: Players with fewer than 30 targets in play-by-play coverage receive a neutral score (50) for high-value usage, which may underrepresent true deep threat ability.

3. **Route Alignment Estimation**: Slot/outside route percentages are estimated from NFLfastR snap data and may not perfectly reflect alignment on every play.

4. **Target Quality**: Deep target rate does not account for catchability, coverage, or other qualitative factors.

5. **Momentum Volatility**: 3-week momentum window can be noisy for players with inconsistent usage.

---

## Export Confirmation

**File**: `/tmp/WR_ROLE_BANK_V1_1_AUDIT.md`  
**Size**: ~21 KB  
**Lines**: ~570+  
**Sections**: 10 major sections with complete formulas, thresholds, and real production data  
**Purpose**: Independent review and validation by external models (e.g., Grok)  

**No logic was changed during this audit generation.** This document represents the current production implementation of WR Role Bank v1.1 as of November 23, 2025.

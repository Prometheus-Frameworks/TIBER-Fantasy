# Project 2024 QA Documentation

## Overview

This document outlines testing procedures for the 2024 NFL player stats leaderboard system. Focus is on functional API/UI coverage, data consistency, and edge case handling.

## API Testing

### Endpoint Structure

```
GET /api/stats/2024/leaderboard
```

#### Required Parameters

- `position`: RB | WR | TE | QB
- `metric`: Position-specific whitelisted metrics
- `limit`: Integer (default: 50, max: 500)
- `dir`: asc | desc (default: desc)

#### Filter Parameters

- `min_games`: Integer (default: 8)
- `min_routes`: Integer (default: 150) - WR/TE only
- `min_att`: Integer (default: 100) - RB only
- `min_att_qb`: Integer (default: 250) - QB only

### Metric Whitelists by Position

#### RB Metrics

- `rush_att`, `rush_yards`, `rush_tds`, `rush_ypc`, `rush_yac_per_att`, `rush_mtf`, `rush_expl_10p`
- `targets`, `rec_yards`, `yprr`, `td_total`, `fpts`, `fpts_ppr`

#### WR/TE Metrics

- `targets`, `receptions`, `rec_yards`, `rec_tds`
- `adot`, `yprr`, `racr`, `target_share`, `wopr`
- `fpts`, `fpts_ppr`

#### QB Metrics

- `cmp_pct`, `pass_yards`, `pass_tds`, `int`, `ypa`, `aypa`
- `epa_per_play`, `qb_rush_yards`, `qb_rush_tds`, `fpts`

### API Test Cases

#### 1. Basic Functionality

```bash
# Test valid position + metric combinations
curl "/api/stats/2024/leaderboard?position=RB&metric=rush_ypc"
curl "/api/stats/2024/leaderboard?position=WR&metric=targets"
curl "/api/stats/2024/leaderboard?position=TE&metric=yprr"
curl "/api/stats/2024/leaderboard?position=QB&metric=pass_tds"

# Expected: Valid JSON response with correct schema
```

#### 2. Parameter Validation

```bash
# Invalid position
curl "/api/stats/2024/leaderboard?position=INVALID&metric=targets"
# Expected: 400 error

# Invalid metric for position
curl "/api/stats/2024/leaderboard?position=RB&metric=pass_tds"
# Expected: 400 error or fallback to valid RB metric

# Missing required params
curl "/api/stats/2024/leaderboard"
# Expected: 400 error with clear message
```

#### 3. Threshold Filters

```bash
# RB with rushing attempt minimum
curl "/api/stats/2024/leaderboard?position=RB&metric=rush_ypc&min_att=50"
# Expected: Only RBs with ≥50 rush attempts

# WR with route minimum
curl "/api/stats/2024/leaderboard?position=WR&metric=yprr&min_routes=100"
# Expected: Only WRs with ≥100 routes

# QB with passing attempt minimum
curl "/api/stats/2024/leaderboard?position=QB&metric=cmp_pct&min_att_qb=200"
# Expected: Only QBs with ≥200 pass attempts
```

#### 4. Sorting & Limits

```bash
# Ascending sort
curl "/api/stats/2024/leaderboard?position=QB&metric=int&dir=asc&limit=10"
# Expected: QBs with fewest INTs first, exactly 10 results

# Large limit handling
curl "/api/stats/2024/leaderboard?position=RB&metric=rush_yards&limit=1000"
# Expected: Capped at max allowed or all available records
```

#### 5. Response Schema Validation

Each response should include:

```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "playerName": "string", 
      "position": "RB|WR|TE|QB",
      "team": "string",
      "games": "number",
      "[metric_name]": "number|null",
      "fpts": "number",
      "fptsPpr": "number"
    }
  ],
  "filters": {
    "position": "string",
    "metric": "string",
    "direction": "string",
    "thresholds": "object"
  },
  "count": "number"
}
```

## Data Consistency Checks

### Formula Validation

Test calculated fields match expected formulas:

#### Rush YPC

```sql
-- Spot check: rush_ypc should equal rush_yards / rush_att
SELECT player_name, rush_yards, rush_att, rush_ypc,
       ROUND(rush_yards::NUMERIC / NULLIF(rush_att, 0), 2) as calculated_ypc
FROM player_season_2024 
WHERE rush_att > 0 AND ABS(rush_ypc - (rush_yards::NUMERIC / rush_att)) > 0.01
LIMIT 5;
-- Expected: No rows (or very few due to rounding)
```

#### Completion Percentage

```sql
-- Spot check: cmp_pct should equal cmp / att * 100
SELECT player_name, cmp, att, cmp_pct,
       ROUND((cmp::NUMERIC / NULLIF(att, 0)) * 100, 1) as calculated_pct
FROM player_season_2024 
WHERE att > 0 AND ABS(cmp_pct - ((cmp::NUMERIC / att) * 100)) > 0.1
LIMIT 5;
-- Expected: No rows (or very few due to rounding)
```

#### YPA (Yards Per Attempt)

```sql
-- Spot check: ypa should equal pass_yards / att
SELECT player_name, pass_yards, att, ypa,
       ROUND(pass_yards::NUMERIC / NULLIF(att, 0), 2) as calculated_ypa  
FROM player_season_2024
WHERE att > 0 AND ABS(ypa - (pass_yards::NUMERIC / att)) > 0.01
LIMIT 5;
-- Expected: No rows (or very few due to rounding)
```

### Null Handling

```sql
-- Advanced metrics should allow nulls
SELECT COUNT(*) as total_players,
       COUNT(yprr) as has_yprr,
       COUNT(epa_per_play) as has_epa,
       COUNT(wopr) as has_wopr
FROM player_season_2024;
-- Expected: total_players > has_advanced_metrics (nulls are OK)
```

### Data Range Sanity

```sql
-- Realistic bounds check
SELECT player_name, position, games, fpts
FROM player_season_2024
WHERE games > 17 OR games < 0 OR fpts < -50 OR fpts > 500;
-- Expected: Few/no unrealistic outliers
```

## Edge Case Testing

### 1. Small Sample Noise

```bash
# Rookie RB with minimal carries
curl "/api/stats/2024/leaderboard?position=RB&metric=rush_ypc&min_att=5"
# Expected: Should include players with tiny samples
# Test that default min_att=100 filters these out appropriately

# WR with few targets  
curl "/api/stats/2024/leaderboard?position=WR&metric=yprr&min_routes=10"
# Expected: Noisy small-sample players included
```

### 2. Team Changes

```sql
-- Players who switched teams mid-season
SELECT player_name, position, team, COUNT(*) as team_count
FROM player_season_2024 
GROUP BY player_name, position
HAVING COUNT(DISTINCT team) > 1;
-- Expected: Document how these are handled (aggregated? flagged?)
```

### 3. Position Eligibility Edge Cases

```bash
# Taysom Hill type players - listed as QB but producing TE-like stats
curl "/api/stats/2024/leaderboard?position=QB&metric=targets"
# Expected: Either include or exclude consistently

# Players with minimal position-specific stats
curl "/api/stats/2024/leaderboard?position=RB&metric=rush_att&min_att=1" 
# Expected: Should show RBs with any rushing attempts
```

### 4. Advanced Stat Nulls

```bash
# Players missing advanced metrics should still appear
curl "/api/stats/2024/leaderboard?position=WR&metric=targets&limit=100"
# Expected: Players with null YPRR/WOPR still included
# Advanced metrics in response should show null, not 0
```

## UI Testing (/leaders)

### 1. Tab Functionality

- [ ] Click RB tab → loads RB metrics dropdown
- [ ] Click WR tab → loads WR metrics dropdown
- [ ] Click TE tab → loads TE metrics dropdown
- [ ] Click QB tab → loads QB metrics dropdown
- [ ] Tab state persists in URL (e.g., `/leaders?tab=RB`)

### 2. Metric Dropdown Behavior

- [ ] Dropdown shows only valid metrics for selected position
- [ ] Selecting metric triggers API call and table refresh
- [ ] Default metric selection is sensible (rush_yards for RB, targets for WR/TE, pass_tds for QB)
- [ ] Metric selection persists in URL

### 3. Sorting & Filters

- [ ] Sort direction toggle works (asc/desc arrow indicators)
- [ ] Min games filter applies correctly
- [ ] Position-specific filters show only when relevant:
  - [ ] min_att for RB tab only
  - [ ] min_routes for WR/TE tabs only
  - [ ] min_att_qb for QB tab only
- [ ] Filter changes trigger immediate table refresh
- [ ] Filter state persists in URL

### 4. Table Display

- [ ] Player names display correctly
- [ ] Team logos render properly
- [ ] Games column shows integer values
- [ ] Selected metric column highlighted/emphasized
- [ ] FPTS(PPR) column shows for skill positions
- [ ] Null values display as "-" or "N/A", not 0
- [ ] Sticky header works on scroll

### 5. Search & Navigation

- [ ] Player search filters table in real-time
- [ ] Search works across player names (fuzzy matching preferred)
- [ ] Pagination controls work (if implemented)
- [ ] URL state reflects all selections (shareable links)
- [ ] Browser back/forward maintains state

### 6. Responsive Behavior

- [ ] Table scrolls horizontally on mobile
- [ ] Filters stack appropriately on smaller screens
- [ ] Tab switching works on touch devices

## Test Data Requirements

### Minimum Test Dataset

- [ ] At least 50 players per position
- [ ] Mix of high/low volume players per position
- [ ] Include players with null advanced metrics
- [ ] Include at least 2-3 players who changed teams
- [ ] Include edge cases like Taysom Hill

### Data Quality Checks

- [ ] No duplicate player_name + position + team combinations
- [ ] All required fields populated (no nulls in player_name, position, games)
- [ ] Fantasy points calculated consistently
- [ ] Team abbreviations standardized

## Regression Test Commands

After any code changes, run this test suite:

```bash
#!/bin/bash
# Basic API health check
curl -f "http://localhost:5000/api/stats/2024/leaderboard?position=RB&metric=rush_yards" || echo "RB FAIL"
curl -f "http://localhost:5000/api/stats/2024/leaderboard?position=WR&metric=targets" || echo "WR FAIL" 
curl -f "http://localhost:5000/api/stats/2024/leaderboard?position=TE&metric=receptions" || echo "TE FAIL"
curl -f "http://localhost:5000/api/stats/2024/leaderboard?position=QB&metric=pass_tds" || echo "QB FAIL"

# Filter validation
curl -f "http://localhost:5000/api/stats/2024/leaderboard?position=RB&metric=rush_ypc&min_att=100" || echo "FILTER FAIL"

# Error handling
curl "http://localhost:5000/api/stats/2024/leaderboard?position=INVALID&metric=targets" | grep -q "400\|error" || echo "ERROR HANDLING FAIL"
```

## Known Limitations & Future Testing

### V1 Scope Exclusions

- **Load/Performance Testing**: Deferred until >2k player dataset
- **Advanced Analytics**: Complex EPA validations deferred
- **Multi-season Comparisons**: 2024 only for now

### Future Test Coverage

- API rate limiting and caching behavior
- Historical data consistency across seasons
- Advanced metric calculation accuracy vs source data
- Mobile app integration testing

## Success Criteria

✅ **API Ready**: All position/metric combinations return valid data
✅ **Filters Work**: Thresholds appropriately limit results  
✅ **UI Complete**: /leaders functional with all interactive elements
✅ **Edge Cases Handled**: Small samples, team changes, position quirks managed gracefully
✅ **Data Quality**: Formula spot-checks pass, nulls handled properly

## Contact & Escalation

For QA issues or test failures:

1. Check this doc for expected behavior first
1. Verify against latest schema in project brief
1. Cross-reference with Grok's data output and DeepSeek's formulas
1. Escalate to Lamar for Tiber handoff coordination
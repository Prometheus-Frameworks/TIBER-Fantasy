# Ratings v1 QA Checklist

## Overview
Quality assurance for the player ratings system featuring redraft and dynasty scoring frameworks with position-specific weights, VOR calculations, and tier clustering.

## API Testing

### Core Endpoints

#### GET /api/tiber-ratings
```bash
# Basic functionality tests
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&limit=25"
curl "/api/tiber-ratings?format=dynasty&position=WR&season=2024&limit=50"
curl "/api/tiber-ratings?format=redraft&position=QB&season=2024&week=17&debug=1"

# Parameter validation
curl "/api/tiber-ratings?format=INVALID&position=RB&season=2024"
# Expected: 400 error

curl "/api/tiber-ratings?format=redraft&position=INVALID&season=2024"  
# Expected: 400 error

curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=0"
# Expected: 400 error (invalid week)

curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=18"
# Expected: 400 error (beyond season)
```

#### GET /api/tiber-ratings/:id
```bash
# Single player breakdown
curl "/api/tiber-ratings/jamarr-chase?format=redraft&season=2024&week=6"
curl "/api/tiber-ratings/josh-jacobs?format=dynasty&season=2024"

# Invalid player ID
curl "/api/tiber-ratings/INVALID?format=redraft&season=2024&week=6"
# Expected: 404 error

# Missing required parameters
curl "/api/tiber-ratings/jamarr-chase"
# Expected: 400 error (format required)
```

#### GET /api/tiber-ratings/tiers
```bash
# Tier clustering tests
curl "/api/tiber-ratings/tiers?format=redraft&position=RB&season=2024&week=6"
curl "/api/tiber-ratings/tiers?format=dynasty&position=WR&season=2024"

# Should return tier cutoffs and player counts per tier
```

### Weight Override Testing
```bash
# Custom weights (must sum to 1.0)
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&weights=0.5,0.25,0.15,0.05,0.03,0.02"

# Invalid weight count
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&weights=0.5,0.25"
# Expected: 400 error or fallback to defaults

# Weights don't sum to 1.0
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&weights=0.5,0.5,0.5,0.5,0.5,0.5"
# Expected: 400 error or normalization
```

## Response Schema Validation

### /api/tiber-ratings Response
```json
{
  "format": "redraft|dynasty",
  "position": "RB|WR|TE|QB", 
  "season": 2024,
  "week": 6,
  "items": [
    {
      "player_id": "string",
      "name": "string",
      "team": "string",
      "position": "string",
      "score": 85.3,
      "vor": 12.8,
      "tier": 2,
      "debug": {
        "Opp": 78,
        "Eff": 66, 
        "Role": 72,
        "Team": 64,
        "Health": -3,
        "SOS": 2
      },
      "weights": {
        "opp": 0.45,
        "eff": 0.20,
        "role": 0.15,
        "team": 0.10,
        "health": 0.05,
        "sos": 0.05
      }
    }
  ],
  "count": 25
}
```

### /api/tiber-ratings/:id Response
```json
{
  "player_id": "string",
  "name": "string",
  "team": "string",
  "position": "string",
  "age": 24.5,
  "season": 2024,
  "week": 6,
  "format": "redraft",
  "score": 85.3,
  "vor": 12.8,
  "tier": 2,
  "debug": { "Opp": 78, "Eff": 66, "Role": 72, "Team": 64, "Health": -3, "SOS": 2 },
  "weights": { "opp": 0.45, "eff": 0.20, "role": 0.15, "team": 0.10, "health": 0.05, "sos": 0.05 },
  "trend": [
    { "week": 3, "score": 82.1 },
    { "week": 4, "score": 84.5 },
    { "week": 5, "score": 83.9 },
    { "week": 6, "score": 85.3 }
  ]
}
```

## Score Validation

### Score Range Sanity
```sql
-- All scores should be 0-100
SELECT ps.player_id, pp.name, ps.position, ps.score 
FROM player_scores ps
JOIN player_profile pp ON ps.player_id = pp.player_id
WHERE ps.score < 0 OR ps.score > 100
LIMIT 10;
-- Expected: No rows

-- Reasonable distribution check
SELECT ps.position, 
       MIN(ps.score) as min_score,
       MAX(ps.score) as max_score,
       AVG(ps.score) as avg_score,
       COUNT(*) as player_count
FROM player_scores ps
WHERE ps.season = 2024 AND ps.format = 'redraft'
GROUP BY ps.position;
-- Expected: Reasonable spreads, no extreme outliers
```

### VOR (Value Over Replacement) Validation
```sql
-- VOR should use correct replacement levels: RB40, WR48, TE16, QB12
WITH replacement_scores AS (
  SELECT 
    'RB' as position,
    (SELECT score FROM player_scores WHERE position = 'RB' AND season = 2024 AND format = 'redraft' ORDER BY score DESC OFFSET 39 LIMIT 1) as replacement_score
  UNION ALL
  SELECT 
    'WR' as position,
    (SELECT score FROM player_scores WHERE position = 'WR' AND season = 2024 AND format = 'redraft' ORDER BY score DESC OFFSET 47 LIMIT 1) as replacement_score
  UNION ALL
  SELECT 
    'TE' as position,
    (SELECT score FROM player_scores WHERE position = 'TE' AND season = 2024 AND format = 'redraft' ORDER BY score DESC OFFSET 15 LIMIT 1) as replacement_score
  UNION ALL
  SELECT 
    'QB' as position,
    (SELECT score FROM player_scores WHERE position = 'QB' AND season = 2024 AND format = 'redraft' ORDER BY score DESC OFFSET 11 LIMIT 1) as replacement_score
)
SELECT pp.name, ps.position, ps.score, ps.vor, 
       ps.score - rs.replacement_score as calculated_vor
FROM player_scores ps
JOIN player_profile pp ON ps.player_id = pp.player_id
JOIN replacement_scores rs ON ps.position = rs.position
WHERE ps.season = 2024 AND ps.format = 'redraft'
  AND ABS(ps.vor - (ps.score - rs.replacement_score)) > 0.1
LIMIT 5;
-- Expected: No rows (VOR calculation should match)
```

### Debug Component Validation
```bash
# Debug breakdown should sum to total score (within rounding)
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&debug=1&limit=5"

# Validate response mathematically:
# For RB: score ≈ (Opp * 0.45) + (Eff * 0.20) + (Role * 0.15) + (Team * 0.10) + (Health * 0.05) + (SOS * 0.05)
# For WR: score ≈ (Opp * 0.30) + (Eff * 0.30) + (Role * 0.15) + (Team * 0.15) + (Health * 0.05) + (SOS * 0.05)
```

## Position-Specific Weight Testing

### Redraft Weight Validation
```sql
-- Spot check that position-specific weights are applied correctly
SELECT pp.name, ps.position, ps.weights_json
FROM player_scores ps
JOIN player_profile pp ON ps.player_id = pp.player_id
WHERE ps.season = 2024 AND ps.format = 'redraft' AND ps.position = 'RB'
LIMIT 3;
-- Expected: weights_json should reflect RB-specific weights (opp: 0.45, eff: 0.20, etc.)
```

### Dynasty vs Redraft Differences
```sql
-- Same player should have different scores in redraft vs dynasty
SELECT pp.name, ps1.position,
       ps1.score as redraft_score,
       ps2.score as dynasty_score,
       ABS(ps1.score - ps2.score) as score_diff
FROM player_scores ps1
JOIN player_scores ps2 ON ps1.player_id = ps2.player_id AND ps1.season = ps2.season
JOIN player_profile pp ON ps1.player_id = pp.player_id
WHERE ps1.format = 'redraft' AND ps2.format = 'dynasty'
  AND ps1.season = 2024 AND ps1.week = 6 AND ps2.week IS NULL
ORDER BY score_diff DESC
LIMIT 10;
-- Expected: Meaningful differences, especially for age-sensitive positions
```

## Tier System Testing

### Tier Clustering Validation
```sql
-- Check tier distribution makes sense
SELECT ps.position, ps.format, ps.tier, COUNT(*) as player_count,
       MIN(ps.score) as tier_min, MAX(ps.score) as tier_max
FROM player_scores ps
WHERE ps.season = 2024
GROUP BY ps.position, ps.format, ps.tier
ORDER BY ps.position, ps.format, ps.tier;
-- Expected: Reasonable tier sizes, no single-player tiers, clear score gaps between tiers
```

### Tier API Consistency
```bash
# Tier endpoints should match score endpoints
curl "/api/tiber-ratings/tiers?format=redraft&position=RB&season=2024&week=6"
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&limit=100"

# Cross-validate: players in tier 1 from /tiers should match highest scores from /ratings
```

## Data Pipeline QA

### Input Data Completeness
```sql
-- Check weekly input coverage
SELECT pi.week, pi.position, COUNT(DISTINCT pi.player_id) as unique_players
FROM player_inputs pi
WHERE pi.season = 2024
GROUP BY pi.week, pi.position
ORDER BY pi.week, pi.position;
-- Expected: Consistent player counts per week (accounting for byes/injuries)

-- Missing critical fields
SELECT COUNT(*) as players_missing_snap_pct
FROM player_inputs
WHERE season = 2024 AND (snap_pct IS NULL OR snap_pct = 0);
-- Expected: Minimal missing data for core metrics
```

### Profile Data Validation
```sql
-- Age reasonableness
SELECT COUNT(*) as unrealistic_ages
FROM player_profile
WHERE age < 20 OR age > 45;
-- Expected: Very few outliers

-- Draft capital distribution
SELECT draft_round, COUNT(*) as player_count
FROM player_profile
WHERE draft_round IS NOT NULL
GROUP BY draft_round
ORDER BY draft_round;
-- Expected: Reasonable distribution, most players rounds 1-7
```

## Edge Cases

### Small Sample Handling
```bash
# Rookie with minimal data
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=2&limit=100"
# Expected: Rookies appear but with appropriate uncertainty (lower scores due to limited role data)

# Injured player with limited snaps
curl "/api/tiber-ratings/travis-kelce?format=redraft&season=2024&week=6"
# Expected: Health penalty applied, score reflects limited opportunity
```

### Team Changes Mid-Season  
```sql
-- Players who switched teams
SELECT pi.player_id, pp.name, pi.team, pi.week, 
       COUNT(DISTINCT pi.team) OVER (PARTITION BY pi.player_id) as team_changes
FROM player_inputs pi
JOIN player_profile pp ON pi.player_id = pp.player_id
WHERE pi.season = 2024
  AND (SELECT COUNT(DISTINCT team) FROM player_inputs pi2 WHERE pi2.player_id = pi.player_id AND pi2.season = 2024) > 1
LIMIT 5;
-- Expected: Team environment component should reflect current team context
```

## Dynasty-Specific Testing

### Age Curve Application
```sql
-- Validate age curve multipliers are applied
SELECT pp.name, pp.position, pp.age, ps.score as dynasty_score,
       ac.multiplier as age_multiplier
FROM player_scores ps
JOIN player_profile pp ON ps.player_id = pp.player_id
JOIN age_curves ac ON pp.position = ac.position AND CAST(pp.age AS INTEGER) = ac.age
WHERE ps.format = 'dynasty' AND ps.season = 2024
LIMIT 10;
-- Expected: Age curves properly reflected in dynasty scores
```

### 3-Year Projection Discounting
```bash
# Dynasty scores should weight future years properly
# Year 1: 60%, Year 2: 25%, Year 3: 15%
curl "/api/tiber-ratings?format=dynasty&position=RB&season=2024&debug=1&limit=5"
# Expected: Proj3 component reflects proper discounting
```

## Performance & Regression Testing

### Batch Query Efficiency
```bash
# Large result sets should be fast
time curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&limit=200"
# Expected: Sub-2 second response time

# No N+1 query patterns
# Monitor DB query logs during API calls
```

### Weekly Compute Job Validation
```bash
# Recompute endpoint
curl -X POST "/api/tiber-ratings/recompute?format=redraft&position=RB&season=2024&week=6"
# Expected: Successful batch update, consistent scores before/after for unchanged data
```

### Weights Override Regression
```bash
# Test several weight combinations
curl "/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&weights=0.4,0.3,0.15,0.1,0.03,0.02&debug=1"
curl "/api/tiber-ratings?format=redraft&position=WR&season=2024&week=6&weights=0.35,0.25,0.2,0.15,0.03,0.02&debug=1"

# Verify debug components use custom weights, not defaults
```

## Data Quality Checks

### Score Component Ranges
```sql
-- Debug components should be reasonable percentiles (0-100 range)
SELECT 
  MIN(CAST(debug_json->>'Opp' AS INTEGER)) as min_opp,
  MAX(CAST(debug_json->>'Opp' AS INTEGER)) as max_opp,
  MIN(CAST(debug_json->>'Eff' AS INTEGER)) as min_eff, 
  MAX(CAST(debug_json->>'Eff' AS INTEGER)) as max_eff
FROM player_scores
WHERE season = 2024 AND format = 'redraft' AND debug_json IS NOT NULL;
-- Expected: Components roughly in 0-100 range, Health can be negative
```

### Cross-Format Consistency
```sql
-- Same player's opportunity should be similar between formats
SELECT pp.name, ps1.position,
       ps1.debug_json->>'Opp' as redraft_opp,
       ps2.debug_json->>'Proj3' as dynasty_proj3
FROM player_scores ps1
JOIN player_scores ps2 ON ps1.player_id = ps2.player_id
JOIN player_profile pp ON ps1.player_id = pp.player_id
WHERE ps1.format = 'redraft' AND ps2.format = 'dynasty'
  AND ps1.season = 2024 AND ps2.season = 2024
  AND ps1.week = 6 AND ps2.week IS NULL
LIMIT 5;
-- Expected: Similar opportunity/projection components across formats
```

## Mathematical Validation

### Percentile Normalization
```sql
-- Scores should be normalized to 0-100 within position
SELECT ps.position, ps.format,
       MIN(ps.score) as min_score,
       MAX(ps.score) as max_score,
       AVG(ps.score) as avg_score
FROM player_scores ps
WHERE ps.season = 2024
GROUP BY ps.position, ps.format;
-- Expected: Good spread from ~10-95, reasonable averages
```

### Component Sum Validation
```javascript
// Test debug components sum to total score (accounting for weights)
const response = await fetch('/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&debug=1&limit=5');
const data = await response.json();

data.items.forEach(player => {
  const { debug, weights, score } = player;
  const calculatedScore = 
    debug.Opp * weights.opp +
    debug.Eff * weights.eff +
    debug.Role * weights.role +
    debug.Team * weights.team +
    debug.Health * (weights.health || 0.05) +
    debug.SOS * weights.sos;
  
  const difference = Math.abs(score - calculatedScore);
  console.assert(difference < 5, `Score mismatch for ${player.name}: expected ${calculatedScore}, got ${score}`);
});
```

## Go/No-Go Gates

Before merging to production, all of the following must be ✅:

- [ ] `/api/tiber-ratings` returns data for both redraft (weekly) and dynasty (seasonal) formats
- [ ] Parameter validation returns 400 errors for invalid format, position, or week values
- [ ] `debug=1` shows component breakdown and aligns with position-specific weights
- [ ] VOR calculations use correct replacement levels (RB40/WR48/TE16/QB12)
- [ ] `/api/tiber-ratings/tiers` returns sensible tier distributions (no single-player tiers)
- [ ] QA regression script passes locally and in CI
- [ ] Age curves are properly applied in dynasty format
- [ ] Weight overrides function correctly and are validated
- [ ] Performance benchmarks met (sub-2s for large queries)
- [ ] Database tables populated with representative sample data
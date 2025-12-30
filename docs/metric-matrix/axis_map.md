# Metric Matrix Axis Map — v1.1

## Overview

The Metric Matrix provides a 5-axis evaluation system for skill position players (WR, RB, TE, QB). Each axis represents a distinct dimension of player value, normalized to 0–100 scale.

## Axes

| Axis | Label | Purpose |
|------|-------|---------|
| `usage` | Usage | Volume of opportunity (snaps, routes, touches) |
| `efficiency` | Efficiency | Production per opportunity (yards/touch, FP/touch, catch rate) |
| `td_role` | TD Role | High-value scoring usage (TD rate, TDs/game, leverage usage) |
| `stability` | Stability | Reliability and sample confidence (availability, consistency, sample size) |
| `context` | Context | Situational factors (target share, usage trend, role security) |

## Position-Aware Normalization

Different positions have different scaling caps to ensure fair comparison within position groups:

### WR Caps
- Routes/game: 45
- Touches/game: 12
- Yards/touch: 12
- FP/touch: 1.8
- TDs/game: 1.5
- TD rate: 15%

### RB Caps
- Routes/game: 30
- Touches/game: 25
- Yards/touch: 6
- FP/touch: 1.0
- TDs/game: 1.5
- TD rate: 8%

### TE Caps
- Routes/game: 35
- Touches/game: 10
- Yards/touch: 10
- FP/touch: 1.5
- TDs/game: 1.0
- TD rate: 12%

### QB Caps
- Routes/game: 1 (not applicable)
- Touches/game: 35 (pass attempts + rushes)
- Yards/touch: 8
- FP/touch: 0.8
- TDs/game: 2.5
- TD rate: 10%

## Early-Season Handling Philosophy

### Availability

The availability metric answers: "Has this player been available when called upon?"

**Formula:**
```
availability = games_played / clamp(resolved_week, 1, 18)
```

At week 3, a player with 3 games has 100% availability. This prevents unfair penalization early in the season when 18-game denominators would tank every player's stability score.

### Sample Size

The sample size component uses a 6-game threshold for "sufficient" data:

```
sample_size = clamp(games / 6, 0, 1)
```

This provides a gradual confidence ramp:
- Week 1: ~17%
- Week 3: 50%
- Week 6: 100%

### Fantasy Point Consistency

The fp_consistency metric uses standard deviation of weekly fantasy points, inverted so lower variance = higher score:

```
fp_consistency = clamp(100 - clamp(std_dev, 0, 8) * 10, 20, 100)
```

Key refinements:
- Standard deviation is clamped to 0–8 range before scaling
- Output floor of 20 prevents "consistency" from cratering even with high variance
- This prevents early-season outliers from dominating the score

## Determinism

Same inputs always produce same outputs:
- No randomness in normalization
- Position detection from weekly_stats.position
- Fallback to WR caps if position is missing or unrecognized
- Cache key includes: playerId + season + week + mode

## API Response Shape

The endpoint returns:

```json
{
  "success": true,
  "data": {
    "playerId": "...",
    "playerName": "...",
    "position": "WR",
    "team": "...",
    "season": 2025,
    "week": 3,
    "mode": "forge",
    "axes": [
      {
        "key": "usage",
        "label": "Usage",
        "value": 75.5,
        "components": [
          { "key": "snap_share_pct", "value": 85.2 },
          { "key": "routes_per_game", "value": 72.1 },
          { "key": "touches_per_game", "value": 66.7 }
        ]
      }
    ],
    "confidence": 0.93,
    "missingInputs": []
  }
}
```

## Data Sources & Scaling

### snap_share_pct

**Source:** `nfl_data_py.import_snap_counts()` → `offense_pct` field

**Transformation:**
- Raw `offense_pct` is a decimal (0-1 scale, e.g., 0.87 = 87%)
- Stored in `player_usage.snap_share_pct` as 0-100 scale (e.g., 87.0)
- Backfill script: `server/scripts/backfillSnapSharePct.py`

**ID Mapping:**
- Snap counts use PFR player IDs (e.g., `ChasJa00`)
- Mapped to GSIS IDs (e.g., `00-0036900`) via `nfl_data_py.import_ids()`

### target_share_pct

**Source:** Calculated during weekly usage backfill from play-by-play data

**Transformation:**
- Stored as 0-100 scale (e.g., 21.74 = 21.74% target share)

### Missing Data & Bye Weeks

Players may have missing `snap_share_pct` for several reasons:

1. **Bye weeks** - No games played that week, so no snap data exists
2. **PFR ID mapping gaps** - Some players lack PFR→GSIS mappings
3. **Preseason/injured** - Player didn't appear in snap count reports

When `snap_share_pct` is NULL:
- The Metric Matrix shows it in `missingInputs`
- Confidence score is reduced proportionally
- The `role_security` metric (derived from snap share) also becomes NULL

### Guardrail: ensurePercentScale()

To prevent double-scaling issues when data arrives in different formats, use:

```typescript
ensurePercentScale(value)
// If value <= 1.0, treat as fraction → multiply by 100
// If value > 1.0, treat as already percent → return as-is
```

### Coverage Monitoring

Check data quality with:
```
GET /api/metric-matrix/coverage?season=2025&week=3
```

Returns % of rows with non-null snap_share_pct/target_share_pct.

## Changelog

### v1.2 (2025-12-30)
- Added snap_share_pct backfill from nfl_data_py snap counts
- Added coverage endpoint for data quality monitoring
- Added ensurePercentScale() guardrail for percent normalization
- Documented data sources, scaling, and bye week behavior

### v1.1 (2025-12-30)
- Added position-aware normalization caps (WR/RB/TE/QB)
- Fixed availability formula to use resolved week instead of hardcoded 18
- Added fp_consistency clamps (floor of 20, std dev capped at 8)
- Added documentation for early-season philosophy

### v1.0 (2025-12-29)
- Initial implementation with 5 axes
- Fixed normalization caps for all positions

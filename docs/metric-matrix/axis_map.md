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

## Changelog

### v1.1 (2025-12-30)
- Added position-aware normalization caps (WR/RB/TE/QB)
- Fixed availability formula to use resolved week instead of hardcoded 18
- Added fp_consistency clamps (floor of 20, std dev capped at 8)
- Added documentation for early-season philosophy

### v1.0 (2025-12-29)
- Initial implementation with 5 axes
- Fixed normalization caps for all positions

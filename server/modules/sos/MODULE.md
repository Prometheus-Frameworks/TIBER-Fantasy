# Strength of Schedule (SoS)

Computes weekly and rest-of-season strength of schedule scores per position. Blends season averages with recency-weighted last-4-week data, scaled to 0–100 percentiles.

## Files

| File | Purpose |
|------|---------|
| `sos.types.ts` | Shared type definitions |
| `sos.service.ts` | Core SoS calculations: `computeWeeklySOS()`, `computeROSSOS()`, `computeWeeklySOSv2()` |
| `sos.controller.ts` | Express request handlers |
| `sos.router.ts` | Route definitions |
| `contextSosService.ts` | Context-aware SoS using TRACKSTAR projections (2025 early season fallback) |
| `dashboard.controller.ts` | Dashboard-specific request handlers |
| `dashboard.service.ts` | Dashboard aggregation data |
| `teamRankings.service.ts` | Team ranking calculations |

## Endpoints

Registered via `sos.router.ts`. Key routes:

- Weekly SoS by position/week
- ROS (rest-of-season) SoS
- SOSv2 contextual mode with configurable weights
- Dashboard aggregation endpoints
- Team rankings

## DB Tables

| Table | Usage |
|-------|-------|
| `defense_dvp` (`defenseVP`) | Fantasy points allowed by defense per position per week. Has `last4_avg` precomputed column |
| `schedule` | Game schedule: season, week, home, away |
| `defense_context` | EPA/play allowed, plays/game, RZ TD rate, home/away adjustments |
| `team_offensive_context` | Pass/rush EPA, YBC/att, pressure rate |
| `team_defensive_context` | Defensive EPA, pressure rate generated |
| `team_receiver_alignment_matchups` | Outside WR/slot/TE fantasy points by team |
| `team_coverage_matchups` | Zone/man/2-high coverage splits and FP allowed |

## Scoring

- **v1 (FPA)**: Blends `last4_avg * 0.6 + season_avg * 0.4`, percentile-scaled 0–100
- **v2 (CTX)**: Weighted composite of FPA + EPA + Pace + Red Zone with configurable weights (default: 0.55/0.20/0.15/0.10). Includes venue adjustment
- **Tiers**: green (≥67), yellow (≥33), red (<33)
- **Early 2025 fallback**: Weeks 1–3 route to `contextSosService` TRACKSTAR projections

## Used By

- **FORGE**: `server/modules/forge/` imports SoS scores for alpha multipliers via `sosMultiplier.ts`
- **Start/Sit Engine**: Uses SoS as matchup factor
- **Rankings UI**: SoS columns in WR/RB/TE/QB rankings tables

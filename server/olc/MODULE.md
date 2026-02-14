# Opponent Level Context (OLC)

Calculates offensive line quality scores (0–100) per team per week. Combines PFF pass-block grades, ESPN win rates, pressure rates, and cohesion metrics into a single composite score with position-specific adjusters.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | `OlcBuilder` singleton, `buildOlcForWeek()` main entry, batch processing, caching |
| `schema.ts` | `OlcTeamWeek` type definition and related data structures |
| `sources.ts` | `OlSourceAdapter` — fetches raw OL data (PFF, ESPN, injuries, depth charts) |
| `normalize.ts` | `OlNormalizer` — Z-score normalization of raw metrics against league baselines |
| `score.ts` | `OlcScorer` — combines normalized metrics into composite OLC score with penalties |
| `cohesion.ts` | `OlCohesionCalculator` — measures lineup continuity (position, pair, snap sync) |
| `adjusters.ts` | `OlcAdjusterCalculator` — position-specific adjustments (QB env, RB runways, WR/TE timing) |
| `opponent.ts` | `OpponentContextCalculator` — opponent pass rush / run stuff context |
| `logger.ts` | OLC-specific logging |

## Scoring Pipeline

```
1. sources.ts    → Fetch PFF PB, ESPN PBWR/RBWR, pressure rate, ASR, YBC/rush, injuries, depth chart
2. normalize.ts  → Z-score normalize each metric against league averages
3. cohesion.ts   → Calculate lineup continuity from depth chart changes
4. score.ts      → Weighted composite → OLC raw score
                   Apply injury/shuffle/green penalties
                   Sigmoid scale to OLC_100 (0-100)
5. adjusters.ts  → Position-specific modifiers:
                   - qb_env: pass protection quality for QB
                   - rb_runways: run blocking quality for RB
                   - wrte_timing: timing/protection for pass catchers
6. opponent.ts   → Opponent context: pass rush strength, run stuff rate
```

## Key Output: `OlcTeamWeek`

```typescript
{
  teamId, season, week,
  olc_100,           // Final 0-100 score
  olc_raw,           // Raw composite before scaling
  cohesion_score, cohesion_z,
  injury_penalty, shuffle_penalty, green_penalty, total_penalty,
  scale_k, sigma,
  components: { pff_pb, espn_pbwr, espn_rbwr, pressure_rate, adjusted_sack_rate, ybc_per_rush },
  adjusters: { qb_env, rb_runways, wrte_timing },
  opponent_context: { pass_context_w, run_context_w, def_pass_rush_strength, def_run_stuff_rate }
}
```

## Caching

- In-memory cache with 6-hour TTL per `{teamId}-{season}-{week}` key
- `forceRefresh` option bypasses cache
- `buildOlcBatch()` for processing multiple teams in parallel

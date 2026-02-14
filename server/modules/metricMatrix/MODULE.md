# Metric Matrix

Multi-axis player evaluation system that converts raw stats into normalized radar-chart vectors. Used for player comparison, similarity finding, tier analysis, and league ownership tracking.

## Files

| File | Purpose |
|------|---------|
| `playerVectorService.ts` | `getPlayerVector()` — builds normalized axis vectors from weekly stats and usage data. Reads axis definitions from `docs/metric-matrix/axis_map.json`. Caches results in `metric_matrix_player_vectors` table |
| `similarPlayersService.ts` | Finds players with similar vector profiles using distance metrics |
| `tiersNeighborsService.ts` | Groups players into tiers and finds nearest neighbors within/across tiers |
| `leagueOwnershipService.ts` | Tracks player ownership across connected Sleeper leagues |

## How It Works

### Player Vector Pipeline
```
1. Fetch weekly_stats + player_usage for player/season/week
2. Derive raw metrics: snap_share, routes/game, touches/game, FP/touch, yards/touch,
   catch_rate, td_rate, availability, consistency, usage trend, role security
3. Normalize each metric using position-specific caps (WR/RB/TE/QB have different scales)
4. Apply axis weights from axis_map.json to build composite axis scores (0-100)
5. Calculate confidence based on data completeness
6. Cache result in DB for fast retrieval
```

### Position-Specific Caps

Each position has tuned maximum values for normalization:

| Metric | WR | RB | TE | QB |
|--------|-----|-----|-----|-----|
| Routes/game cap | 45 | 30 | 35 | 1 |
| Touches/game cap | 12 | 25 | 10 | 35 |
| Yards/touch cap | 12 | 6 | 10 | 8 |
| FP/touch cap | 1.8 | 1.0 | 1.5 | 0.8 |

### Axis Map

Axis definitions live in `docs/metric-matrix/axis_map.json`. Each axis specifies:
- `key` / `label` — identifier and display name
- `inputs` — which raw metrics feed into this axis
- `weights` — how much each input contributes
- `normalization` — `minmax` or `percentile`
- `defaults` — fallback value when data is missing

### Key Types

```typescript
interface PlayerVectorResponse {
  playerId, playerName, position, team, season, week, mode,
  axes: Array<{ key, label, value, components: Array<{ key, value }> }>,
  confidence: number,   // 0-1 based on data completeness
  missingInputs: string[]
}
```

## DB Tables

| Table | Purpose |
|-------|---------|
| `metric_matrix_player_vectors` | Cached vector results (PK: playerId + season + week + mode) |
| `weekly_stats` | Source stats data |
| `player_usage` | Source usage/snap share data |

# Prediction Engine

Weekly prediction generation that compares Tiber's internal rankings against ECR (Expert Consensus Rankings) to find edge picks. Uses compass-direction scoring (NORTH/EAST/SOUTH/WEST) with dynamic seasonal weighting and CI-based decision policy.

## Files

| File | Purpose |
|------|---------|
| `server/services/predictionEngine.ts` | Full engine in a single file. Scoring functions, feature assembly, selection policy, in-memory store, and Express router |

## How It Works

```
[1] Feature Assembly — assemblePlayerFeatures(week)
    - Queries real players from DB (active, top by rostered%)
    - Gets NORTH metrics from RankingsFusion (volume/talent)
    - Gets EAST metrics from compass (environment/scheme)
    - Gets SOUTH metrics from RiskEngine (risk/durability)
    - Gets WEST metrics from MarketEngine + ECRService (market/value)
        ↓
[2] Compass Scoring — per-player
    - scoreNorth(): routes rate, TPRR, YPRR, rush share, target share, RZ opps
    - scoreEast(): team PROE, pace, OL PBWR, opp pressure, regime shifts
    - scoreSouth(): practice flags, games missed, age curve, weather risk
    - scoreWest(): ADP momentum, start% delta, contract cliff (selection filter only)
        ↓
[3] Combine to Points — combineToPoints(pos, week, N, E, S_penalty)
    - Seasonal weights: early (E-heavy), mid (N-heavy), late (S-heavy)
    - Position-specific baselines (QB:18, RB:12, WR:10, TE:8)
    - WEST is NOT in points — used only as selection/surfacing layer
        ↓
[4] Selection Policy — shouldPublishBeat()
    - Edge minimum per position (QB:1.8, RB:1.5, WR:1.3, TE:0.8)
    - CI width maximum per position
    - Must have WEST misprice signal
    - Blocked if SOUTH hard flag + wide CI
        ↓
[5] Store — in-memory Map<run_id, WeeklyPrediction[]>
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/predictions/generate-weekly` | Generate predictions (admin, requires week + optional features) |
| `GET` | `/api/predictions/:run_id/summary` | Prediction summary for a run |
| `GET` | `/api/predictions/:run_id/players` | All predictions (filters: `pos`, `beat_only`) |
| `GET` | `/api/predictions/latest/summary` | Latest public summary |
| `GET` | `/api/predictions/latest/players` | Latest public predictions |

## Dependencies

| Dependency | Usage |
|------------|-------|
| `RankingsFusionService` | NORTH quadrant compass data |
| `RiskEngine` | SOUTH quadrant risk components |
| `MarketEngine` | WEST quadrant market signals |
| `ECRService` | ECR rank/points for edge calculation |
| `ecrAdapter` | ECR data normalization |
| `players`, `playerWeekFacts` tables | Real player data from DB |

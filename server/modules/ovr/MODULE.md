# OVR (Overall Rating) System

Madden-style 1–99 player ratings that aggregate multiple data sources into a single unified score. Supports both redraft (Sleeper performance-based) and dynasty (Compass-based) scoring modes.

## Files

| File | Purpose |
|------|---------|
| `server/modules/ovr/index.ts` | Module entry point and barrel exports |
| `server/modules/ovr/ovrForgeAdapter.ts` | Adapts FORGE Alpha scores for OVR consumption |
| `server/services/ovrService.ts` | Main OVR service. `OVRService` class with `calculateOVR()` and `calculateBatchOVR()`. Gathers data from RankingsFusion, PlayerCompass, TRACKSTAR environment. Position-specific weighting via config |
| `server/services/ovrEngine.ts` | Dynamic OVR calculation engine. Uses compass directions (NORTH/EAST/SOUTH/WEST), delta rules, decay config |
| `server/services/ovrCache.ts` | In-memory caching layer with TTL |
| `server/routes/ovrRoutes.ts` | Routes mounted at `/api/ovr/*` |

## How OVR is Calculated

```
[1] Gather input data from all sources:
    - Redraft: Sleeper API game logs → sleeperOvrScorer (DIRECT OVR, no blending)
    - Dynasty: PlayerCompass score → normalized to 0-100
    - TRACKSTAR environment score (pace, scoring, red zone efficiency)
    - RankingsFusion score (position-specific batch scoring)
        ↓
[2] Calculate confidence per source (0-1)
    - Fusion: penalized for rookie/market caps
    - Compass: full confidence if available
    - TRACKSTAR: time-decay based on data freshness
        ↓
[3] Calculate position+format-specific weights from config/ovr.v1.json
    - Confidence-adjusted and renormalized to sum to 1
        ↓
[4] Compute weighted composite score (0-100)
    - Redraft SLEEPER-ONLY mode: bypass blending, use direct performance OVR
        ↓
[5] Apply Madden curve mapping (percentile → 1-99 scale)
    - Proven elite floor for established players
        ↓
[6] Assign tier: Elite (90+), Star (80+), Starter (65+), Backup (50+), Bench (<50)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ovr/player/:id` | Single player OVR |
| `GET` | `/api/ovr/batch` | Batch OVR by position |
| `GET` | `/api/ovr/health` | Service health check |

## Config

`config/ovr.v1.json` — Position weights (redraft/dynasty per position), confidence parameters, normalization settings, Madden curve mapping.

## Dependencies

| Dependency | Usage |
|------------|-------|
| `RankingsFusionService` | Fusion scores (xFP + compass) |
| `PlayerCompassService` | Dynasty compass scoring |
| `teamEnvironmentService` | TRACKSTAR team environment metrics |
| `sleeperOvrScorer` | Sleeper-based weekly performance scoring |
| FORGE (via `ovrForgeAdapter.ts`) | Adapts FORGE Alpha for OVR input |

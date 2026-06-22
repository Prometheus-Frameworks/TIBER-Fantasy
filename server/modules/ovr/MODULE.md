# OVR (Overall Rating) System

> [!WARNING]
> **Classification:** `DEPRECATE_NOW`.
> **Work status:** Freeze net-new feature work here. Do not add new scoring paradigms, new routes, or new product bets on top of OVR.
> **Allowed changes:** Bug fixes, compatibility fixes, consumer support, and retirement/replacement prep only.
> **Long-term destination:** Replace OVR with one canonical derived consumer path or retire it after downstream consumers are migrated.
> **Dependency caveat:** OVR overlaps with other player-evaluation systems and still has active consumers, so cleanup must be deliberate.
> **Repo-wide doctrine:** See `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` and `docs/architecture/LEGACY_MODULE_WORK_RULES.md`.

Madden-style 1–99 player ratings that aggregate multiple data sources into a single unified score. Supports both redraft (Sleeper performance-based) and dynasty (Compass-based) scoring modes.

## Files

### Live / protected (do not remove without consumer migration)

| File | Purpose |
|------|---------|
| `server/services/ovrEngine.ts` | Dynamic OVR calculation engine (compass directions NORTH/EAST/SOUTH/WEST, delta rules, decay config). Backs the **inline** `/api/ovr` seed/update/compass/player engine endpoints in `server/routes.ts`; not used by the primary `ovrRoutes.ts` read routes. **Live.** |
| `server/routes/ovrRoutes.ts` | Primary `/api/ovr` read routes (`GET /api/ovr`, `/:playerId`, `/health`); computes from the `players` table (`avgPoints` + `calculateSimpleOVR` fallback). **Live.** |

The live `/api/ovr` surface is served by `ovrRoutes.ts` (mounted first in `server/routes.ts`) together with inline `/api/ovr/*` endpoints defined directly in `server/routes.ts`. `ovrEngine.ts`, `ovrRoutes.ts`, and the `/api/ovr` endpoints remain live and protected. See "How OVR is Calculated" below for which path each uses.

The `server/modules/ovr/` directory itself now contains only this `MODULE.md`; there are no remaining `.ts` files in it.

### Removed in PR #262 (confirmed-orphaned compute; no longer present)

| File | Former purpose |
|------|----------------|
| `server/modules/ovr/index.ts` | Module entry point and barrel exports |
| `server/modules/ovr/ovrForgeAdapter.ts` | Adapted FORGE Alpha scores for OVR consumption |
| `server/services/ovrService.ts` | Former main OVR service (`OVRService` with `calculateOVR()` / `calculateBatchOVR()`); gathered data from RankingsFusion, PlayerCompass, TRACKSTAR environment |
| `server/services/ovrCache.ts` | In-memory caching layer with TTL |
| `server/services/sleeperOvrScorer.ts` | Sleeper-based weekly performance scoring (DIRECT OVR, no blending) |

## How OVR is Calculated

> [!NOTE]
> The blended multi-source flow below documents the **legacy** `ovrService` pipeline, which was removed in PR #262 (see the "Removed in PR #262" table above). It is retained here as historical reference only, names files that no longer exist (`sleeperOvrScorer`, `ovrService`, `ovrForgeAdapter`), and does **not** describe either live compute path.
>
> The live `/api/ovr` surface today has two distinct compute paths:
> - **Primary read routes** in `server/routes/ovrRoutes.ts` (`GET /api/ovr`, `GET /api/ovr/:playerId`, `GET /api/ovr/health`) compute OVR directly from the `players` table — `avgPoints`, with a `calculateSimpleOVR` position/age baseline fallback. These do **not** import `ovrEngine`.
> - **Inline engine endpoints** in `server/routes.ts` (`POST /api/ovr/seed`, `POST /api/ovr/update`, `POST /api/ovr/compass`, `GET /api/ovr/player/:playerId`) use `ovrEngine.ts` (compass directions, delta rules, decay).

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

> [!NOTE]
> The dependencies below applied to the **legacy** `ovrService` pipeline removed in PR #262. Rows that point at removed files (`sleeperOvrScorer`, `ovrForgeAdapter.ts`) are marked accordingly and are no longer wired.

| Dependency | Usage |
|------------|-------|
| `RankingsFusionService` | Fusion scores (xFP + compass) — used by the legacy pipeline |
| `PlayerCompassService` | Dynasty compass scoring — used by the legacy pipeline |
| `teamEnvironmentService` | TRACKSTAR team environment metrics — used by the legacy pipeline |
| `sleeperOvrScorer` | Sleeper-based weekly performance scoring — **removed in PR #262** |
| FORGE (via `ovrForgeAdapter.ts`) | Adapted FORGE Alpha for OVR input — **removed in PR #262** |

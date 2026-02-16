# API SPEC — FORGE Tiers Endpoints

## 1. GET `/api/forge/tiers` — Read Cached Grades

**Purpose:** Fast read-only endpoint for the Tiers page. Reads from `forge_grade_cache`.

### Request

```
GET /api/forge/tiers?season=2025&position=WR&limit=50&asOfWeek=17
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `season` | number | 2025 | NFL season |
| `position` | string | `ALL` | `QB`, `RB`, `WR`, `TE`, or `ALL` |
| `limit` | number | 100 | Max players to return (cap at 300) |
| `asOfWeek` | number | latest | Week number; if omitted, use the latest `as_of_week` in cache |

### Response (200)

```json
{
  "season": 2025,
  "asOfWeek": 17,
  "position": "WR",
  "computedAt": "2025-02-15T10:30:00Z",
  "version": "v1",
  "count": 50,
  "fallback": false,
  "players": [
    {
      "playerId": "puka_nacua_canonical",
      "playerName": "Puka Nacua",
      "position": "WR",
      "nflTeam": "LA",
      "rank": 1,
      "alpha": 89.3,
      "rawAlpha": 91.0,
      "tier": "T1",
      "tierNumeric": 1,
      "subscores": {
        "volume": 92.1,
        "efficiency": 87.4,
        "teamContext": 85.0,
        "stability": 80.2,
        "dynastyContext": 76.5
      },
      "trajectory": "rising",
      "confidence": 88.0,
      "gamesPlayed": 16,
      "footballLensIssues": [],
      "lensAdjustment": 0,
      "fantasyStats": {
        "ppgPpr": 23.6,
        "seasonFptsPpr": 377.0,
        "targets": 166,
        "touches": null
      }
    }
  ]
}
```

### Fallback Response (200, cache empty)

```json
{
  "season": 2025,
  "asOfWeek": 17,
  "position": "WR",
  "fallback": true,
  "message": "FORGE grades not yet computed for this week. Run POST /api/forge/compute-grades to generate.",
  "count": 0,
  "players": []
}
```

### Implementation Notes

1. Query `forge_grade_cache` with the provided filters
2. If no `asOfWeek` param, find MAX(`as_of_week`) for the season
3. Add `rank` field as row number (1-indexed) based on `alpha DESC` ordering
4. Map DB columns to response shape (camelCase)
5. Set `fallback: true` if zero rows found

---

## 2. POST `/api/forge/compute-grades` — Trigger Grade Computation

**Purpose:** Admin endpoint to pre-compute FORGE grades and populate the cache.

### Request

```
POST /api/forge/compute-grades
Content-Type: application/json

{
  "season": 2025,
  "asOfWeek": 17,
  "position": "ALL",
  "limit": 200
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `season` | number | 2025 | NFL season |
| `asOfWeek` | number | 17 | Week to compute through |
| `position` | string | `ALL` | `QB`, `RB`, `WR`, `TE`, or `ALL` |
| `limit` | number | 200 | Max players per position |

### Authentication

Check for admin key. Use existing pattern from the codebase:

```typescript
const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
if (adminKey !== process.env.FORGE_ADMIN_KEY) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### Response (200)

```json
{
  "status": "completed",
  "season": 2025,
  "asOfWeek": 17,
  "results": {
    "QB": { "computed": 32, "errors": 0, "durationMs": 8500 },
    "RB": { "computed": 48, "errors": 1, "durationMs": 12000 },
    "WR": { "computed": 65, "errors": 2, "durationMs": 18000 },
    "TE": { "computed": 30, "errors": 0, "durationMs": 7500 }
  },
  "totalDurationMs": 46000,
  "version": "v1"
}
```

### Error Handling

- If a player fails to compute, log the error and continue (don't abort batch)
- Include error count in response per position
- If ALL players fail, return 500

---

## 3. Pipeline: How Grades Are Computed

For each player in the position's role bank:

```
1. runForgeEngine(playerId, position, season, 'season')
   → Returns: ForgeEngineOutput { playerId, playerName, position, nflTeam,
              season, week, gamesPlayed, pillars, dynastyContext, qbContext,
              priorAlpha, alphaMomentum, rawMetrics }

2. gradeForge(engineOutput, { mode: 'redraft' })
   → IMPORTANT: gradeForge() calls applyFootballLens() INTERNALLY (line 181).
     Do NOT call applyFootballLens() separately — it would double-apply.
   → Returns ForgeGradeResult:
     { alpha: number, tier: string ('T1'-'T5'), tierPosition: number (1-5),
       pillars: ForgePillarScores, issues?: FootballLensIssue[],
       debug?: { baseAlpha, recursionAdjustment, footballLensAdjusted } }

3. Fetch fantasy stats from datadive
   → Returns: { ppgPpr, seasonFptsPpr, targets, touches }

4. Upsert into forge_grade_cache
   → Map result.tierPosition → tier_numeric column
```

**Key functions to import (all in `server/modules/forge/`):**
- `runForgeEngine` from `./forgeEngine` — Step 1
- `gradeForge` from `./forgeGrading` — Step 2 (includes lens + weights + recursion + tier)
- `gradeForgeWithMeta` from `./forgeGrading` — Alternative that wraps gradeForge with player identity fields

**asOfWeek semantics:** The `asOfWeek` parameter in the cache table is a metadata label (which week the data was computed through). The engine always receives `'season'` as the week param to aggregate across all available weeks. The admin chooses `asOfWeek` when triggering computation to label the cache entry.

---

## 4. Endpoint Registration

Add routes in `server/modules/forge/routes.ts`:

```typescript
// At the top with other imports
import { computeAndCacheGrades, getGradesFromCache } from './forgeGradeCache';

// GET endpoint - serves cached grades
router.get('/tiers', async (req, res) => { ... });

// POST endpoint - triggers computation
router.post('/compute-grades', async (req, res) => { ... });
```

The FORGE routes are already mounted at `/api/forge` in the main routes file, so these will be available at `/api/forge/tiers` and `/api/forge/compute-grades`.

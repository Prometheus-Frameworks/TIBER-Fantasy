# CODEX RUNBOOK — FORGE Tiers Migration

## Mission
Replace the PPG-bucket ranking system on the Tiers page (`/tiers`) with canonical FORGE Alpha scores. Players must be ranked by their true FORGE grade (0-100), not fantasy points per game.

## Current Problem
`TiberTiers.tsx` calls the `/api/data-lab/lab-agg` endpoint, which returns raw `datadive_snapshot_player_week` aggregations. The frontend then applies PPG-based tier thresholds (e.g., WR T1 if PPG ≥ 20). This completely bypasses:
- FORGE Engine (4-pillar scoring: Volume, Efficiency, Team Context, Stability)
- Football Lens (issue detection + adjustments)
- FORGE Grading (position-specific weights, recursion, Alpha calibration)
- Tiber Tiers (Alpha-based T1-T5 thresholds)

## Architecture Decision
**Pre-compute and cache FORGE grades in a new DB table** (`forge_grade_cache`), then serve them via a fast read-only endpoint. This avoids the 38+ second batch computation timeout.

---

## Implementation Sequence

### Phase 1: Database — `forge_grade_cache` Table
**File:** `shared/schema.ts`

Add a new table to store pre-computed FORGE grades:

```
forge_grade_cache {
  id                SERIAL PRIMARY KEY,
  player_id         TEXT NOT NULL,        -- canonical_id from player_identity_map
  player_name       TEXT NOT NULL,
  position          TEXT NOT NULL,        -- 'QB' | 'RB' | 'WR' | 'TE'
  nfl_team          TEXT,
  season            INTEGER NOT NULL,
  as_of_week        INTEGER NOT NULL,     -- which week this grade covers through
  
  -- FORGE scores
  alpha             REAL NOT NULL,        -- Final calibrated score 0-100
  raw_alpha         REAL,                 -- Pre-calibration (debug)
  volume_score      REAL,                 -- Pillar: Volume
  efficiency_score  REAL,                 -- Pillar: Efficiency
  team_context_score REAL,               -- Pillar: Team Context
  stability_score   REAL,                 -- Pillar: Stability
  dynasty_context   REAL,                -- Dynasty mode context (WR only)
  
  -- Tier assignment (from gradeForge() → ForgeGradeResult)
  tier              TEXT NOT NULL,        -- 'T1' | 'T2' | 'T3' | 'T4' | 'T5' (from result.tier)
  tier_numeric      INTEGER NOT NULL,     -- 1-5 (from result.tierPosition)
  
  -- Football Lens
  football_lens_issues TEXT[],           -- Array of detected issue codes
  lens_adjustment   REAL DEFAULT 0,      -- Total adjustment from lens
  
  -- Confidence & metadata
  confidence        REAL,                 -- 0-100
  trajectory        TEXT,                 -- 'rising' | 'flat' | 'declining'
  games_played      INTEGER,
  
  -- Fantasy stats (for display alongside FORGE data)
  ppg_ppr           REAL,
  season_fpts_ppr   REAL,
  targets           INTEGER,
  touches           INTEGER,
  
  -- Cache management
  computed_at       TIMESTAMP DEFAULT NOW(),
  version           TEXT DEFAULT 'v1',    -- Grade version for cache busting
  
  UNIQUE(player_id, season, as_of_week, version)
}
```

**Indexes:**
- `(season, as_of_week, position)` — primary query pattern
- `(player_id)` — single-player lookups
- `(season, as_of_week, position, alpha DESC)` — pre-sorted reads

**Run:** `npm run db:push` after adding the schema.

### Phase 2: Grade Computation Service
**New file:** `server/modules/forge/forgeGradeCache.ts`

This service pre-computes FORGE grades and stores them in the cache table.

1. **Entry point:** `async function computeAndCacheGrades(position, season, asOfWeek)`
2. **Player list:** Query `{position}_role_bank` for all players with data in the given season
3. **For each player (can be sequential — this runs as admin job, not user-facing):**
   a. Call `runForgeEngine(playerId, position, season, 'season')` from `forgeEngine.ts`
      - Always pass `'season'` as the week param (aggregates all weeks). The `asOfWeek` stored in the cache is metadata labeling which week the data was computed through, NOT a filter passed to the engine.
   b. Call `gradeForge(engineOutput, { mode: 'redraft' })` from `forgeGrading.ts`
      - **IMPORTANT:** `gradeForge()` calls `applyFootballLens()` internally (line 181). Do NOT call `applyFootballLens()` separately — that would double-apply lens adjustments.
      - Returns `ForgeGradeResult` with: `alpha`, `tier` (string: 'T1'-'T5'), `tierPosition` (number: 1-5), `pillars`, `issues[]`, `debug`
   c. Fetch fantasy stats from `datadive_snapshot_player_week` (PPG, targets, etc.)
   d. Upsert result into `forge_grade_cache`
      - Map `gradeResult.tierPosition` → `tier_numeric` column in the cache table
4. **Batch all positions:** `computeAllGrades(season, asOfWeek)` loops QB/RB/WR/TE
5. **Admin trigger:** Wire to an admin API route (e.g., `POST /api/forge/compute-grades`)

**Performance guard:** Log per-player timing. Expected: ~200-500ms per player × ~200 players = 40-100 seconds total for batch. This is acceptable for an admin job.

### Phase 3: API Endpoint — `/api/forge/tiers`
**File:** `server/modules/forge/routes.ts`

New read-only endpoint serving cached grades:

```
GET /api/forge/tiers?season=2025&position=WR&limit=50
```

**Response shape:**
```json
{
  "season": 2025,
  "asOfWeek": 17,
  "position": "WR",
  "computedAt": "2025-02-15T...",
  "count": 50,
  "players": [
    {
      "playerId": "...",
      "playerName": "Puka Nacua",
      "position": "WR",
      "nflTeam": "LA",
      "rank": 1,
      "alpha": 89.3,
      "tier": "T1",
      "tierNumeric": 1,
      "subscores": { "volume": 92, "efficiency": 87, "teamContext": 85, "stability": 80 },
      "trajectory": "rising",
      "confidence": 88,
      "gamesPlayed": 16,
      "footballLensIssues": [],
      "lensAdjustment": 0,
      "fantasyStats": { "ppgPpr": 23.6, "seasonFptsPpr": 377.0, "targets": 166 }
    }
  ]
}
```

**Fallback:** If `forge_grade_cache` is empty for the requested params, return `{ fallback: true, message: "Grades not yet computed" }` with 200 status so the frontend can show a meaningful state.

### Phase 4: Frontend Migration — `TiberTiers.tsx`
**File:** `client/src/pages/TiberTiers.tsx`

1. **Change data source:** Replace the `/api/data-lab/lab-agg` fetch with `/api/forge/tiers`
2. **Remove PPG-based tier logic:** Delete all `assignTierByPPG` / PPG threshold code
3. **Display FORGE data:**
   - Primary sort: by `alpha` (descending)
   - Tier badges: use `tier` from response (T1-T5)
   - Show pillar breakdown (Volume, Efficiency, Context, Stability) in expandable row or tooltip
   - Show `trajectory` indicator (rising/flat/declining arrow)
   - Show `footballLensIssues` as warning badges
   - Keep fantasy stats (PPG, targets, etc.) as secondary columns
4. **Fallback UX:** If `fallback: true`, show "FORGE grades are being computed..." with a loading state

### Phase 5: Admin Trigger for Re-computation
**File:** `server/modules/forge/routes.ts`

```
POST /api/forge/compute-grades
Body: { season?: number, position?: string, asOfWeek?: number }
Headers: Authorization (admin key check)
```

This triggers `computeAndCacheGrades()`. Protect with the existing admin auth pattern.

---

## Guardrails

### DO NOT
- Modify `forgeEngine.ts`, `forgeGrading.ts`, or `forgeFootballLens.ts` logic — these are the canonical FORGE algorithms
- Change existing `/api/forge/eg/batch` or `/api/forge/eg/player` endpoints
- Touch role bank table schemas
- Add any PPG-based tier logic — that's what we're removing

### DO
- Use the existing `runForgeEngine()` → lens → grading pipeline as-is
- Add proper error handling for missing data (some players may lack role bank entries)
- Log computation timing for each phase
- Use `ON CONFLICT ... DO UPDATE` (upsert) for the cache table writes

---

## Acceptance Criteria

1. **Tiers page shows FORGE Alpha scores** — not PPG-derived tiers
2. **Tier assignments match FORGE thresholds** from `types.ts`:
   - WR: T1≥82, T2≥72, T3≥58, T4≥45, T5<45
   - RB: T1≥78, T2≥68, T3≥55, T4≥42, T5<42
   - QB: T1≥70, T2≥55, T3≥42, T4≥32, T5<32
   - TE: T1≥82, T2≥70, T3≥55, T4≥42, T5<42
3. **Tiers page loads in < 2 seconds** (reading from cache, not computing live)
4. **Sanity check passes** — see SANITY_SAMPLE.md for expected ranges
5. **Football Lens issues visible** — badges show for flagged players
6. **Admin can trigger re-computation** via POST endpoint
7. **Fallback works** — if cache is empty, frontend shows graceful "computing" state

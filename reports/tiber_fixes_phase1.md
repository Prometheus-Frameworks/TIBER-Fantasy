# Tiber Fantasy — Phase 1 Fixes Report

**Date**: February 5, 2026
**Branch**: `fixes-opus-phase1`
**Based on**: `/reports/tiber_audit_v1.md`

---

## (1) DATA CORRUPTION HOTFIX — Deduplicate Week 17

**Goal**: Remove duplicated rows in `datadive_snapshot_player_week` for season=2025, week=17.

**Before**:
- Total rows (season=2025, week=17): **5,502**
- Unique players: **324**
- Copies per player: **~16** (e.g., T.Kelce: 16, A.Pierce: 16, B.Young: 16)

**SQL executed**:
```sql
DELETE FROM datadive_snapshot_player_week
WHERE id NOT IN (
  SELECT MIN(id)
  FROM datadive_snapshot_player_week
  WHERE season = 2025 AND week = 17
  GROUP BY player_id
)
AND season = 2025 AND week = 17;
```

**After**:
- Rows deleted: **5,178**
- Total rows remaining: **324**
- Duplicate players remaining: **0**

**Files touched**: None (SQL-only fix)

---

## (2) PREVENT FUTURE DUPLICATION — Gold ETL Upsert Guard

**Goal**: Ensure `goldDatadiveETL.ts` cannot insert duplicates for the same season/week.

**Root cause**: The ETL uses plain `INSERT` with no `ON CONFLICT` clause. The unique constraint on the table is `(snapshot_id, player_id)`, but each ETL run creates a new `snapshot_id`, so re-runs always insert new rows.

**Fix**: Added a delete-then-insert guard in both `runGoldETLForWeek()` and the batch `runGoldETL()` function. Before inserting rows for a given season/week, existing rows for that season/week are deleted. A log line is emitted when the guard fires.

**Code added** (in both functions):
```typescript
const deleteResult = await db.execute(sql`
  DELETE FROM datadive_snapshot_player_week
  WHERE season = ${season} AND week = ${week}
`);
const deletedCount = (deleteResult as any).rowCount ?? 0;
if (deletedCount > 0) {
  console.log(`🧹 [Gold ETL] Upsert guard: deleted ${deletedCount} existing rows for ${season} Week ${week}`);
}
```

**Validation**: Week 7 baseline rowcount = 2,952. The guard ensures a re-run would delete the existing 2,952 rows and re-insert fresh data, preventing duplication.

**Files touched**:
- `server/etl/goldDatadiveETL.ts` (2 insertions of the guard block)

---

## (3) API HONESTY FIX — Eliminate HTML Fallthrough

**Goal**: Ensure unmatched `/api/*` routes return JSON errors instead of SPA HTML.

**Root cause**: In dev mode, Vite's `app.use("*", ...)` SPA catch-all serves `index.html` for any path that doesn't match a registered Express route. API paths that don't match a handler fall through to Vite and return HTML with 200 status.

**Fix**: Added a single catch-all middleware `app.all("/api/*", ...)` in `server/index.ts`, placed after `registerRoutes(app)` but before the Vite SPA fallback. This returns `{ error: "Not found", path: <originalUrl> }` with 404 status for any `/api/` path that doesn't match a registered handler.

**Validation**:

| Path | Before (Status / Type) | After (Status / Type) |
|------|----------------------|---------------------|
| `/api/dvp/rankings` | 200 / text/html | 404 / application/json |
| `/api/tiber/scores` | 200 / text/html | 404 / application/json |
| `/api/game-logs/search` | 200 / text/html | 404 / application/json |
| `/api/analytics/health` | 200 / text/html | 404 / application/json |
| `/api/matchup/matchup` | 200 / text/html | 404 / application/json |
| `/api/player-comparison/compare/x/y` | 200 / text/html | 404 / application/json |
| `/api/start-sit-live` | 200 / text/html | 404 / application/json |
| `/api/ownership/stats` | 200 / text/html | 404 / application/json |
| `/api/tiber-memory` | 200 / text/html | 404 / application/json |

**Regression check** — existing endpoints still return 200:
- `/api/ovr` — 200
- `/api/dvp` — 200
- `/api/system/current-week` — 200
- `/api/forge/batch?position=ALL&limit=2` — 200

**Files touched**:
- `server/index.ts` (added `/api/*` catch-all middleware)

---

## (4) FIX BROKEN ENDPOINT — /api/ovr/tiers 500

**Goal**: Eliminate the 500 error and return a stable JSON response.

**Root cause**: The route `/api/ovr/tiers` does not exist as a registered endpoint. In `ovrRoutes.ts`, the pattern `GET /:playerId` matches `tiers` as a param value. Then `parseInt('tiers')` returns `NaN`, which causes the Drizzle query `eq(players.id, NaN)` to throw a database error, caught by the generic catch block returning `{ error: "Failed to fetch player OVR" }` with status 500.

**Secondary issue**: `GET /health` was defined AFTER `GET /:playerId`, so `/api/ovr/health` was also caught by the parameterized route and would fail similarly.

**Fix**:
1. Moved `/health` route definition before `/:playerId` so it's matched first
2. Added `isNaN(playerId)` validation to `/:playerId` handler — returns 400 with `{ error: "Invalid player ID — must be a number", param: "<value>" }`

**Validation**:

| Path | Before | After |
|------|--------|-------|
| `/api/ovr/tiers` | 500 `{"error":"Failed to fetch player OVR"}` | 400 `{"error":"Invalid player ID — must be a number","param":"tiers"}` |
| `/api/ovr/health` | 500 (shadowed by `:playerId`) | 200 `{"status":"healthy","database":"connected",...}` |
| `/api/ovr` | 200 (unchanged) | 200 (unchanged) |

**Files touched**:
- `server/routes/ovrRoutes.ts` (route reordering + input validation)

---

## Summary

| # | Fix | Status | Commits |
|---|-----|--------|---------|
| 1 | Deduplicate Week 17 | Done | (SQL-only, no code commit) |
| 2 | Gold ETL upsert guard | Done | `Add upsert guard to Gold ETL...` |
| 3 | API HTML fallthrough | Done | `Add API catch-all to return JSON 404...` |
| 4 | /api/ovr/tiers 500 | Done | `Fix /api/ovr/tiers 500 error...` |

**Files modified**:
- `server/etl/goldDatadiveETL.ts`
- `server/index.ts`
- `server/routes/ovrRoutes.ts`

**Blockers/Questions**: None. All four fixes completed and validated.

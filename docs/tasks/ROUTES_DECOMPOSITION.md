# ROUTES_DECOMPOSITION.md — Strategy for Decomposing `server/routes.ts`

> Task brief for coding agents. Each phase can be executed independently.

**Status**: Planning  
**Created**: 2026-02-15  
**Current State**: `server/routes.ts` — 10,644 lines, 228 route definitions  
**Target State**: `server/routes.ts` < 500 lines (imports, middleware, `app.use()` mounts only)

---

## 1. Why

`server/routes.ts` is a 10,644-line monolith containing 228 route definitions. This causes:

- **Merge conflicts**: Multiple agents or developers editing the same file simultaneously create constant merge conflicts.
- **Agent confusion**: AI coding agents struggle to navigate a 10K+ line file. They lose context, duplicate routes, and miss existing endpoints.
- **Hard to navigate**: Finding a specific route requires searching through thousands of lines across unrelated domains (rankings, roster sync, admin, health checks, etc.).
- **Slow iteration**: Any change to one route section risks breaking unrelated routes. Code review is painful.
- **No ownership boundaries**: It's impossible to assign a section to a team or agent — everything bleeds together.

The project already has ~25+ modular route files in `server/routes/` that prove the pattern works. The remaining inline routes need to follow suit.

---

## 2. Strategy

Extract inline routes in phases, prioritized by:

1. **Size** — Biggest blocks first for maximum line reduction per extraction.
2. **Risk** — Low-risk extractions first (pure route moves with no shared mutable state).
3. **Frequency** — Routes that agents edit most often get extracted sooner to reduce future conflicts.

### Already Extracted (no action needed)

These are already modular route files mounted via `app.use()` in `server/routes/`:

- `leagueSyncRoutes`, `userIntegrationRoutes`, `leagueDashboardRoutes`
- `sleeperSyncV2Routes`, `ownershipRoutes`
- `ratingsRoutes`, `attributesRoutes`, `metricMatrixRoutes`
- `rbCompassRoutes`, `teCompassRoutes`, `ragRoutes`
- `consensusRoutes`, `strategyRoutes`, `matchupRoutes`, `teamReportsRoutes`
- `dataLabRoutes`, `forgeSimRoutes`, `playerComparePilotRoutes`
- `analyticsRoutes`, `weeklyTakesRoutes`, `tiberMemoryRoutes`
- `playerIdentityRoutes`, `playerMappingRoutes`, `adminForge`
- `ovrRoutes`, `tiberRoutes`, `articleRoutes`, `buysSellsRoutes`
- `redraftWeeklyRoutes`, `rookieRoutes`, `rookieEvaluationRoutes`
- `gameLogRoutes`, `etlRoutes`, `nightlyProcessingRoutes`
- `publicRoutes`, `populationStatsRoutes`, `tradeAnalyzerRoutes`
- `compassCompareRoutes`, `playerComparisonRoutes`, `uphAdminRoutes`
- Plus module-level routers: `sosRouter`, `ratingsRouter`, `forgeRoutes`

---

## 3. Inline Route Inventory (Still in Monolith)

| # | Section | Line Range | Routes | Lines | Target File |
|---|---------|-----------|--------|-------|-------------|
| 1 | Health & System | ~218–384 | `/healthz`, `/readyz`, `/metrics`, `/metrics-snapshot`, `/current-week`, `/api/health` | ~170 | `server/routes/systemRoutes.ts` |
| 2 | Sleeper Helpers | ~386–500 | Helper functions + feature-flagged `/api/sleeper/*` fallback | ~115 | Keep inline (shared helpers used by multiple sections) |
| 3 | Logs & Projections | ~502–680 | `/api/logs/player/:playerId`, `/api/defense-rankings`, `/api/projections/player/:playerId`, test endpoints | ~180 | `server/routes/logsProjectionsRoutes.ts` |
| 4 | **Rankings** | ~681–1620 | `/api/rankings/*`, `/api/redraft/rankings`, `/api/rankings/:position/:mode` | **~940** | `server/routes/rankingsRoutes.ts` |
| 5 | Snap Percentage | ~1642–1950 | `/api/snap/*`, `/api/snap-percentages/*` | ~310 | `server/routes/snapRoutes.ts` |
| 6 | Compass Legacy | ~1950–2155 | `/api/compass-legacy/:position`, `/api/compass/rb/legacy` | ~205 | `server/routes/compassLegacyRoutes.ts` |
| 7 | WR Ratings & Game Logs | ~2148–2310 | `/api/wr-ratings/*`, `/api/wr-game-logs/*` | ~165 | `server/routes/wrRoutes.ts` |
| 8 | Consensus (inline) | ~2325–2490 | `/api/consensus/update`, `/api/consensus/seed` | ~165 | Merge into existing `server/consensus/` |
| 9 | Compass Bridge & Admin | ~2487–2782 | Compass bridge normalization, admin endpoints | ~295 | `server/routes/compassBridgeRoutes.ts` |
| 10 | System Endpoints | ~2782–3100 | Various system/admin APIs | ~320 | Merge into `server/routes/systemRoutes.ts` |
| 11 | **Admin FORGE & Processing** | ~3104–3919 | FORGE admin endpoints, data processing | **~815** | Merge into existing `server/routes/adminForge.ts` |
| 12 | Separated Rating System | ~3919–4299 | Rating system endpoints | ~380 | Merge into existing `server/routes/ratingsRoutes.ts` or new file |
| 13 | X Intelligence | ~4299–4527 | `/api/intel/x-scan`, `/api/intel/x-feed` | ~230 | `server/routes/xIntelRoutes.ts` |
| 14 | Guardian | ~4527–4605 | Noise shield demo | ~80 | `server/routes/guardianRoutes.ts` |
| 15 | Unified Players API | ~4605–4669 | Qwen's unified players integration | ~65 | `server/routes/unifiedPlayersRoutes.ts` |
| 16 | Tiber Consensus Rankings | ~4669–4810 | Consensus rankings API | ~140 | Merge into `server/consensus/` |
| 17 | OVR Engine (inline) | ~4809–4928 | OVR endpoints remaining inline | ~120 | Merge into existing `server/routes/ovrRoutes.ts` |
| 18 | Intelligence Feed | ~4928–4952 | Intel feed endpoint | ~25 | Merge into `xIntelRoutes.ts` |
| 19 | **Roster Sync** | ~4952–5557 | All roster sync endpoints | **~600** | `server/routes/rosterSyncRoutes.ts` |
| 20 | Power Rankings | ~5557–5651 | FPG-centric power rankings | ~95 | `server/routes/powerRankingsRoutes.ts` |
| 21 | **FORGE Workbench + E+G** | ~5651–6630 | FORGE workbench search/query, E+G batch/player endpoints | **~980** | Merge into existing `server/modules/forge/routes.ts` |
| 22 | **Tiber Brain OS** | ~6632–end | Brain OS dashboard, FORGE data context, game logs | **~4000+** | `server/routes/tiberBrainRoutes.ts` |

**Total inline**: ~9,000+ lines across 22 sections.

---

## 4. Phase Plan

### Phase 1 — Low Risk, High Impact (~1,840 lines)

These are the largest blocks with no shared mutable state. Pure structural moves.

| Task | Section | Lines | Target File | Risk |
|------|---------|-------|-------------|------|
| 1A | Rankings | ~940 | `server/routes/rankingsRoutes.ts` | Low — self-contained query routes |
| 1B | Roster Sync | ~600 | `server/routes/rosterSyncRoutes.ts` | Low — self-contained sync routes |
| 1C | Snap Percentage | ~310 | `server/routes/snapRoutes.ts` | Low — uses imported snap services |

**Impact**: Removes ~1,840 lines (17% of the file).

### Phase 2 — Medium Complexity (~2,470 lines)

These sections have more imports or share helpers with other inline sections.

| Task | Section | Lines | Target File | Risk |
|------|---------|-------|-------------|------|
| 2A | FORGE Workbench + E+G | ~980 | `server/modules/forge/routes.ts` | Medium — merging into existing module router |
| 2B | Admin FORGE & Processing | ~815 | `server/routes/adminForge.ts` | Medium — merging into existing admin forge router |
| 2C | Separated Rating System | ~380 | `server/routes/ratingsRoutes.ts` or new file | Medium — may share rating service imports |
| 2D | Compass Bridge & Admin | ~295 | `server/routes/compassBridgeRoutes.ts` | Low — self-contained |

**Impact**: Removes ~2,470 lines (23% of the file).

### Phase 3 — Cleanup (~4,700+ lines)

Remaining smaller blocks plus the large Tiber Brain OS section.

| Task | Section | Lines | Target File | Risk |
|------|---------|-------|-------------|------|
| 3A | **Tiber Brain OS** | ~4,000+ | `server/routes/tiberBrainRoutes.ts` | Medium — large, many imports |
| 3B | System & Health | ~490 | `server/routes/systemRoutes.ts` | Low |
| 3C | X Intelligence + Feed | ~255 | `server/routes/xIntelRoutes.ts` | Low |
| 3D | Compass Legacy | ~205 | `server/routes/compassLegacyRoutes.ts` | Low |
| 3E | Logs & Projections | ~180 | `server/routes/logsProjectionsRoutes.ts` | Low |
| 3F | WR Ratings & Game Logs | ~165 | `server/routes/wrRoutes.ts` | Low |
| 3G | Consensus (inline) | ~305 | Merge into `server/consensus/` | Low |
| 3H | OVR Engine (inline) | ~120 | Merge into `server/routes/ovrRoutes.ts` | Low |
| 3I | Power Rankings | ~95 | `server/routes/powerRankingsRoutes.ts` | Low |
| 3J | Guardian | ~80 | `server/routes/guardianRoutes.ts` | Low |
| 3K | Unified Players API | ~65 | `server/routes/unifiedPlayersRoutes.ts` | Low |

**Impact**: Removes remaining ~4,700+ lines. After Phase 3, `routes.ts` should be < 500 lines.

---

## 5. Extraction Pattern

Every extraction follows the same pattern:

### New Route File

```typescript
// server/routes/[name]Routes.ts
import { Router, type Request, type Response } from 'express';

const router = Router();

// Move route handlers here exactly as-is
router.get('/endpoint', async (req: Request, res: Response) => {
  // ... existing handler code unchanged ...
});

export default router;
```

### Update routes.ts

```typescript
// In server/routes.ts — replace the inline block with:
import nameRoutes from './routes/[name]Routes';
app.use('/api/[prefix]', nameRoutes);
// OR if routes have mixed prefixes:
app.use(nameRoutes);
```

### Import Migration

When moving routes to a new file, move the relevant `import` statements too:
1. Copy all imports used exclusively by the extracted routes into the new file.
2. Remove those imports from `routes.ts` (only if no other inline routes still use them).
3. If an import is shared, keep it in `routes.ts` and also add it to the new file.

---

## 6. Rules

1. **Each extraction is a standalone task** — An agent can complete one extraction independently without touching other sections.

2. **Never change route paths or behavior** — This is a pure structural refactor. Every route must respond to the same path with the same logic.

3. **Run the app after each extraction** — Start the dev server (`npm run dev`) and verify:
   - The app starts without errors
   - Extracted routes still respond correctly (spot-check 2-3 endpoints)
   - No TypeScript compilation errors

4. **Keep shared helper functions in routes.ts until all consumers are extracted** — Functions like `logInfo`, `logError`, `meta()`, `createResponse()`, `createErrorResponse()`, `validateSeason()` are used across multiple inline sections. Only move them out once all their consumers are extracted. At that point, move them to a shared utility file like `server/utils/routeHelpers.ts`.

5. **Each phase can be assigned to a different agent** — Phases are designed to be independent. Phase 2 does not depend on Phase 1 being complete (though it helps to do them in order for reduced file size).

6. **Preserve the `app` parameter pattern for routes that need it** — Some route registrations use `app.get()` / `app.post()` directly. When extracting, convert to `router.get()` / `router.post()` and mount with `app.use()`.

7. **Watch for `req.app` usage** — Some routes access `req.app.locals` or similar. These work fine with `Router()` since Express propagates the app reference.

8. **Handle prefix carefully** — If all routes in a section share a common prefix (e.g., `/api/snap/*`), use `app.use('/api/snap', snapRoutes)` and remove the prefix from individual route definitions. If routes have mixed prefixes, mount at root: `app.use(nameRoutes)`.

---

## 7. Target State

After full decomposition, `server/routes.ts` should contain only:

```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";

// ~50 import lines for modular route files
import systemRoutes from './routes/systemRoutes';
import rankingsRoutes from './routes/rankingsRoutes';
import snapRoutes from './routes/snapRoutes';
// ... etc ...

export async function registerRoutes(app: Express): Promise<Server> {
  // Static file serving
  app.use('/docs', express.static('docs'));

  // Global middleware
  // ... (rate limiting, admin auth, etc.)

  // Mount all route modules
  app.use(systemRoutes);
  app.use('/api/rankings', rankingsRoutes);
  app.use('/api/snap', snapRoutes);
  app.use('/api/roster-sync', rosterSyncRoutes);
  // ... ~40 more app.use() calls ...

  // Cron jobs and startup tasks (if any remain)
  // ...

  const httpServer = createServer(app);
  return httpServer;
}
```

**Target**: < 500 lines total.

---

## 8. Agent Task Template

Copy this template for each extraction task and fill in the blanks:

---

### Task: Extract [SECTION_NAME] routes from `server/routes.ts`

**Section**: [Section #] — [Section Name]  
**Line Range**: ~[START]–[END] in `server/routes.ts`  
**Lines to Move**: ~[COUNT]  
**Target File**: `server/routes/[name]Routes.ts`  
**Phase**: [1/2/3]

#### Steps

1. **Read** `server/routes.ts` lines [START]–[END] to identify all routes in this section.

2. **Create** `server/routes/[name]Routes.ts`:
   ```typescript
   import { Router, type Request, type Response } from 'express';
   // Add other imports needed by the routes
   const router = Router();
   // Paste route handlers here, converting app.get → router.get, etc.
   export default router;
   ```

3. **Update** `server/routes.ts`:
   - Add import: `import [name]Routes from './routes/[name]Routes';`
   - Add mount: `app.use([prefix], [name]Routes);`
   - Delete the inline route block (lines [START]–[END]).
   - Remove any imports that were only used by the deleted block.

4. **Verify**:
   - Run `npm run dev` — app starts without errors.
   - Test 2-3 endpoints from the extracted section.
   - Confirm no TypeScript errors.

#### Routes in This Section

| Method | Path | Description |
|--------|------|-------------|
| [GET/POST] | [/api/...] | [brief description] |
| ... | ... | ... |

#### Imports to Move

```
[List imports used exclusively by this section]
```

#### Shared Dependencies (keep in routes.ts)

```
[List any imports/helpers shared with other inline sections]
```

---

## 9. Progress Tracker

| Phase | Task | Section | Status | Agent | Date |
|-------|------|---------|--------|-------|------|
| 1 | 1A | Rankings (~940 lines) | ⬜ Not Started | — | — |
| 1 | 1B | Roster Sync (~600 lines) | ⬜ Not Started | — | — |
| 1 | 1C | Snap Percentage (~310 lines) | ⬜ Not Started | — | — |
| 2 | 2A | FORGE Workbench + E+G (~980 lines) | ⬜ Not Started | — | — |
| 2 | 2B | Admin FORGE & Processing (~815 lines) | ⬜ Not Started | — | — |
| 2 | 2C | Separated Rating System (~380 lines) | ⬜ Not Started | — | — |
| 2 | 2D | Compass Bridge & Admin (~295 lines) | ⬜ Not Started | — | — |
| 3 | 3A | Tiber Brain OS (~4,000+ lines) | ⬜ Not Started | — | — |
| 3 | 3B | System & Health (~490 lines) | ⬜ Not Started | — | — |
| 3 | 3C | X Intelligence + Feed (~255 lines) | ⬜ Not Started | — | — |
| 3 | 3D | Compass Legacy (~205 lines) | ⬜ Not Started | — | — |
| 3 | 3E | Logs & Projections (~180 lines) | ⬜ Not Started | — | — |
| 3 | 3F | WR Ratings & Game Logs (~165 lines) | ⬜ Not Started | — | — |
| 3 | 3G | Consensus inline (~305 lines) | ⬜ Not Started | — | — |
| 3 | 3H | OVR Engine inline (~120 lines) | ⬜ Not Started | — | — |
| 3 | 3I | Power Rankings (~95 lines) | ⬜ Not Started | — | — |
| 3 | 3J | Guardian (~80 lines) | ⬜ Not Started | — | — |
| 3 | 3K | Unified Players API (~65 lines) | ⬜ Not Started | — | — |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Blocked

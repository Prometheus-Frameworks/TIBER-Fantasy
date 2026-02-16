# Task: Build Quality Sentinel — Lightweight Validation Layer

**Priority:** Medium (new infrastructure, not a bugfix)
**Module:** Quality Sentinel (`server/modules/sentinel/`)
**Branch:** `codex/build-quality-sentinel`
**Agent Onboarding:** Read `.claude/AGENTS.md` → `replit.md` → `.claude/conventions.md` → this spec.

---

## Tiber Agent Onboarding Context

### Project Architecture Quick Reference
- **Backend:** Node.js/TypeScript (Express.js), PostgreSQL with Drizzle ORM
- **Frontend:** React 18, TypeScript, Tailwind CSS, TanStack Query
- **Database:** PostgreSQL (Neon-backed via Replit)
- **Schema file:** `shared/schema.ts` (all Drizzle models)
- **Module pattern:** `server/modules/<name>/` with service, routes, and MODULE.md
- **Route registration:** Routes defined in `server/routes/<name>Routes.ts`, registered in `server/routes.ts`
- **Player Identity:** GSIS ID system (`00-XXXXXXX` format, `player_identity_map` table)

### Files You Must Read First
1. `replit.md` — Full project context, architecture, and conventions
2. `.claude/conventions.md` — Coding patterns and guardrails
3. `server/modules/forge/types.ts` — FORGE type definitions (sentinel validates these outputs)
4. `server/modules/forge/forgeGrading.ts` — FORGE grading pipeline (alpha, tier, pillars)
5. `server/modules/personnel/personnelService.ts` — Personnel service (snap counts, profile structure)
6. `server/routes/personnelRoutes.ts` — Example route file to follow as pattern
7. `server/routes.ts` — Where to register new routes (see how existing modules mount)
8. `shared/schema.ts` — Database schema (add sentinel table here)

### How to Run / Test
- **Start app:** `npm run dev` (Express + Vite on port 5000)
- **Schema push:** `npm run db:push` (never write manual SQL migrations)
- **Test endpoints:** `curl http://localhost:5000/api/sentinel/...`
- **DB queries:** Use psql via `DATABASE_URL` env var

---

## Problem Description

Tiber Fantasy has multiple data modules (FORGE rankings, Personnel Usage, Data Lab, Role Banks) that produce computed outputs from raw NFL data. Currently there is **no validation layer** to catch:

- FORGE alpha scores outside valid range (0-100)
- Personnel snap percentages that don't sum to ~100%
- Stale data (snapshots older than expected)
- Cross-module inconsistencies (player in FORGE tiers but missing from personnel data)
- Pillar scores returning NaN or negative values
- Tier assignments that contradict alpha score thresholds

When bad data gets through, it surfaces on user-facing pages with no warning. Users see incorrect numbers with no indication anything is wrong.

### Design Philosophy

The research report (see `.claude/tasks/sentinel-research-context.md` if available, otherwise reference this spec) identifies the core tension:

> Every millisecond you add to the request path is a tax you pay forever.

Therefore: split checks into **(1) fast inline guards** that run in the response path (<5ms) and **(2) async batch checks** that run on a schedule. This task covers the **inline guard system + audit persistence**. Async scheduled checks are a future task.

---

## What to Build

### 1. Sentinel Rule Engine (`server/modules/sentinel/`)

Create the module structure:
```
server/modules/sentinel/
├── sentinelEngine.ts    — Core rule evaluation engine
├── sentinelRules.ts     — Rule definitions organized by module
├── sentinelTypes.ts     — TypeScript types for rules, results, events
└── MODULE.md            — Module documentation
```

#### Type Definitions (`sentinelTypes.ts`)

```typescript
export type SentinelSeverity = 'info' | 'warn' | 'block';

export type SentinelModule = 'forge' | 'personnel' | 'datalab' | 'rolebank' | 'system';

export interface SentinelRule {
  id: string;                        // e.g., 'forge.alpha_bounds'
  module: SentinelModule;
  name: string;                      // Human-readable name
  description: string;               // What this check validates
  severity: SentinelSeverity;
  check: (data: any) => SentinelCheckResult;
}

export interface SentinelCheckResult {
  passed: boolean;
  confidence: number;                // 0.0 to 1.0 — how certain we are this is an issue
  message: string;                   // Human-readable explanation
  details?: Record<string, any>;     // Extra context (actual values, thresholds, etc.)
}

export interface SentinelEvent {
  ruleId: string;
  module: SentinelModule;
  severity: SentinelSeverity;
  passed: boolean;
  confidence: number;
  message: string;
  details?: Record<string, any>;
  fingerprint: string;              // For grouping: hash of (ruleId + module + key data)
  endpoint?: string;                // Which API endpoint triggered this
  timestamp: Date;
}

export interface SentinelReport {
  module: SentinelModule;
  timestamp: Date;
  totalChecks: number;
  passed: number;
  warnings: number;
  blocks: number;
  events: SentinelEvent[];          // Only failed checks (passed=false)
}

export interface SentinelIssue {
  fingerprint: string;
  ruleId: string;
  module: SentinelModule;
  severity: SentinelSeverity;
  lastMessage: string;
  firstSeen: Date;
  lastSeen: Date;
  occurrenceCount: number;
  status: 'open' | 'resolved' | 'muted';
}
```

#### Rule Engine (`sentinelEngine.ts`)

Core functions:

```typescript
/**
 * Run all rules for a given module against provided data.
 * Returns a SentinelReport with pass/fail results.
 * MUST complete in <5ms for inline use.
 */
export function evaluate(module: SentinelModule, data: any): SentinelReport;

/**
 * Run a specific rule by ID.
 */
export function evaluateRule(ruleId: string, data: any): SentinelCheckResult;

/**
 * Persist failed checks to the sentinel_events table.
 * This is fire-and-forget — does NOT block the response.
 */
export function recordEvents(events: SentinelEvent[]): Promise<void>;

/**
 * Get grouped issues from persisted events.
 */
export function getIssues(filters?: {
  module?: SentinelModule;
  severity?: SentinelSeverity;
  status?: 'open' | 'resolved' | 'muted';
  limit?: number;
}): Promise<SentinelIssue[]>;
```

Key design constraints:
- `evaluate()` MUST be synchronous and complete in <5ms
- `recordEvents()` is async but fire-and-forget (don't await in the response path)
- Generate fingerprints by hashing `ruleId + module + relevant key` (e.g., player_id for per-player checks)
- Use a simple MD5 or string concat for fingerprinting — no crypto library needed

#### Rule Definitions (`sentinelRules.ts`)

Implement these initial rule sets:

**IMPORTANT — FORGE Field Names:**
The FORGE API response uses `ForgeSubScores` from `server/modules/forge/types.ts`. The pillar field names are:
- `volume` (not "vol")
- `efficiency` (not "eff")
- `contextFit` (NOT `teamContext` — `teamContext` is used internally in grading, but the API response shape uses `contextFit`)
- `stability`

The response shape is `ForgeScore.subScores: ForgeSubScores` (see `types.ts` line ~63 and ~121). Always validate against this shape.

**FORGE Rules** (`module: 'forge'`):
| Rule ID | Check | Severity | Confidence |
|---------|-------|----------|------------|
| `forge.alpha_bounds` | Alpha score is between 0 and 100 | block | 1.0 |
| `forge.alpha_nan` | Alpha is not NaN or null | block | 1.0 |
| `forge.pillar_bounds` | Each pillar score (volume, efficiency, contextFit, stability) is 0-100 | warn | 0.9 |
| `forge.pillar_nan` | No pillar scores are NaN or null | block | 1.0 |
| `forge.tier_consistency` | Tier assignment matches alpha thresholds for the player's position (see thresholds below) | warn | 0.85 |
| `forge.weight_sum` | Pillar weights sum to approximately 1.0 (±0.01) | block | 1.0 |
| `forge.batch_empty` | Batch response contains at least 1 player for the position | info | 0.7 |
| `forge.player_count` | Batch response has reasonable player count (>10 for any position) | warn | 0.8 |

**Personnel Rules** (`module: 'personnel'`):
| Rule ID | Check | Severity | Confidence |
|---------|-------|----------|------------|
| `personnel.snap_positive` | Total snaps > 0 for each player | block | 1.0 |
| `personnel.pct_sum` | Personnel bucket percentages sum to 95-105% (allowing rounding) | warn | 0.85 |
| `personnel.snap_reasonable` | Top players have >200 snaps for full season data | info | 0.7 |
| `personnel.classification_valid` | Classification is one of defined types (FULL_TIME, etc.) | block | 1.0 |

**Data Lab / System Rules** (`module: 'datalab'` and `module: 'system'`):
| Rule ID | Check | Severity | Confidence |
|---------|-------|----------|------------|
| `datalab.snapshot_exists` | At least one snapshot exists for the requested season | warn | 0.9 |
| `datalab.snapshot_recency` | Most recent snapshot is within last 14 days (during season) | info | 0.6 |
| `system.response_shape` | API response has expected top-level keys | block | 1.0 |

**Tier Consistency Thresholds** (reference for `forge.tier_consistency` rule):
```
QB: T1≥70, T2≥55, T3≥42, T4≥32
RB: T1≥78, T2≥68, T3≥55, T4≥42
WR: T1≥82, T2≥72, T3≥58, T4≥45
TE: T1≥82, T2≥70, T3≥55, T4≥42
```
These values are defined in `POSITION_TIER_THRESHOLDS` in `server/modules/forge/forgeGrading.ts` (line ~63) but the constant is **not currently exported**. You have two options:
1. **(Preferred)** Add `export` to the `POSITION_TIER_THRESHOLDS` declaration in `forgeGrading.ts` and import it in your sentinel rules.
2. If (1) causes issues, duplicate the thresholds in `sentinelRules.ts` with a comment referencing the source file and line number so they stay in sync.

### 2. Database Schema

Add to `shared/schema.ts`:

```typescript
export const sentinelEvents = pgTable('sentinel_events', {
  id: serial('id').primaryKey(),
  ruleId: varchar('rule_id', { length: 100 }).notNull(),
  module: varchar('module', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(),
  passed: boolean('passed').notNull(),
  confidence: real('confidence').notNull(),
  message: text('message').notNull(),
  details: jsonb('details'),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Also add the corresponding insert schema and types:
```typescript
export const insertSentinelEventSchema = createInsertSchema(sentinelEvents).omit({ id: true, createdAt: true });
export type InsertSentinelEvent = z.infer<typeof insertSentinelEventSchema>;
export type SentinelEvent = typeof sentinelEvents.$inferSelect;
```

Also add a `sentinel_mutes` table for tracking muted issues:
```typescript
export const sentinelMutes = pgTable('sentinel_mutes', {
  id: serial('id').primaryKey(),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull().unique(),
  reason: text('reason'),
  mutedAt: timestamp('muted_at').defaultNow().notNull(),
});

export const insertSentinelMuteSchema = createInsertSchema(sentinelMutes).omit({ id: true, mutedAt: true });
export type InsertSentinelMute = z.infer<typeof insertSentinelMuteSchema>;
export type SentinelMute = typeof sentinelMutes.$inferSelect;
```

Create an index on `fingerprint` and `created_at` for the issues grouping query.

After adding both schemas, run `npm run db:push` to create the tables.

**Issue resolution logic:** The `getIssues()` function should LEFT JOIN `sentinel_mutes` on fingerprint. Issues with a matching mute record get `status: 'muted'` and are excluded from default queries (unless `status=muted` is explicitly requested). An issue is `'resolved'` if its most recent event is >24h old and no new events have appeared. All others are `'open'`.

### 3. API Routes (`server/routes/sentinelRoutes.ts`)

Create these endpoints:

```
GET  /api/sentinel/issues          — Grouped issues (fingerprinted events)
GET  /api/sentinel/events          — Raw event feed with pagination
GET  /api/sentinel/health          — Module health summary (checks per module, pass rates)
POST /api/sentinel/mute/:fingerprint — Mute a specific issue
POST /api/sentinel/run/:module     — Manually trigger checks for a module (admin/debug)
```

**GET /api/sentinel/issues**
Query params: `module`, `severity`, `status`, `limit` (default 50)
Response:
```json
{
  "issues": [
    {
      "fingerprint": "abc123",
      "ruleId": "forge.alpha_bounds",
      "module": "forge",
      "severity": "block",
      "lastMessage": "Alpha score 105.3 exceeds maximum of 100",
      "firstSeen": "2026-02-15T10:00:00Z",
      "lastSeen": "2026-02-16T14:30:00Z",
      "occurrenceCount": 12,
      "status": "open"
    }
  ],
  "total": 1
}
```

**GET /api/sentinel/events**
Query params: `module`, `severity`, `limit` (default 100), `offset` (default 0)
Response:
```json
{
  "events": [...],
  "total": 250,
  "limit": 100,
  "offset": 0
}
```

**GET /api/sentinel/health**
No params.
Response:
```json
{
  "modules": {
    "forge": { "totalChecks": 1500, "passed": 1480, "warnings": 15, "blocks": 5, "passRate": 0.987 },
    "personnel": { "totalChecks": 800, "passed": 795, "warnings": 5, "blocks": 0, "passRate": 0.994 }
  },
  "overall": { "totalChecks": 2300, "passed": 2275, "passRate": 0.989 },
  "lastCheckAt": "2026-02-16T14:30:00Z"
}
```

**Route Registration:** Mount in `server/routes.ts`:
```typescript
import sentinelRoutes from './routes/sentinelRoutes';
// ...
app.use('/api/sentinel', sentinelRoutes);
```

### 4. Inline Integration Points

Add sentinel evaluation calls to existing API response paths. The sentinel should evaluate data **after** the module computes its results but **before** sending the response. Use fire-and-forget persistence.

**Pattern:**
```typescript
// In an existing route handler:
const result = await computeForgeResults(params);

// Sentinel check (inline, synchronous, <5ms)
const sentinelReport = evaluate('forge', result);

// Fire-and-forget persistence (don't await)
if (sentinelReport.events.length > 0) {
  recordEvents(sentinelReport.events).catch(err => 
    console.error('[Sentinel] Failed to record events:', err)
  );
}

// Attach sentinel metadata to response
res.json({
  ...result,
  _sentinel: {
    checked: true,
    warnings: sentinelReport.warnings,
    blocks: sentinelReport.blocks,
  }
});
```

**Integration targets** (add sentinel checks to these existing endpoints):

1. **FORGE batch endpoint** — `server/modules/forge/routes.ts` → the `router.get('/batch', ...)` handler (line ~395)
   - This is mounted at `/api/forge/batch` via `registerForgeRoutes()` in `server/routes.ts` (line ~10342)
   - Run `forge.*` rules against each player in the batch response
   - Attach `_sentinel` summary to the response

2. **FORGE single player endpoint** — `server/modules/forge/routes.ts` → the `router.get('/score/:playerId', ...)` handler (line ~327)
   - This is mounted at `/api/forge/score/:playerId`
   - Run `forge.*` rules against the single player response

3. **Personnel profile endpoint** — `server/routes/personnelRoutes.ts` → GET `/api/personnel/profile`
   - Run `personnel.*` rules against each player profile in the response

**How to find these handlers:** Run `grep -n "router.get\|router.post" server/modules/forge/routes.ts | head -20` to see all FORGE route handlers and their line numbers.

Do NOT modify the core logic of any module. The sentinel only observes and reports — it never mutates data.

### 5. Module Documentation (`MODULE.md`)

Create `server/modules/sentinel/MODULE.md` with:
- Purpose: Lightweight validation layer for all Tiber modules
- Architecture: Rule engine (sync) + event persistence (async) + API (admin)
- Rule DSL: How to add new rules
- Performance budget: <5ms per evaluate() call
- Integration pattern: How to add sentinel to new endpoints
- Event lifecycle: Event → fingerprint grouping → issue → mute/resolve

---

## Validation Criteria

### Must Pass (PR will not be merged without these)

1. **Schema pushed:** `sentinel_events` table exists in PostgreSQL after `npm run db:push`
2. **Rules execute:** `evaluate('forge', testData)` returns a valid `SentinelReport` with correct pass/fail counts
3. **FORGE alpha bounds:** Passing `{ alpha: 105, ... }` to `forge.alpha_bounds` rule returns `passed: false`
4. **FORGE alpha valid:** Passing `{ alpha: 75, ... }` to `forge.alpha_bounds` rule returns `passed: true`
5. **Personnel pct sum:** Passing bucket percentages summing to 110% returns `passed: false` on `personnel.pct_sum`
6. **Persistence works:** After `recordEvents()`, the events appear in the `sentinel_events` table
7. **Issues API works:** `GET /api/sentinel/issues` returns grouped issues from persisted events
8. **Events API works:** `GET /api/sentinel/events` returns raw events with pagination
9. **Health API works:** `GET /api/sentinel/health` returns per-module pass rates
10. **Performance:** `evaluate()` completes in <5ms for a typical FORGE batch (50 players × 8 rules)
11. **No breakage:** Existing FORGE, Personnel, and Data Lab endpoints still work correctly with sentinel attached

### Spot Checks

- Muting an issue via `POST /api/sentinel/mute/:fingerprint` excludes it from issues list
- Fingerprinting groups identical rule+module+key violations into a single issue
- `_sentinel` metadata appears in FORGE batch response
- `_sentinel` metadata appears in Personnel profile response

### How to Validate

```bash
# 1. Schema exists
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'sentinel_events';"

# 2. FORGE endpoint with sentinel
curl -s 'http://localhost:5000/api/forge/batch?position=WR&mode=redraft' | jq '._sentinel'

# 3. Personnel endpoint with sentinel
curl -s 'http://localhost:5000/api/personnel/profile?season=2025&position=WR&limit=5' | jq '._sentinel'

# 4. Issues API
curl -s 'http://localhost:5000/api/sentinel/issues' | jq '.issues | length'

# 5. Health API
curl -s 'http://localhost:5000/api/sentinel/health' | jq '.overall.passRate'

# 6. Events API with pagination
curl -s 'http://localhost:5000/api/sentinel/events?limit=10&offset=0' | jq '.total'

# 7. Performance (should be fast)
time curl -s 'http://localhost:5000/api/forge/batch?position=WR&mode=redraft' > /dev/null
```

---

## Guardrails

- **Do NOT modify** core logic in FORGE, Personnel, Data Lab, or any other existing module
- **Do NOT add** any npm dependencies — use only what's already installed
- **Do NOT block** API responses on sentinel persistence (fire-and-forget only)
- **Do NOT** create frontend components — this task is backend-only (UI will be built separately by Replit Agent)
- **Follow** the module naming pattern: `server/modules/sentinel/` for logic, `server/routes/sentinelRoutes.ts` for routes
- **Import** tier thresholds from `server/modules/forge/forgeGrading.ts` rather than hardcoding
- **Use** Drizzle ORM for all database operations (no raw SQL for CRUD)
- **Run** `npm run db:push` after adding the schema — never write manual migrations

---

## Files to Create
- `server/modules/sentinel/sentinelTypes.ts`
- `server/modules/sentinel/sentinelRules.ts`
- `server/modules/sentinel/sentinelEngine.ts`
- `server/modules/sentinel/MODULE.md`
- `server/routes/sentinelRoutes.ts`

## Files to Modify
- `shared/schema.ts` — Add `sentinelEvents` + `sentinelMutes` tables + insert schemas + types
- `server/routes.ts` — Register sentinel routes at `/api/sentinel`
- `server/modules/forge/routes.ts` — Add sentinel evaluation to `/batch` (line ~395) and `/score/:playerId` (line ~327)
- `server/modules/forge/forgeGrading.ts` — Add `export` to `POSITION_TIER_THRESHOLDS` (line ~63)
- `server/routes/personnelRoutes.ts` — Add sentinel evaluation to GET `/api/personnel/profile`

---

## Resolution

_To be filled in after task completion._

- **Commit:** 
- **PR:** 
- **Validation results:**
- **Notes:**

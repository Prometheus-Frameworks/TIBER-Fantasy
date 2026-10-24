# Claude Code — Work Log

Agent: Claude Code (Opus 4.6, shell-based)
Platform: Replit Shell / Terminal
Workflow: Receives task specs from `.claude/tasks/`, reads `replit.md` + `AGENTS.md` for context

---

## Completed Tasks

### 2026-02-16 — Fix Personnel Usage Under-Counting
- **Task Spec:** `.claude/tasks/fix-personnel-undercounting.md`
- **Commit:** `1ec03797`
- **Summary:** Replaced primary-actor-only counting with nflverse pbp_participation data. Added `bronze_pbp_participation` table, Python ingest script, rewrote SQL aggregation query, updated frontend labels.
- **Key Files:**
  - `shared/schema.ts` — Added `bronzePbpParticipation` table
  - `server/scripts/import_pbp_participation.py` — New ingest script
  - `server/modules/personnel/personnelService.ts` — Rewrote aggregation query
  - `client/src/pages/PersonnelUsage.tsx` — Updated labels (plays → snaps)
  - `server/modules/personnel/MODULE.md` — Updated methodology docs
- **Validation:** Nacua 869 (was 224), Hunter 303 (was 46), all criteria passed
- **Discovery:** Correct nflverse URL is `pbp_participation_{season}.parquet` not `participate_{season}.parquet`

---

## Notes for Future Sessions

- The `bronze_pbp_participation` table was created via direct SQL since `npm run db:push` hit an interactive enum prompt. The Drizzle schema definition is in sync.
- To refresh participation data for new weeks: `python3 server/scripts/import_pbp_participation.py 2025`
- This agent works best with detailed task specs that include file paths, SQL diagnostics, and validation criteria.

### 2026-10-22 — Claude (Fable): #423 schedule-only ROS schedule strength MCP slice
- **What changed:** Added `tiber_get_ros_schedule_strength`, a read-only schedule-only MCP operation per Fable's Step 1 map and Codex's corrections on #423. The bounded nflverse schedule reader now retains validated team-week fixtures (gameId, gameday, opponent, home/away designation) and a SHA-256 content hash under a declared convention, cached with the compiled schedule; `playoff_week_start` is parsed into league context; a pure calendar compiler implements next3 (decision week through +2), ROS/playoffs with an explicit caller-supplied final week, custom ranges, byes kept in-window, bounds, missing-final witnesses and preserved regular-season facts. Ratings stay null with `no_qualified_defensive_evidence`; locks unknown; no legacy SOS/DB/ROP input.
- **Files modified:** server/modules/leagueMcp/{schedule.ts,rosterContext.ts,personalContext.ts,tools.ts,identity.ts (new),nflState.ts (new),rosSchedule.ts (new),scheduleStrength.ts (new)}, server/mcp/leagueReaderServer.ts, tests/scheduleStrength.test.ts (new), tests/{leagueReaderHardening,leagueReaderProtocol,personalLeagueContext,roleHistory}.test.ts (tool counts, hash arg), docs/mcp/league-reader-hosted-v1.md, server/modules/leagueMcp/MODULE.md, replit.md.
- **Validation:** 58 native tests (16 new) pass; 85 existing Team/waiver/catalog Jest tests in five suites pass; scoped strict TypeScript clean; server build passes (inherited duplicate applyAdjusters warning); public Worker build 236 modules with isolation audit; built bundle smoke check with synthetic fixed-origin reads; `git diff --check` clean. Synthetic only — no live source, hosted or installed-plugin acceptance claimed.
- **Notes:** Branch `fable/423-schedule-only-mcp-20261022` is stacked on #424 head b30d9a6131c6f6b4e8cd40da54753f81405ae943 (itself on #422 fdffe2ae) to inherit the exhaustive `unknown_tool` dispatch without duplicating it; it never imports `roleEvidence/`. Draft PR only; no merge, deploy, Site/environment/access change, defensive dataset acquisition or ratings implementation. Wilson watch and private ROP artifacts unchanged.

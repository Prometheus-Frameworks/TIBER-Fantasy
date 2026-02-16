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

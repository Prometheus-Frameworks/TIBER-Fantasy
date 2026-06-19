# Agent Context Guide for Tiber Fantasy

> **Purpose**: Ensure continuity and correctness across Claude Code sessions, especially after rate limits.

---

> **Status: CURRENT** — _Last reviewed: 2026-06-19_

## 1. Read Order (MANDATORY)

1. Read this file first — hard rules, stop conditions, task hygiene.
2. Read `docs/architecture/AGENT_NAVIGATION_MAP.md` — current repo map, doc status labels, module status table, route hygiene, and the core architecture boundary.
3. Read the current architecture doc(s) for your task (e.g. `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md`, `docs/architecture/LEGACY_MODULE_WORK_RULES.md`, `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md`).
4. Read task-specific files only — the narrowest set needed.
5. Read `SESSION_STATE.md` **only as HISTORICAL / session context**. It is January-era state and is **not** current June 2026 authority. Do not act on it as direction unless it has been explicitly refreshed.

If contradictions exist between current docs, **stop and ask**. Do not guess.

---

## 2. Current Data Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 metrics | ✅ Complete | All weeks 1-17 |
| Phase 2A metrics | ✅ Complete | All weeks 1-17 (RZ + 3rd Down) |
| Phase 2B (Game Script) | ⛔ Not started | |
| Phase 2C (Two-Minute Drill) | ⛔ Not started | |

**Do not reference unavailable metrics (Phase 2B/2C).**

---

## 3. Hard Constraints (NON-NEGOTIABLE)

| Constraint | Requirement |
|------------|-------------|
| No lookahead | Never use future weeks |
| GSIS ID is canonical | Use for navigation + joins |
| Bronze booleans | Must use `= true` comparison |
| Gold layer | May derive, must not smooth or impute |
| ETL changes | Require corresponding QA updates |

**If violated: stop immediately.**

---

## 4. Safe Scope of Work

### ✅ Safe to Modify
- Data Lab UI
- Player Profile UI
- Routing / navigation glue
- Display-only formatting

### ⚠️ Caution (Notify before changing)
- `shared/schema.ts`
- API response shapes
- Shared types

### ⛔ Do Not Modify Without Explicit Instruction
- `server/etl/*`
- Gold ETL logic
- QA scripts
- Bronze/Silver schemas

---

## 4a. Core Architecture Boundary

**TIBER-Fantasy is the product shell and orchestration core**, not a home for new standalone model brains.

**TIBER-Fantasy should own**: product shell and route/API surfaces; identity, storage, validation, and orchestration; adapter/client boundaries for promoted external model repos; UI-facing response shaping and partial-failure handling; Management / Data Lab / Player Research / Team Research shell behavior.

**TIBER-Fantasy should NOT casually grow**: new standalone model brains; route-level football reasoning; duplicate scoring/evaluation systems; recomputation of promoted, read-only external artifacts.

Promoted external model repos and their artifacts are **read-only** from here — consume them via `server/modules/externalModels/` adapters, never recompute or mutate them. If you are about to add a new intelligence engine, recommendation brain, or scoring stack in-repo, **stop** and route it through the adapter pattern. See `docs/architecture/AGENT_NAVIGATION_MAP.md` and the module classification audit.

---

## 4b. Route Hygiene

`server/routes.ts` is very large (~10k+ lines). To keep it from growing further:

- New endpoints go in **dedicated routers/modules** (e.g. `server/routes/<feature>Routes.ts`) and are **mounted** from `server/routes.ts`.
- **Do not** add large inline handlers inside `server/routes.ts`. Acceptable exceptions are tiny and must be explicitly justified.
- Do not add new route-level football reasoning — that belongs behind adapters/orchestrators.

---

## 5. Task Rules

**Keep tasks small and bounded.**

Touch only necessary files. Avoid repo-wide scans.

### ❌ Avoid
- "wire everything"
- "refactor the codebase"
- "update all files"

### ✅ Prefer
- "connect X → Y using GSIS ID"
- "add display column only"
- "verify route exists"

---

## 6. Handoff Requirements

After each task, report:

1. **Files changed** - list all modified files
2. **What was done** - brief description
3. **What was not touched** - explicit scope limits
4. **Assumptions** - if any were made

---

## 7. Stop Conditions

Stop and wait if:

- Rate limits approach
- Data availability is unclear
- A hard constraint is threatened
- Architectural judgment is required

---

## 8. Definition of Success

A task is successful if it is:

| Criteria | Description |
|----------|-------------|
| Correct | Produces accurate results |
| Modular | Changes are isolated |
| Low-compute | Minimal database/processing load |
| Reversible | Can be easily undone |

---

## 9. Final Instruction

> This is a production analytics system, not a demo.

**Correctness > Speed**
**Precision > Coverage**
**Clarity > Cleverness**

---

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `AGENT_README.md` | This file - constraints and rules | CURRENT |
| `docs/architecture/AGENT_NAVIGATION_MAP.md` | Current repo map, doc status labels, module table, route hygiene | CURRENT |
| `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` | Module-by-module classification (source of truth) | CURRENT |
| `docs/architecture/LEGACY_MODULE_WORK_RULES.md` | What you may change in non-core modules | CURRENT |
| `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md` | FORGE externalization plan | MIGRATION |
| `SESSION_STATE.md` | Prior session progress (January-era) | HISTORICAL |
| `PHASE_2_PLAN.md` | Phase 2 implementation roadmap | HISTORICAL |
| `replit.md` | Project architecture and preferences | reference |
| `server/etl/goldDatadiveETL.ts` | Gold layer ETL (caution) | code |
| `shared/schema.ts` | Database schemas (caution) | code |
| `client/src/pages/TiberDataLab.tsx` | Data Lab UI (safe) | code |

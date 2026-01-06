# Agent Context Guide for Tiber Fantasy

> **Purpose**: Ensure continuity and correctness across Claude Code sessions, especially after rate limits.

---

## 1. Read Order (MANDATORY)

1. Read this file first
2. Read `SESSION_STATE.md`
3. Treat all statements as authoritative unless marked PENDING
4. If contradictions exist, **stop and ask**. Do not guess.

---

## 2. Current Data Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 metrics | ✅ Complete | All weeks |
| Phase 2A metrics | ✅ Verified | Week 17, 2025 only |
| Phase 2A Weeks 1-16 | ⛔ PENDING | Backfill not complete |
| Phase 2B (Game Script) | ⛔ Not started | |
| Phase 2C (Two-Minute Drill) | ⛔ Not started | |

**Do not reference unavailable metrics.**

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

| File | Purpose |
|------|---------|
| `SESSION_STATE.md` | Current session progress, next steps |
| `AGENT_README.md` | This file - constraints and rules |
| `PHASE_2_PLAN.md` | Phase 2 implementation roadmap |
| `replit.md` | Project architecture and preferences |
| `server/etl/goldDatadiveETL.ts` | Gold layer ETL (caution) |
| `shared/schema.ts` | Database schemas (caution) |
| `client/src/pages/TiberDataLab.tsx` | Data Lab UI (safe) |

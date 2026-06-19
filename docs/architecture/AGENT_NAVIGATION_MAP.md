# Agent Navigation Map

**Status: CURRENT** — _Last updated: 2026-06-19_

> **Purpose**: Give a future agent a fast, safe map of TIBER-Fantasy before
> it touches anything. This is the second file you read, right after
> `AGENT_README.md`. If you read nothing else, read this and the audit it
> points to.

TIBER-Fantasy is increasingly operated by agents through issues, PRs, reviews,
and bounded implementation tasks. The architectural doctrine is strong, but the
entry surface is scattered across many docs of different ages. This map exists
so a token-limited or less context-aware agent does not follow stale state,
treat historical docs as current authority, add inline logic to
`server/routes.ts`, or expand legacy model brains instead of using the
adapter/orchestrator pattern.

---

## 1. Read order (current)

Read in this order. Stop as soon as you have what the task needs — you do not
have to read everything.

1. **`AGENT_README.md`** — hard rules, stop conditions, task hygiene. Always first.
2. **`docs/architecture/AGENT_NAVIGATION_MAP.md`** (this file) — current repo map and status labels.
3. **The current architecture doc(s) for your task**, such as:
   - `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` — module-by-module status (source of truth for what is core vs. legacy vs. extract).
   - `docs/architecture/LEGACY_MODULE_WORK_RULES.md` — what you are allowed to change in non-core modules.
   - `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md` — the in-progress FORGE externalization (read if your task touches FORGE).
4. **Task-specific files only** — the narrowest set needed to do the work.
5. **`SESSION_STATE.md` — HISTORICAL context only.** Useful for backstory on
   prior ETL/data work, but it is **not** current direction and must not be
   treated as authority. See status convention below.

A future agent should be able to determine this read order in under 60 seconds.

---

## 2. Doc freshness / status convention

Docs in this repo carry a status label so you know how much authority to give
them. When a doc has no explicit label, infer it from its "Last updated" date
and content, and treat anything older than the current quarter as `HISTORICAL`
until proven otherwise.

| Status | Meaning |
|---|---|
| `CURRENT` | Safe to use as current authority. |
| `HISTORICAL` | Useful context, **not** current authority. Do not act on it as direction. |
| `MIGRATION` | Describes a transition state that is in progress. |
| `DEPRECATED` | Do not expand. Slated for removal or replacement. |
| `UNKNOWN` | Inspect before touching; status not yet confirmed. |

Known anchors:

| Doc | Status |
|---|---|
| `AGENT_README.md` | `CURRENT` |
| `docs/architecture/AGENT_NAVIGATION_MAP.md` | `CURRENT` |
| `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` | `CURRENT` |
| `docs/architecture/LEGACY_MODULE_WORK_RULES.md` | `CURRENT` |
| `docs/architecture/FORGE_EXTERNALIZATION_TRANSITION_SPEC.md` | `MIGRATION` |
| `SESSION_STATE.md` | `HISTORICAL` (January-era session state; not current June 2026 direction) |

---

## 3. Core architecture boundary

**TIBER-Fantasy is the product shell and orchestration core.** It is not the
home for new standalone football-reasoning brains.

### TIBER-Fantasy should own

- product shell and route/API surfaces;
- identity, storage, validation, and orchestration;
- adapter/client boundaries for promoted external model repos;
- UI-facing response shaping and partial-failure handling;
- Management / Data Lab / Player Research / Team Research shell behavior.

### TIBER-Fantasy should **not** casually grow

- new standalone model brains;
- route-level football reasoning;
- duplicate scoring/evaluation systems;
- recomputation of promoted, read-only external artifacts.

**Read-only boundary:** promoted external model repos and their published
artifacts are **read-only** from TIBER-Fantasy. Consume them through
`server/modules/externalModels/` adapters and core orchestrators. Do not
recompute, fork, or mutate promoted artifact logic from inside this repo.

If you are about to add a new intelligence engine, recommendation brain, or
scoring stack inside this repo, **stop** and route that work through the
external-model adapter pattern instead.

---

## 4. Module status table (quick map)

Compact view only. The detailed, authoritative source is
`docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` — check it
before editing any module.

| Bucket | What's in it | What it means for you |
|---|---|---|
| `CORE` | identity, storage, API shells, validation, adapters (`server/modules/externalModels/**`), Data Lab orchestration & role banks, Management shell, Sentinel, SoS / matchup support context | Safe to maintain and extend as shell/orchestration. Keep it as interfaces + orchestration, not new brains. |
| `LEGACY_CORE_TEMP` | in-repo FORGE (`server/modules/forge/**`) until externalization completes | Active and central, but **do not expand**. Bug fixes, contract hardening, and extraction prep only. See FORGE spec. |
| `EXTRACT_LATER` | FIRE / Fantasy Lab, CATALYST, Doctrine modules, Metric Matrix, Start/Sit | Engine-shaped; will leave core. Keep contracts stable; no new in-repo scope. |
| `DEPRECATE_OR_FREEZE` | OVR, PlayerCompass, dynasty heuristic bundles | Frozen. Keep alive only for current consumers and transition work. No new features. |
| `UNKNOWN_DO_NOT_EXPAND` | `tiberMatrix` and any unclear module without confirmed live consumers | Treat as frozen until runtime ownership and active consumers are proven. |

---

## 5. Route hygiene

`server/routes.ts` is very large (~10k+ lines) and mixes route mounts, helper
logic, historical routes, product routes, and model-facing surfaces. To keep it
from growing into more slop soup:

- **New endpoints should be implemented in dedicated routers/modules** (e.g.
  `server/routes/<feature>Routes.ts`) and **mounted** from `server/routes.ts`.
- **Do not add large inline handlers** directly inside `server/routes.ts`.
- Acceptable exceptions are tiny and must be explicitly justified (e.g. a
  one-line health check or a trivial passthrough).
- **Do not add new route-level football reasoning.** Reasoning belongs behind
  adapters/orchestrators, not in route handlers.

This is policy and map only. **This map does not split `server/routes.ts`** —
that is deferred follow-up work (see issue #244 follow-ups).

---

## 6. Agent task-start checklist

Before editing, run through this:

1. **Identify the touched surface**: UI, route shell, adapter, DB/schema, ETL, model brain, or docs.
2. **Check module status** in the audit table before editing any module.
3. **Check whether route work belongs in a dedicated router** rather than inline `server/routes.ts`.
4. **Check whether source data is observed or inferred** — never present inferred data as observed.
5. **Check whether the task crosses a read-only promoted-artifact boundary** (external model repos/artifacts).
6. **Check whether DB/schema changes require** `npm run db:push` or migration handling.
7. **Run the narrowest relevant verification** (typecheck/tests/docs sanity for the touched surface).
8. **Report** files changed, files not touched, assumptions made, and verification performed.

---

## 7. Preserved hard constraints

This map does not weaken any existing rule. The following remain
**non-negotiable** (see `AGENT_README.md`):

- **GSIS ID** is the canonical player identity for navigation and joins.
- **Bronze / Silver / Gold ETL boundaries** are respected.
- **No smoothing or imputation in Gold** — Gold may derive, must not smooth or impute.
- **No casual ETL / schema / shared-type changes.**
- **Correctness over speed**, precision over coverage, clarity over cleverness.

---

> Maps first, refactors later. This layer exists to reduce future-agent
> confusion before it becomes product risk.

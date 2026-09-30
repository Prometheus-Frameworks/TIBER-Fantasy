# AGENTS.md — TIBER-Fantasy Operating Instructions

## 1) Repo purpose
TIBER-Fantasy is the downstream product/API/UI surface for TIBER intelligence. It consumes promoted artifacts and model outputs from upstream repos and exposes user-facing experiences and APIs.

This repo is **not** the canonical data authority:
- **TIBER-Data** owns canonical contracts, IDs, source metadata, and governed handoff artifacts.
- **TIBER-Rookies** owns rookie producer/model/card/board logic and promoted rookie exports.
- **TIBER-FORGE** owns deterministic grading/ranking over canonical inputs.

Do not silently patch upstream data problems with frontend assumptions.

## 2) Instruction precedence
When instructions conflict, follow this order:
1. System/developer/user prompt instructions
2. This root `AGENTS.md`
3. Nested `AGENTS.md` files (deeper path = narrower scope)
4. Repo docs and inline comments

## 3) Non-goals / repo boundaries
- Do not treat this repo as source-of-truth for upstream contracts or IDs.
- Do not fabricate player facts, model outputs, team mappings, source metadata, or readiness states.
- Avoid broad refactors unless explicitly requested.

## 4) Mandatory pre-flight read order
1. `README.md`
2. `ARCHITECTURE.md`
3. `CURRENT_PHASE.md`
4. `.claude/AGENTS.md`
5. Relevant module `MODULE.md` for touched area
6. `CODEBASE_MAP.md` for file ownership lookup

## 5) Agent roles and transition boundary

- All agents may perform authorized implementation, testing, bounded repair,
  review, and draft-PR preparation on non-default branches within the current
  task/delegation. Do not return to Joseph for each included intermediate step.
- Codex retains its scoped PR workflow. Claude Code and Replit Agent have no
  standing permission to commit or push directly to main. Use a branch and PR
  for ordinary authorized changes.
- Technical readiness, a clean review, tool access, an agent role, or a prior
  workflow convention does not authorize a merge or default-branch update.
- Before any merge or default-branch transition, follow
  [TIBER-Ops #66](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/66)
  and the [shared merge checklist](https://github.com/Prometheus-Frameworks/TIBER-Ops/blob/main/runbooks/merge-checklist.md).
  Verify exact authority and state, inherited downstream effects, and the
  receiving agent's truthful canonical materialization and readback before
  execution. Unknown effects and missing/stale/mismatched authority fail closed.
- Preserve SECURITY_POLICY.md, stricter actor/task prohibitions, and independent
  review requirements. Agents do not merge their own work. This section grants
  no exception to a no-merge, no-deploy, or PR-only boundary.
- A later agent/session may continue authorized preparation but cannot reuse
  an agent-written record as standalone R3 human-origin proof.
- Prefer minimal, reversible changes and strong handoff notes.

## 6) Common failure modes
- Route collisions/regressions from editing the large monolithic `server/routes.ts` without prior search.
- High-blast-radius schema changes in `shared/schema.ts`.
- Silent API contract drift that breaks UI or external tools.
- Silent normalization/shape coercion of upstream values without contract-level justification.
- Masking upstream outages with fabricated “healthy” continuity.

## 7) Route/API rules
- Search existing routes before adding new endpoints.
- Be careful with `server/routes.ts`; it is large and collision-prone.
- Do not silently change API response shapes consumed by UI or external tools.
- Preserve backward compatibility unless a change is explicitly requested and documented.

## 8) Schema/DB rules
- Do not casually modify `shared/schema.ts`; schema changes have wide blast radius.
- Follow documented Drizzle workflow.
- Do **not** introduce raw SQL migrations unless explicitly requested.

## 9) Promoted artifact / upstream consumer rules
- Preserve promoted lane semantics and readiness gating.
- Prefer unavailable/unknown/error states over fabricated continuity.
- Do not silently normalize upstream values unless the contract explicitly requires it.
- If a consumer expects `0–1` and upstream provides `0–100`, document and validate normalization clearly.
- If touching model adapters or promoted artifacts, identify in PR notes:
  - producer repo,
  - artifact path,
  - consumer contract,
  - validation path.

## 10) Runtime/UI rules
- If touching UI, preserve clear loading/error/unavailable states.
- Keep read-only/promoted framing explicit where applicable.
- Do not add hidden assumptions to “smooth over” missing upstream data.

## 11) Environment/integration rules
- If touching external integrations, document required env vars and fallback behavior.
- Prefer explicit failure/unavailable states to implicit defaults when integrations are missing.

## 12) Known commands
### Canonical (verified from `package.json`)
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run typecheck`
- `npm run db:push`
- `npm run db:studio`
- `npm run test:forge`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run seed:metric-matrix`
- `npm run audit:metric-matrix`
- `npm run qa:gold`
- `npm run qa:fantasy-lab`
- `npm run qa:fantasy-lab-phase3`
- `npm run forge:parity`
- `npm run forge:parity:report`

### Setup (documented in repo docs)
- `npm install`

### Documented but not verified as canonical script
- `npm run lint` (README mentions lint, but no `lint` script was verified in `package.json` during inspection.)

## 13) Testing expectations by change type
- **Routes/API changes**: Run targeted tests or endpoint checks relevant to touched routes, plus `npm run test` when feasible.
- **Schema/DB changes**: Validate Drizzle workflow (`db:generate`/`db:migrate`/`db:push` as applicable) and verify impacted queries.
- **FORGE changes**: Run `npm run test:forge` at minimum; use parity commands when migration/comparison paths are touched.
- **UI changes**: Validate loading/error/unavailable states and impacted API wiring.
- **Integration/adapter changes**: Validate env var behavior, fallback path, and readiness/unavailable behavior.

## 14) PR checklist
- [ ] Scope is minimal and directly tied to request.
- [ ] Existing routes/contracts reviewed before additions.
- [ ] No silent API shape drift.
- [ ] No fabricated data/readiness continuity.
- [ ] Upstream ownership boundaries respected.
- [ ] Commands/tests run are listed with outcomes.
- [ ] If adapters/artifacts changed: producer repo, artifact path, consumer contract, validation path are documented.
- [ ] If integrations changed: required env vars and fallback behavior documented.

## 15) Done criteria
A task is done when:
- Requested change is implemented with minimal blast radius.
- Contract compatibility is preserved (or explicitly versioned/requested).
- Validation is run and recorded.
- Unknown/unavailable conditions are handled explicitly, not fabricated.
- PR notes provide enough context for the next agent/operator to continue safely.

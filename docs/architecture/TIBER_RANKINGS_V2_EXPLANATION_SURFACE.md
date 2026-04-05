# TIBER Rankings v2 Explanation Surface (Phase-2 Spec)

**Status:** Draft architecture/spec (spec-first).  
**Scope:** Define how Rankings v2 explanation objects evolve beyond phase-1 `uiMeta` bridging.  
**Non-goal:** No ranking math changes, no UI rebuild, no live mode expansion, no route behavior rewrite.

## Decision summary

- `uiMeta` is currently allowed as **phase-1 transitional consumer support** for `/tiers` and related adapters.
- Canonical Rankings v2 explanation should evolve into typed, stable structures in `explanation` + `trust`, instead of ad hoc UI sidecars.
- Human-readable prose remains useful, but **must not be used as a machine-data transport** for stable structural values.

---

## 1) Current state (repo-grounded)

### 1.1 What `rankingsV2.ts` currently exposes

The current canonical scaffold in `server/contracts/rankingsV2.ts` already defines:

- top-level response identity (`contractVersion`, `mode`, `lens`, `horizon`, `asOf`, `sourceStack`, `items`, `trust`),
- item-level `explanation` (placement summary, pillar notes, context adjustments, fragility/sustainability notes),
- item-level `trust` (confidence/freshness/sample/stability semantics),
- item-level `uiMeta` (typed transitional convenience fields currently used by `/tiers`).

This is a strong phase-1 baseline: explanation and trust objects exist, but many weekly details are still sparse or represented as neutral notes.

### 1.2 What PR119/PR120 effectively introduced in code terms

Current repo behavior reflects the phase-1 cleanup:

- `server/routes/rankingsV2Routes.ts` provides `GET /api/rankings/v2/weekly` as the canonical weekly v2 payload for public ranking consumers.
- That route maps FORGE cache rows into `items[]` with thin explanation/trust plus explicit typed `uiMeta` support.
- `client/src/pages/TiberTiers.tsx` consumes `/api/rankings/v2/weekly`.
- `client/src/pages/tiberTiersV2Mapper.ts` intentionally prefers `uiMeta` subscores/trajectory/issues for current table rendering, with `trust.confidence` fallback.

### 1.3 What `/tiers` currently needs from the contract

Today’s `/tiers` surface needs a stable row model for:

- identity + ordering (`playerId`, `playerName`, rank/score/tier/team/position),
- numeric subscores (`volume`, `efficiency`, `teamContext`, `stability`),
- confidence + trajectory + issue list,
- minimal freshness/status cues (`asOf`, cache-empty status via trust notes).

Current implementation gets these primarily through `uiMeta`, not from richer explanation substructures.

### 1.4 Where explanation is still thin or duplicated

Current weekly mapping still has phase-1 limitations:

- structural values are duplicated across multiple places (e.g., subscore-like signals in both explanatory notes and `uiMeta` paths),
- some explanatory values are represented as display prose (e.g., string notes) rather than first-class typed fields,
- pillar/context/risk/trust are present but not yet normalized as a complete machine- and user-facing explanation surface for broader public consumers.

---

## 2) Problem statement

`uiMeta` is acceptable in phase-1 as a bridge for the existing `/tiers` consumer.

However, long-term Rankings v2 cannot grow by attaching random consumer-specific fields to item objects or top-level response shape. That pattern recreates the legacy “mutated blob” problem.

The v2 contract needs a clear explanation system that supports both:

1. **machine-readable logic** (typed fields and stable semantics), and
2. **user-readable “why here” output** (summaries/notes that are grounded in typed structure).

Without that boundary, explanation quality will drift per consumer and future public routes will accrete one-off sidecars.

---

## 3) Proposed phase-2 explanation-surface model

## 3.1 Design target

For each ranking item, phase-2 should converge on this responsibility split:

- `explanation`: ranking rationale + pillars + contextual adjustments + risk/fragility + consumer-facing summary text.
- `trust`: confidence/freshness/stability/sample quality semantics.
- `uiMeta`: temporary adapter/convenience fields only, for compatibility while consumers migrate.

## 3.2 `explanation` ownership

`explanation` should be the canonical home for structural “why here” semantics.

Include here:

- **ranking rationale**
  - `placementSummary` (short human summary),
  - optional typed rationale tags/reasons (when stable enough).
- **pillar support**
  - typed pillar entries with normalized identifiers and numeric/supportive values,
  - optional concise note text.
- **contextual adjustments**
  - typed adjustments with direction/magnitude, source, optional note.
- **risk / fragility / sustainability**
  - typed flags or entries for fragility/sustainability dimensions,
  - optional explanatory prose.
- **consumer convenience fields that are explanation-native**
  - only if they describe ranking logic itself (not UI-only formatting concerns).

Rule: if a field expresses ranking logic and is stable across consumers, it belongs in `explanation` first.

## 3.3 `trust` ownership

`trust` should contain orthogonal reliability semantics, not ranking rationale:

- confidence score/band,
- freshness timestamp(s),
- sample sufficiency quality,
- stability/volatility semantics,
- caveat/status notes tied to confidence quality (not rank rationale).

Rule: if a field answers “how reliable/current is this signal?”, it belongs in `trust`.

## 3.4 `uiMeta` ownership (transitional)

`uiMeta` remains allowed in phase-2 only as a migration bridge where a public consumer has not yet adopted canonical explanation/trust fields.

`uiMeta` can temporarily carry:

- denormalized convenience copies used by current table rendering,
- compatibility aliases required to avoid UI breakage during incremental migration.

`uiMeta` should not become the default home for new ranking semantics.

## 3.5 What belongs nowhere

Do **not** add:

- machine-critical values only inside prose strings,
- consumer-specific one-offs in top-level response without contract-level review,
- unexplained ad hoc keys that bypass `explanation` and `trust` semantics,
- hidden weighting/output-driver fields without source/trust/explanation traceability.

---

## 4) Policy for future contract growth

When adding explanation-related data to Rankings v2:

1. **No machine-readable values in prose-only fields.**
   - prose is for user readability; typed fields carry machine semantics.
2. **Do not casually add consumer-specific top-level fields.**
   - prefer extension under `item.explanation` or `item.trust` when semantics are cross-consumer.
3. **Prefer typed sub-objects over freeform notes when values are stable.**
   - especially for pillars, adjustments, risk indicators, confidence/freshness dimensions.
4. **Treat `uiMeta` as transitional.**
   - new structural reasoning should go to canonical explanation/trust first.
5. **Preserve explicit source + freshness context.**
   - new explanation drivers should be representable in `sourceStack` and trust semantics.
6. **Keep weekly/ROS/dynasty semantics explicit.**
   - avoid hidden cross-mode assumptions in explanation fields.

---

## 5) Migration path

### Phase 1 (current)

- `/api/rankings/v2/weekly` is canonical weekly route.
- `/tiers` consumes v2 weekly with typed `uiMeta` bridge.
- Explanation/trust are present but intentionally thin.

### Phase 2 (this spec’s target)

- Add/normalize typed explanation substructures so public consumers can derive “why here” without relying on `uiMeta`.
- Keep prose summaries secondary to typed structures.
- Expand trust semantics only where they remain reliability-focused.

### Phase 3 (after canonical coverage)

- Migrate `/tiers` and similar consumers to explanation/trust-native fields.
- Reduce `uiMeta` to minimal compatibility shell.
- Remove or freeze `uiMeta` once no canonical consumer requires it.

---

## 6) Explicit deferrals (out of this PR)

This PR intentionally does **not** include:

- UI rebuild of `/tiers` or other ranking surfaces,
- weekly explanation redesign in app rendering,
- Team State weighting integration into ranking movement,
- dynasty/ROS explanation implementation build-out,
- route rewiring beyond lightweight references/comments,
- removal of `uiMeta`,
- ranking math/FORGE scoring changes,
- legacy endpoint cleanup expansion.

---

## 7) Implementation notes for maintainers

- Use `server/contracts/rankingsV2.ts` as the canonical contract authority.
- Treat `server/routes/rankingsV2Routes.ts` as the weekly reference implementation.
- Keep `client/src/pages/TiberTiers.tsx` + `client/src/pages/tiberTiersV2Mapper.ts` migration-aware: they are valid current consumers but not the final explanation contract target.

This document is the guardrail to prevent explanation-field creep after phase-1 (PR119/PR120 sequence) while enabling incremental, typed phase-2 evolution.

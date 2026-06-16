# Management Phase 4 Activation Plan — June 2026

> **This is a planning / architecture document, not an implementation.**
>
> It defines *what may move* from read-only diagnostic context toward active
> Management context, and *what gates must exist* before any such promotion
> happens. It does **not** change scoring, Team Direction weighting, FORGE
> artifact rows, or strategy ontology semantics, and it does **not** wire any
> source into advice. No runtime behavior changes land with this document.

Tracks issue [#227](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/227)
→ "Phase 4 activation plan: readiness gates before active Management context".

## Where Phase 3 left us

Phase 3 established read-only Management diagnostics and hardened Strategy
Context behavior. The post-Phase-3 checkpoint
(`docs/product/MANAGEMENT_PHASE3_CHECKPOINT.md`) re-verified, against the
expanded 59-row FORGE evidence base, that:

- the `FORGE_PLAYER_STATIC_V1` artifact is consumed as evidence only for
  `player_specific` rows; `generated_baseline` rows stay visibility-only;
- Strategy Context is read-only and fail-closed (template selection disabled,
  `selected_template_id` always `null`, no interpolation, no advice language);
- Team Direction classifies on player-specific FORGE coverage (≥50% gate
  cleared at 80%) without any new scoring;
- malformed/forged payloads fail closed rather than crashing or leaking.

Cross-repo seams across FORGE, TIBER-Data, Point-prediction-model, and
TIBER-Teamstate are stabilized. Phase 4 is the *deliberate* question of how —
and under what gates — any of that read-only context is allowed to become
*active* Management context.

This plan inherits, and does not relax, the
[Human-in-the-Loop Decision Doctrine](./HUMAN_IN_THE_LOOP_DECISION_DOCTRINE.md)
and the [Signal Watch Decision Loop](./SIGNAL_WATCH_DECISION_LOOP.md). Active
context still lands on the **Observe → Interpret** rungs of the decision ladder;
the human still owns the final click.

---

## 1. Activation levels

Every Management context source is assigned exactly one activation level. The
level is a property of *how a source is allowed to influence the surface*, not a
measure of how good the underlying data is. A source can only be at the level
its readiness gates (Section 2) currently support; failing a gate demotes it.

| Level | Name | What it may do | What it may not do |
| --- | --- | --- | --- |
| **0** | Unavailable / ignored | Nothing. Not read, not displayed, or explicitly shown as unavailable. | Appear as if present. Be inferred from absence. |
| **1** | Read-only diagnostic | Be displayed for inspection with provenance, freshness, and coverage labels. Surface "what is missing." | Feed any derived classification, count, or summary that another surface consumes. |
| **2** | Eligible supporting context | Contribute to *visibility/coverage accounting* that is clearly labeled as context (e.g. "evidence available for N of M roster rows"). | Change a classification result, confidence value, ranking, or score. |
| **3** | Active but non-prescriptive Management evidence | Inform an *interpretive, explanatory* read (e.g. "Team Direction is `retool`; this is supported by X and weakened by missing Y"). Be cited as evidence behind an existing read-only classification. | Become a recommendation, a trade/waiver/lineup action, a new score, or a re-weighting. Raise confidence above what its gate permits. |
| **4** | Recommendation / advice layer | *(Out of scope for now.)* Suggest specific roster, trade, waiver, or lineup actions. | **Exist in Phase 4.** Requires a separate, explicit later gate and issue. |

**Rules that bind the ladder:**

- **Level 4 is explicitly out of scope.** Nothing in this plan authorizes
  building an advice/recommendation layer. Reaching Level 3 does not imply a
  path to Level 4 without a new, named gate.
- **Promotion is one level at a time and reversible.** A source at Level 3 that
  loses a gate (stale artifact, provenance drop, coverage regression) falls back
  to the highest level it still satisfies — fail-closed, never fail-open.
- **No silent jumps.** Moving a source up a level is a reviewed change with a
  named owner, a test, and a UI label update — never a side effect of another
  change.
- **Levels attach to uses, not raw sources.** A single source can power more
  than one use at different levels (e.g. player-specific FORGE evidence both
  *drives* the Team Direction classification at Level 3 and *feeds coverage
  counts* at Level 2). Each use is gated independently at its own level; the gate
  model evaluates uses, so it must not collapse a multi-use source to one level.
- **A read-only diagnostic does not become scoring, ranking, advice, or a trade
  recommendation without an explicit later gate.** This is the load-bearing
  invariant of the entire phase.

---

## 2. Readiness gates

A source may sit at a given activation level only while it passes **every** gate
required for that level. Gates are evaluated against the same vocabulary already
used in the codebase (`PromotedOperationalState`, the FORGE
`provenance.score_source` values, and the Strategy Context status enum) so the
plan stays grounded in shipped contracts rather than new ones.

| # | Gate | Question it answers | Fail-closed behavior |
| --- | --- | --- | --- |
| G1 | **Artifact availability** | Does the promoted artifact exist and load? (`ready` vs `missing_export_artifact` / `upstream_unavailable` / `disabled_by_env_config` / `empty_dataset`) | Source drops to Level 0; surface shows unavailable, never fabricated. |
| G2 | **Literal / version match** | Do `artifact_type`, `schema_version`, and `model_version` match the pinned contract the consumer expects? | Treated as unsupported; fail closed, do not coerce. |
| G3 | **Provenance status** | Is each row's provenance the *evidence-bearing* kind? For FORGE: `score_source === "player_specific"` only. `generated_baseline` is visibility-only; `fallback_default`/unknown are non-evidence. | Non-evidence provenance caps the source at Level 1–2 (visibility), never Level 3. |
| G4 | **Fixture vs governed status** | Is the data a governed promoted artifact, or a fixture/seed used for tests/demos? | Fixture-backed data may not exceed Level 1 and must be labeled as fixture. Governed status is never inferred. |
| G5 | **Coverage completeness** | What fraction of the active-team roster does the source actually cover? (e.g. FORGE 24/30 player-specific) | Below the source's documented threshold, the source cannot raise confidence and is capped at its visibility level. |
| G6 | **Stale / missing state** | Is `generated_at` fresh enough for the consuming surface, and is the row present at all? | Stale/missing is shown as stale/missing; it never reads as current certainty and never silently substitutes a prior value. |
| G7 | **Consumer fail-closed behavior** | Does the consumer degrade safely on malformed/forged/partial input? | A consumer that cannot prove fail-closed handling is not allowed to promote the source past Level 1. |
| G8 | **Explicit UI labeling** | Is the source's level, provenance, coverage, and freshness visible to the user at the point of use? | No label, no promotion. Hidden state caps the source at Level 0–1. |

**Gate principles:**

- **Gates are conjunctive.** The source's effective level is the *minimum* of
  what each required gate permits.
- **Missing data is never evidence.** No gate may be satisfied by inferring a
  value from the absence of data (per the issue guardrail and the existing
  model-humility rules).
- **Fixture and provenance status are never hidden** to make a gate pass.
- Gate inputs reuse existing services where possible:
  `promotedModelStatusService` (G1/G2/G6), the FORGE static adapter provenance
  (G3), the active-team coverage helpers (G5), and Strategy Context
  normalization (G7).

---

## 3. Candidate context-source inventory

Each candidate is given a **current** level (what it is today) and a **Phase 4
ceiling** (the highest level it may reach *within Phase 4 if its gates pass*).
The ceiling is a cap, not a commitment to build.

| Source | Current level | Phase 4 ceiling | Gating notes |
| --- | --- | --- | --- |
| **FORGE player-specific evidence** (`FORGE_PLAYER_STATIC_V1`, `score_source === player_specific`) | 3 for classification (already the scored input to the read-only Team Direction classifier); 2 for coverage accounting | 3 (additionally *cited* as explanatory evidence behind the existing read-only direction) | This source has two distinct uses: driving the Team Direction classification is a **Level 3** influence (Section 1's own Level 3 example), governed by the full Level 3 gates; contributing to coverage counts is a separate **Level 2** use. Already passes G1–G3 at 24/30 coverage; G5 caps confidence. Phase 4 adds explicit evidence *citation*, not a new classification input. Must not change scoring or thresholds. |
| **FORGE generated baselines** (`score_source === generated_baseline`) | 1 (visibility only) | 1 (visibility only) | Permanently capped at visibility by G3. Never coverage, never confidence, never evidence. |
| **Strategy Context readiness** (`shared/managementStrategyContext.ts`) | 1 (`status: blocked` shown; `unavailable` fails closed) | 2 (eligible supporting context: readiness/coverage visibility) | Template selection stays **disabled**; `selected_template_id` stays `null`. Reaching Level 2 means showing readiness, **not** activating templates. |
| **Teamstate movement v1** (TIBER-Teamstate promoted movement) | 1 (read-only diagnostic) | 2 (eligible supporting context) | Gated on G1/G2/G4 (governed vs fixture) and G6 freshness. May contextualize, may not re-rank or score. |
| **Player ownership / identity coverage** (crosswalk + identity map) | 2 (coverage accounting: 30/30 identity, 25/30 crosswalk) | 2 (coverage accounting only) | Identity coverage is accounting, not evidence; it may scope *what is knowable*, never *how good a player is*. |
| **Point-prediction scenario outputs** (`point-scenarios`) | 1 (read-only diagnostic) | 2 (eligible supporting context) | Gated on G1/G5/G6. Scenarios are explanatory ranges, not predictions of outcomes; may not become a score or a recommendation. |
| **Rookie Alpha fallback evidence** (promoted `rookie-alpha`) | 1 (additive visibility fallback) | 1 (additive visibility fallback) | Capped at Level 1 by existing doctrine: never counts as FORGE coverage, never blends into roster strength, lineup totals, scoring, or rankings. |

### What each source may and may not influence

- **FORGE player-specific evidence** — *may* support the existing read-only
  Team Direction classification and be cited as the evidence behind it; *may
  not* change FORGE math, weights, Team Direction thresholds, or produce new
  rankings/scores.
- **FORGE generated baselines** — *may* be displayed for visibility; *may not*
  influence coverage, confidence, classification, or any total.
- **Strategy Context** — *may* expose readiness/blocked state and coverage of
  its template inputs (`age_band`, `experience_band`, `role_security_signal`,
  `market_liquidity_signal`); *may not* select, render, or interpolate a
  template, or emit advice language.
- **Teamstate movement v1** — *may* contextualize roster/environment changes for
  inspection; *may not* re-rank players, alter scoring, or become a move
  recommendation.
- **Player ownership / identity coverage** — *may* scope which rows are
  resolvable and surface coverage gaps; *may not* be treated as player quality
  or feed scoring.
- **Point-prediction scenario outputs** — *may* present scenario ranges as
  explanatory context with their own provenance; *may not* be collapsed into a
  single score, a ranking, or a start/sit/trade recommendation.
- **Rookie Alpha fallback** — *may* show promoted rookie context where FORGE is
  unavailable; *may not* become FORGE coverage, raise confidence, or fill a
  missing valuation layer silently.

---

## 4. Explicit non-goals (Phase 4)

Carried directly from the issue guardrails and pinned here so the plan cannot
drift:

- **No recommendations.** Do not implement an advice/recommendation layer
  (Level 4 stays out of scope).
- **No scoring changes.** Do not change FORGE scoring math, weights, or outputs.
- **No Team Direction re-weighting.** Do not change Team Direction weighting or
  thresholds.
- **No wiring into advice.** Do not wire Teamstate, Strategy, FORGE, PPM, or
  Rookie Alpha into advice, trades, waivers, or lineups.
- **No ML.** Do not introduce machine-learned models or training in Fantasy.
- **No hiding of status.** Do not hide fixture, provenance, coverage, or
  staleness state to make a surface look healthier.
- **No inference from missing data.** Absence is never promoted to evidence.
- **No autopilot.** Human/operator decision authority stays intact at every
  boundary.
- **No upstream-runtime coupling.** Consumption stays on promoted artifact
  boundaries; producer runtimes are not turned into hidden service dependencies.

---

## 5. Proposed next implementation slices (not yet built)

These are *proposed* slices for later issues/PRs. Listing them here does not
authorize building them; each needs its own issue, tests, and review. They are
ordered so that gate machinery lands before any promotion uses it.

1. **Activation-level + gate model (types only).** Introduce a shared
   `ManagementActivationLevel` (0–4) and a `ReadinessGateResult` shape that
   records, per source, which gates (G1–G8) pass and the resulting effective
   level. Pure data + unit tests; no surface consumes it yet.
2. **Gate evaluator over existing services.** A read-only evaluator that maps
   `promotedModelStatusService`, FORGE adapter provenance, coverage helpers, and
   Strategy Context status into gate results. Output is diagnostic only
   (Level ≤ 1 effect).
3. **Strategy Context readiness → Level 2 (visibility only).** Surface template
   *input coverage* and blocked/unavailable readiness, with labels, while
   template selection stays disabled and `selected_template_id` stays `null`.
4. **FORGE player-specific evidence — formalize at Level 3 + add citation.**
   The Team Direction classifier already consumes this evidence at Level 3; this
   slice registers that existing consumer under the Level 3 gates (so the gate
   model neither disallows it nor under-gates it) and adds explicit
   supporting/weakening evidence *citation* behind the read, without changing the
   classification, thresholds, or any score.
5. **Teamstate movement v1 / Point scenarios → Level 2.** Add labeled
   supporting-context panels gated on governed-vs-fixture (G4) and freshness
   (G6), with no re-ranking and no scoring.
6. **Activation-state UI labeling pass.** Ensure every promoted source renders
   its level, provenance, coverage, and freshness at the point of use (G8), so
   no promotion ships unlabeled.

A reasonable trigger to begin slice 1 (consistent with the Signal Watch unpark
note): `promotedModelStatusService` reports `ready` for the relevant
current-season upstream modules, and the FORGE season-unpin has landed.

## 6. Acceptance mapping

| Issue acceptance criterion | Where satisfied |
| --- | --- |
| A Phase 4 activation plan document exists | This document |
| Activation levels are defined | Section 1 |
| Context-source eligibility is documented | Section 3 |
| Readiness gates are documented | Section 2 |
| Explicit non-goals are documented | Section 4 |
| Next implementation slices proposed but not built | Section 5 |

See also: `docs/product/MANAGEMENT_PHASE3_CHECKPOINT.md`,
`docs/product/MANAGEMENT_DASHBOARD_V0.md`,
`docs/product/HUMAN_IN_THE_LOOP_DECISION_DOCTRINE.md`,
`docs/product/SIGNAL_WATCH_DECISION_LOOP.md`, and `CURRENT_PHASE.md`.

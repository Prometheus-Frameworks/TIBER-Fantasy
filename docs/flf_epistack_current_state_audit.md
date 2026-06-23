# FLF Epistemic Stack — Current-State Audit

> **Status:** Audit / reality check. Not an implementation plan.
> **Scope:** TIBER-Fantasy code and docs on `main`, with references to adjacent
> TIBER repos/artifacts only where they appear at existing integration points.
> **Tracking issue:** [#272](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/272)

This document maps **shipped** TIBER-Fantasy infrastructure against the
Future of Life Foundation "Epistemic Case Study Competition" rubric, which frames
a trustworthy-knowledge stack in three layers:

1. **Ingestion** — turning messy, multi-source evidence into attributed,
   provenance-aware claims and metadata.
2. **Structure** — documenting relationships between claims, sources, evidence,
   assumptions, caveats, and subquestions.
3. **Assessment** — evaluating what to believe or inspect next, including
   confidence, missing evidence, correlated evidence, cruxes, and
   out-of-model / adversarial uncertainty.

It is deliberately strict. The goal is the truth of the current system, not a
pitch. Every finding is classified `present`, `partial`, `missing`, or
`unclear`, and is anchored to concrete files that can be verified in-repo. It
distinguishes shipped infrastructure from philosophy, intention, or roadmap.

---

## Summary

TIBER's strongest FLF-aligned asset is **not** an ingestion pipeline or a
knowledge base — it is a **fail-closed readiness ladder** that decides *whether a
machine-produced signal is allowed to influence a decision*. That logic lives in
`shared/managementActivation.ts`, `shared/promotionGate.ts`, and
`server/modules/management/managementGateEvaluator.ts`, and it encodes — in the
type system, not just in docs — the exact distinction FLF's "Assessment" layer
cares about: **"data exists" ≠ "data should be acted on."**

Around it sits a real **provenance-aware adapter boundary**
(`server/modules/externalModels/`) that validates external model outputs at the
edge, pins contract / schema / model versions, tracks freshness, and surfaces
explicit `missing` / `malformed` / `unknown` / `ambiguous` states instead of
silently defaulting.

What TIBER does **not** have is FLF's relational epistemics: there is no claim
graph, no source→evidence→assumption→caveat→subquestion structure, no cruxes,
and no out-of-model / adversarial uncertainty. TIBER's "claims" are numeric
scores over a fixed fantasy-football schema, not attributed natural-language
claims. Freshness is assessed but **warn-only, not enforced**, and the promotion
gate is **diagnostic / not-wired** in several slices by design.

**Honest one-liner:** TIBER is a credible *assessment-and-promotion-governance*
prototype, weakest at general-purpose ingestion/structure. It should enter a
competition as a "**Reality Stack / promotion gate**" methodology, not as a
finished epistemic knowledge base.

---

## Competition rubric mapping

### Ingestion

**present**

- Raw-vs-normalized boundary is real and shipped: Bronze/Silver/Gold layering in
  `shared/schema.ts` (`BRONZE_INGEST` / `SILVER_TRANSFORM` / `GOLD_FACTS` task
  enums; `// BRONZE LAYER` / `// SILVER LAYER` sections).
- Ingestion provenance at the raw layer: `ingest_payloads`
  (`shared/schema.ts`, `pgTable("ingest_payloads", …)`) records `source` (enum),
  `endpoint`, `version`, `jobId`, `checksumHash` (dedup), `ingestedAt` /
  `processedAt`, `status`, `errorMessage`, `recordCount`.
- Provenance-aware consumption of *promoted external artifacts*: every adapter
  carries `generatedAt` / `promotedAt` / `model_version` / `schema_version` /
  `contractVersion` and a `source.provider`
  (`server/modules/externalModels/signalValidation/types.ts`,
  `server/modules/externalModels/forge/forgePlayerStaticTypes.ts`).
- Edge validation of messy upstream payloads with zod before they reach core
  logic (`signalValidation/types.ts` schemas; pattern documented in
  `server/modules/externalModels/MODULE.md`).
- Explicit missing-source / unresolved-identity / ambiguity states:
  `ForgePlayerStaticArtifactState = 'missing' | 'malformed' | 'duplicate_ids' |
  'unsupported' | 'disabled'`; `playerOwnership` answers `unavailable` /
  `unknown` / `ambiguous` / `malformed` without inventing roster truth
  (`server/modules/externalModels/MODULE.md`).

**partial**

- Freshness metadata exists and is assessed
  (`server/modules/externalModels/artifactFreshness.ts` → `fresh` / `warning` /
  `stale` / `unknown`) but is **warn-only**: it never rejects an artifact
  (`assessAndLogArtifactFreshness`, "fail-closed enforcement is a future phase").
- Source-verified vs provisional semantics exist only for promoted artifacts via
  provenance class (`player_specific` = evidence vs `generated_baseline` =
  visibility-only vs `fallback_default` = non-evidence,
  `forge/forgePlayerStaticTypes.ts`), not generically.
- Dataset versioning (`dataset_versions` in `shared/schema.ts`) tracks `source` ∈
  `sleeper` / `merge` / `recompute` + `committedAt`, but is coarse.

**missing**

- Attributed natural-language *claims* with source citations. TIBER ingests
  rows/metrics, not claims-with-sources.

**unclear / caveat**

- The loose committed data dumps at repo root (`player_inputs_2024_full.csv`,
  `wr_18_week_gamelogs.json`, etc.) are largely **un-provenanced** outside the DB
  pipeline. Provenance rigor lives in the DB / adapter lane, not in these files.
  End-to-end provenance over them should not be claimed.

### Structure

**present**

- Contract / version pinning: `docs/contracts/FORGE_DATA_SOURCE_CONTRACT.md`,
  `docs/contracts/`, `contractVersion` on artifacts, and gate **G2**
  ("artifact_type, schema_version, model_version match the pinned contract",
  `shared/managementActivation.ts`).
- Promotion states, explicit and conservative: `shared/promotionGate.ts`
  distinguishes `governed` / `fixture` / `ungoverned` / `unknown`, requires an
  `explicit_marker` (a `/promoted/` path is "only a hint, never sufficient"),
  dataset-level (not row-level) contract + freshness, and emits deterministic
  `blockers`.
- Governed vs fixture/test separation: gate **G4**; committed parity fixture pack
  (`server/modules/externalModels/forge/fixtures/forgeParityFixtures.ts`).
- **Score vs confidence separation (a clean FLF-aligned win):**
  `ForgePlayerStaticRow` carries `alpha` *and* a separate `confidence` field;
  `server/modules/forge/types.ts` declares
  `confidence: number; // 0-100, how reliable this score is`.
- **Observed vs inference boundary:** provenance class drives a hard ceiling —
  `generated_baseline` is "visibility-only", `fallback_default` / `unknown` are
  "non-evidence: fail closed" (`managementGateEvaluator.ts` `forgeProvenanceGate`).
- Producer/consumer relationships: the adapter boundary is explicit — "External
  services must enter core through adapters, not ad hoc fetches"
  (`server/modules/externalModels/MODULE.md`), which doubles as a model/signal
  inventory + consumer map.

**partial**

- Model/signal inventory exists as prose + `promotedModelStatusService.ts`, not
  as a queryable registry.
- Audit trails / operator notes are policy-level: `SECURITY_POLICY.md`
  ("Operator notes are audit/provenance metadata only … must not be consumed by
  model pipelines as input"), plus `dataset_versions.committedAt`. No structured
  per-claim audit log.

**missing**

- Relationships between *claims*, *assumptions*, *caveats*, *subquestions*. TIBER
  structures sources, contracts, and scores — not an argument/claim graph.

### Assessment

**present (strongest layer)**

- **The activation-level ladder is the headline artifact.**
  `ManagementActivationLevel` 0–3 (`0` unavailable → `1` read-only diagnostic →
  `2` supporting context → `3` active non-prescriptive evidence), with **Level 4
  (advice) declared but type-system-prevented from ever resolving**
  (`ManagementActivatableLevel = 0|1|2|3`, `shared/managementActivation.ts`). This
  *is* FLF's "what may we act on" question, encoded.
- Conjunctive, fail-closed gates G1–G8 (`READINESS_GATE_META`): availability,
  version match, provenance, fixture-vs-governed, **coverage completeness (G5)**,
  stale/missing (G6), **consumer fail-closed behavior (G7)**, explicit UI
  labeling (G8). "Effective level is the minimum of what each gate permits";
  "Missing data is never evidence. Absence cannot promote a source."
- Evidence-coverage diagnostics: `coverageGate` /
  `server/modules/management/forgeEvidenceActivationDiagnostics.ts` (fraction of
  active roster a source covers).
- Confidence + missing-data discipline: FORGE penalizes thin samples
  (`<4 games -30`, `<6 games -15`, `docs/contracts/FORGE_DATA_SOURCE_CONTRACT.md`
  §3.4) and mandates `null` (not `0`) for missing metrics, with weight
  redistribution.
- Stale / unavailable / not-wired states are first-class and pervasive
  (`artifactFreshness` statuses; Level 0; repeated explicit "deferred / not
  wired" notes, e.g. point-scenarios Slice 5C in `MODULE.md`).
- Human review / merge authority as a hard boundary: `SECURITY_POLICY.md` change
  control; product doctrine "Preserve human final decision authority"; advice
  level out of scope by construction.
- Safeguard against fake readiness: `promotionGate` + `managementActivation` make
  it structurally hard to claim a source is ready when it isn't.

**partial**

- Conflict handling exists only as migration-time parity
  (`server/modules/externalModels/forge/forgeCompareService.ts`, parity harness)
  — not general claim-conflict reconciliation.

**missing**

- Correlated-evidence detection, cruxes, and out-of-model / adversarial
  uncertainty. None of these exist.

---

## TIBER implementation evidence (anchor files)

| Capability | File |
|---|---|
| Fail-closed promotion gate | `shared/promotionGate.ts` |
| Activation-level + gate model | `shared/managementActivation.ts` |
| Domain gate evaluators (FORGE/Strategy) | `server/modules/management/managementGateEvaluator.ts` |
| Freshness assessment (warn-only) | `server/modules/externalModels/artifactFreshness.ts` |
| Provenance classes / artifact states | `server/modules/externalModels/forge/forgePlayerStaticTypes.ts` |
| Adapter boundary + model inventory | `server/modules/externalModels/MODULE.md` |
| Edge validation contracts | `server/modules/externalModels/signalValidation/types.ts` |
| Bronze ingestion provenance | `shared/schema.ts` (`ingest_payloads`, `dataset_versions`) |
| Data-source contract | `docs/contracts/FORGE_DATA_SOURCE_CONTRACT.md` |
| Repo-text-is-data doctrine | `SECURITY_POLICY.md` |

---

## Claims TIBER can make honestly

1. We ship a **fail-closed promotion/activation system** that decides whether a
   machine-produced signal may influence a decision, encoding "data exists ≠ data
   should be acted on" in the type system (advice level is unreachable by
   construction).
2. We have a **provenance-aware adapter boundary** that validates external model
   outputs at the edge, pins contract/schema/model versions, tracks freshness,
   and degrades to explicit `missing` / `malformed` / `unknown` / `ambiguous`
   states.
3. We **separate score from confidence from provenance class**, and gate
   "evidence-bearing" vs "visibility-only" vs "non-evidence" provenance
   distinctly.
4. We treat **repo text/artifacts as data, not authority** (`SECURITY_POLICY.md`)
   and keep a human at the decision boundary.

## Claims TIBER should avoid

- That freshness is **enforced** — it is warn-only today
  (`artifactFreshness.ts`).
- That the promotion gate is **auto-wired into promotion** — it is diagnostic /
  not-wired in several slices by design.
- That we have **end-to-end provenance over all data** — loose root CSV/JSON
  dumps are un-provenanced.
- That we do **claim-level / general-knowledge epistemics** — our "claims" are
  numeric scores over a fixed fantasy-football schema.
- That we model **correlated evidence, cruxes, or adversarial / out-of-model
  uncertainty** — we do not.

---

## Strongest layer vs weakest gap

- **Strongest:** Assessment — the fail-closed activation ladder + gates, backed
  by real, type-encoded code.
- **Close second:** Structure — contract/version pinning and the
  score/confidence/provenance separation.
- **Weakest gap:** general-purpose ingestion provenance (warn-only freshness,
  un-provenanced loose data files) and the complete absence of FLF-style
  relational epistemics (claims, assumptions, caveats, subquestions, cruxes,
  adversarial uncertainty).

---

## Recommended smallest credible FLF submission shape

A **human-AI workflow spec**, not a product: extract TIBER's promotion gate +
activation ladder (`promotionGate.ts`, `managementActivation.ts`,
`artifactFreshness.ts`) into a **domain-agnostic "Reality Stack" spec** — *"under
what provenance, contract, freshness, coverage, and fail-closed conditions may a
machine-produced signal be promoted from inspectable to actionable?"* — with
TIBER-Fantasy as the worked reference implementation. This maps cleanly onto
FLF's Assessment layer and is fully backed by shipped code, so no claims outrun
evidence.

## Recommended follow-up issues (max 2)

1. **Extract the domain-agnostic Reality Stack / Promotion-Gate spec**
   (docs-only, no runtime change): a markdown spec that lifts the gate ladder out
   of fantasy-football vocabulary and maps each gate to FLF ingestion / structure
   / assessment terms. This is the actual submission artifact.
2. **Promote freshness from warn-only to a real fail-closed gate on exactly one
   artifact** (bounded): wire `artifactFreshness` into a single promoted
   artifact's promotion decision to demonstrate one genuine end-to-end
   provenance → assessment → fail-closed path, without touching scoring / FORGE /
   classifier behavior.

---

*Audit only — no runtime, scoring, model, or classifier behavior is changed by
this document, and it introduces no dependencies or schema migrations.*

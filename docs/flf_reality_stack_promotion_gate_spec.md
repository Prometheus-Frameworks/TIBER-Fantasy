# TIBER Reality Stack — Promotion-Gate Methodology

> **Status:** Specification / methodology extract. Docs-only.
> **Purpose:** Translate TIBER's existing fail-closed promotion and activation
> infrastructure out of fantasy-football-specific language into a reusable,
> domain-agnostic epistemic protocol.
> **Tracking issue:** [#274](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/274)
> **Grounding source:** [`docs/flf_epistack_current_state_audit.md`](./flf_epistack_current_state_audit.md)
> (the prior current-state audit, #272 / #273)

This document is **not** a fantasy-football product doc, and it is **not** a claim
that TIBER is a finished epistemic knowledge base. It is a description of one
thing TIBER already does well — deciding *whether a machine-produced signal may
influence a decision* — lifted into general terms so it can be evaluated, reused,
and (later) submitted to the Future of Life Foundation "Epistemic Case Study
Competition."

Throughout, **shipped infrastructure** is distinguished from **proposed FLF
framing**:

- 🟢 **Shipped** — exists in the repo today, with a file anchor.
- 🔵 **Framing** — the FLF-facing interpretation/repackaging proposed here. Not
  new code; a way of describing the shipped behavior.

---

## 1. Status & relationship to the audit

This spec is the first of the two follow-ups recommended by the current-state
audit. It depends on, and must not contradict, the audit's findings:

- The audit found TIBER's strongest FLF-aligned asset is a **fail-closed
  readiness ladder**, not an ingestion pipeline or a knowledge base.
- The audit found TIBER does **not** have claim graphs, crux modeling,
  correlated-evidence detection, adversarial / out-of-model uncertainty, or
  general-purpose natural-language claim epistemics. This spec inherits those
  limits and does not claim otherwise.

The second follow-up — promoting freshness from warn-only to genuine fail-closed
enforcement — is **explicitly out of scope here** and is not implemented or
assumed by this document.

### Anchor files (shipped infrastructure)

| Concern | File |
|---|---|
| Activation-level + gate model (the ladder) | `shared/managementActivation.ts` |
| Fail-closed promotion gate | `shared/promotionGate.ts` |
| Domain gate evaluators (G1–G8, provenance gating) | `server/modules/management/managementGateEvaluator.ts` |
| Freshness assessment (warn-only today) | `server/modules/externalModels/artifactFreshness.ts` |
| Provenance-aware adapter boundary + model inventory | `server/modules/externalModels/MODULE.md` |

---

## 2. Core thesis

> **The Reality Stack promotion gate is a fail-closed protocol that governs how
> far a machine-produced signal is allowed to influence a decision, based on
> whether that signal has earned it.**

The single principle the whole protocol enforces:

> **"Data exists" does not mean "data should be acted on."**

A signal being *present, parseable, and plausible* is necessary but not
sufficient for it to *count as evidence* or *drive a recommendation*. Between
"the bytes loaded" and "act on this" sits a series of explicit, auditable gates.
A signal occupies the **highest level all of its gates permit, and no higher** —
the level is the *minimum* across gates, never the maximum.

Two properties make this more than a slogan:

1. 🟢 **Fail-closed, never fail-open.** Missing or unknown information can only
   *cap* (demote) a signal's level — it can never promote one. In
   `shared/managementActivation.ts`: *"Missing data is never evidence. Absence
   cannot promote a source."* A required gate with no result is treated as a cap
   to the lowest level.
2. 🟢 **The top of the ladder is structurally unreachable.** The
   "recommendation / advice" level exists as a declared value but is encoded so
   it can never be *resolved to* — `ManagementActivatableLevel = 0 | 1 | 2 | 3`,
   with the advice level (4) deliberately excluded from the resolvable type. The
   protocol cannot, by construction, hand a machine signal the authority to
   advise. A human stays at that boundary.

🔵 **FLF framing:** this is a concrete, code-enforced answer to FLF's *Assessment*
question — "what should we believe or act on next?" — that defaults to humility:
nothing is actionable until it proves it should be.

---

## 3. The promotion ladder (domain-agnostic)

🟢 Shipped as `ManagementActivationLevel` / `MANAGEMENT_ACTIVATION_LEVEL_META` in
`shared/managementActivation.ts`. The names below are the domain-agnostic
restatement of the same four resolvable levels.

| Level | TIBER id (shipped) | Domain-agnostic name | What it means | Decision weight |
|---|---|---|---|---|
| 0 | `unavailable` | **Unavailable** | Signal absent, unreadable, or ignored. | None. |
| 1 | `read_only_diagnostic` | **Inspectable diagnostic** | A human may *look at* the signal, but nothing downstream consumes it. | None — visibility only. |
| 2 | `eligible_supporting_context` | **Supporting context** | The signal may *accompany* other evidence as context, but cannot stand alone. | Contributory, non-decisive. |
| 3 | `active_non_prescriptive_evidence` | **Active non-prescriptive evidence** | The signal may *inform* a decision surface, but never *prescribe* an action. | Decisive-adjacent, still not advice. |
| (4) | `recommendation_advice` | **Advice / recommendation** | Declared but **never resolvable.** | Out of scope by construction. |

Movement up this ladder is **earned, monotonic in evidence, and reversible**: if
a gate that previously passed later fails (e.g. the signal goes stale), the
signal is demoted on the next evaluation. There is no "sticky" promotion.

> **Reading the ladder:** Levels 0→3 describe *permission to influence*, not data
> quality. A high-quality signal with unknown provenance is still capped low; the
> ladder measures earned trust, not raw accuracy.

---

## 4. The gate checklist

🟢 Shipped as gates **G1–G8** (`READINESS_GATE_META` in
`shared/managementActivation.ts`; evaluated in
`server/modules/management/managementGateEvaluator.ts`), plus the promotion-gate
preconditions in `shared/promotionGate.ts` and the human-authority boundary
encoded by the unreachable advice level. Gates are **conjunctive**: the effective
level is the minimum cap across all of them.

| # | Gate (domain-agnostic) | Question it answers | Shipped anchor |
|---|---|---|---|
| 1 | **Availability** | Does the signal/artifact exist and load at all? | G1; `ForgePlayerStaticArtifactState` (`available`/`missing`/`malformed`/…) |
| 2 | **Contract / version match** | Do the signal's declared type, schema version, and model version match the pinned contract? | G2; `contractMatch` + `promotionGate.ts` (`contract_literal_missing` / `contract_mismatch`) |
| 3 | **Provenance / governance** | Is the signal's origin the *evidence-bearing* kind, and is it explicitly governed (not merely path-hinted)? | G3 + `forgeProvenanceGate`; `promotionGate.ts` requires `governanceStatus === 'governed'` **and** `governanceSource === 'explicit_marker'` |
| 4 | **Fixture-vs-governed boundary** | Is this a real promoted artifact, or a fixture/seed/test sample? | G4; `PromotionGovernanceStatus = 'governed' | 'fixture' | …` |
| 5 | **Freshness** | Is the signal recent enough to still describe reality? | G6; `artifactFreshness.ts` (`fresh`/`warning`/`stale`/`unknown`) — **warn-only today** |
| 6 | **Coverage** | What fraction of the relevant population does the signal actually cover? | G5; `coverageGate` / `forgeEvidenceActivationDiagnostics.ts` |
| 7 | **Consumer fail-closed behavior** | Does the consumer degrade *safely* on malformed / partial / forged input? | G7; fail-closed resolver in `managementActivation.ts` |
| 8 | **Honest user-facing labeling** | Is the signal's level, provenance, coverage, and freshness visible at the point of use? | G8 (`uiLabelingGate`) |
| 9 | **Human final authority** | Is a human, not the signal, the one who decides? | Advice level unreachable: `ManagementActivatableLevel = 0|1|2|3`; doctrine in `SECURITY_POLICY.md` |

**Two notes on honesty:**

- Gate 5 (Freshness) is 🟢 *assessed* but 🔵 *not yet enforced* — it currently
  logs warnings and never rejects a signal (`artifactFreshness.ts`: "fail-closed
  enforcement is a future phase"). This spec describes it as a gate **and flags
  that its enforcement is the explicit, separate next follow-up.** It must not be
  presented as fully fail-closed today.
- Gate 9 is enforced *negatively*: the protocol cannot produce advice, so a human
  necessarily remains the decision-maker. That is a real, type-level guarantee,
  not a process promise.

---

## 5. Gate → FLF layer mapping

🔵 Framing. FLF describes three layers — **Ingestion** (attributed,
provenance-aware evidence), **Structure** (relationships between sources,
evidence, caveats), and **Assessment** (what to believe / act on next). The
Reality Stack gates map cleanly onto them:

| Gate | FLF layer | Why |
|---|---|---|
| 1 Availability | Ingestion | Whether evidence entered the system at all. |
| 2 Contract / version match | Ingestion → Structure | Attribution + a stable, versioned shape for the evidence. |
| 3 Provenance / governance | Ingestion → Structure | The "attributed, provenance-aware" requirement, made executable. |
| 4 Fixture-vs-governed | Structure | Distinguishes real evidence from scaffolding/test data. |
| 5 Freshness | Assessment | Whether the evidence still describes reality (time-decay of belief). |
| 6 Coverage | Assessment | How much of the question the evidence actually answers (missing-evidence accounting). |
| 7 Consumer fail-closed | Assessment | Safe behavior under uncertainty / adversarial-ish input. |
| 8 Honest labeling | Structure → Assessment | Surfaces caveats (provenance, coverage, freshness) at the point of use. |
| 9 Human final authority | Assessment | The decision of what to *act on* stays human. |

The **promotion ladder itself** (Section 3) is the Assessment layer's output: a
single, auditable verdict on how far a signal may travel toward action.

> **Honest scoping of the mapping:** TIBER's gates implement the *governance and
> permission* parts of these FLF layers. They do **not** implement FLF's
> relational epistemics — there is no claim graph, no assumptions/caveats/
> subquestion structure, no crux modeling, no correlated-evidence detection, and
> no adversarial / out-of-model uncertainty. Those remain genuine gaps (see §8).

---

## 6. Worked example (abstract)

The example is deliberately domain-neutral — it is about the *method*, not any
particular subject matter.

**Setup.** An upstream model emits a signal, `signal_X`, about some input. The
signal's own metadata asserts it is **decision-ready** (it would like to reach
Level 3, active non-prescriptive evidence). A consumer asks the Reality Stack:
*how far may `signal_X` actually go?*

**Gate evaluation** (conjunctive — effective level is the minimum cap):

| Gate | Result | Cap imposed |
|---|---|---|
| 1 Availability | Artifact loads. ✅ | — |
| 2 Contract / version match | Declared `schema_version` matches the pinned contract. ✅ | — |
| 3 Provenance / governance | Origin is marked, but governance came from a **path hint**, not an explicit governed marker. ❌ | Cap to Level 1 (`governance_path_hint_only`) |
| 5 Freshness | Newest timestamp is well past the max age → **stale**. ❌ | Would cap toward diagnostic |
| 6 Coverage | Covers only a small fraction of the relevant population. ❌ | Would cap toward diagnostic |
| 8 Honest labeling | Provenance/coverage/freshness are surfaced to the user. ✅ | — |

**Resolution.** Even though `signal_X` *asserts* it is decision-ready, it fails
provenance (path-hint only), freshness (stale), and coverage (thin). The minimum
cap wins: `signal_X` is **capped at Level 1 — inspectable diagnostic.** It is
shown to a human, clearly labeled, and consumed by **nothing** downstream. Its
self-declared readiness is recorded but does not promote it — *absence and
weakness of evidence cannot raise a level.*

**Contrast (promotion path).** Had the same signal been **explicitly governed**,
**fresh**, and **broad-coverage**, with a matching contract and fail-closed
consumer, every gate would pass and `signal_X` could reach **Level 3 — active
non-prescriptive evidence.** Even then it could **not** become advice: Level 4 is
unreachable, so a human still makes the call.

🟢 This is exactly the behavior produced by `evaluatePromotionGate`
(`shared/promotionGate.ts`) and `resolveManagementUseActivation`
(`shared/managementActivation.ts`): deterministic blockers, a minimum-cap
resolution, and a hard ceiling below advice.

---

## 7. What TIBER can honestly claim

🟢 Backed by shipped code:

1. We ship a **fail-closed promotion/activation protocol** that decides how far a
   machine-produced signal may influence a decision, with "data exists ≠ data
   should be acted on" enforced rather than aspirational.
2. The **advice level is unreachable by construction** — the protocol cannot
   hand a machine signal prescriptive authority; a human remains the decision-maker.
3. We have a **provenance-aware boundary** that validates external signals at the
   edge, pins contract/schema/model versions, assesses freshness, and degrades to
   explicit `missing` / `malformed` / `unknown` / `ambiguous` states instead of
   silently defaulting.
4. We **separate signal value from confidence from provenance class** and gate
   "evidence-bearing" vs "visibility-only" vs "non-evidence" origins distinctly.
5. We treat **repo text and artifacts as data, not authority**
   (`SECURITY_POLICY.md`), and keep audit/provenance metadata out of model input.

---

## 8. What TIBER must not claim yet

- That **freshness is enforced** — it is warn-only today
  (`artifactFreshness.ts`). It is a gate in *design*, not yet in *enforcement*.
- That the promotion gate is **automatically wired into promotion everywhere** —
  it is diagnostic / not-wired in several slices by design.
- That TIBER has **end-to-end provenance over all data** — loose, un-provenanced
  data files exist outside the governed pipeline.
- That TIBER does **claim-level or general-purpose natural-language epistemics** —
  its "signals" are structured/numeric outputs over fixed schemas, not attributed
  natural-language claims.
- That TIBER models **claim graphs, cruxes, correlated evidence, or adversarial /
  out-of-model uncertainty** — none of these exist.

Stating these limits *is part of the methodology*: the Reality Stack's value is
that it refuses to overclaim, and the spec must model that discipline.

---

## 9. How this spec could support the FLF submission

🔵 Framing / proposed path. This document is positioned to become the
**methodology core** of an FLF entry, which FLF explicitly allows to be a
human-AI workflow spec or interoperability protocol rather than a finished system.

A credible submission could be assembled as:

1. **The protocol** — this spec: the ladder, the gate checklist, the fail-closed
   and human-authority guarantees, the FLF-layer mapping.
2. **The reference implementation** — TIBER's shipped gate code
   (`promotionGate.ts`, `managementActivation.ts`, `managementGateEvaluator.ts`,
   `artifactFreshness.ts`) as proof the protocol runs, not just reads well.
3. **A domain case study** — a concrete worked application written *later*, in
   the submission paper itself, using FLF's own subject matter. The abstract
   example in §6 stays method-focused on purpose; the vivid, domain-specific
   illustration (e.g. FLF's competition prompts) belongs in the paper, not here.

The honest pitch to FLF: *we are not submitting a finished epistemic knowledge
base; we are submitting a small, working, fail-closed protocol for the single
hardest governance question in any such system — when a machine-produced signal
has earned the right to influence a decision — backed by code that already
enforces it, and honest about everything it does not yet do.*

---

*Docs-only. This spec introduces no runtime, scoring, model, or classifier
changes, no schema migrations, and no dependencies. It does not implement
freshness fail-closed enforcement, and it makes no claim that TIBER has claim
graphs, crux modeling, correlated-evidence detection, adversarial uncertainty
handling, or general-purpose natural-language claim epistemics.*

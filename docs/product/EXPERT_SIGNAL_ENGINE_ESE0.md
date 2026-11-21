# Expert Signal Engine — ESE-0 contract boundary

Status: implementation slice for Fantasy #392. This document describes contracts only; it does not activate a provider, scheduler, database table, recommendation feature, or UI.

Initial live-repository audit basis: `TIBER-Fantasy/main@5ad78c4e89f3ce4bfcbcc4af5912b8aca1063644`.

## Purpose

ESE-0 creates strict provider-neutral contracts for expert opinion so later FFCC work can preserve what an analyst said, when FFCC could know it, which format/horizon it applied to, why the analyst said it, and whether multiple publications were actually independent.

The boundary is intentionally narrow:

- expert opinion is not football truth;
- expert opinion is not real acquisition-market behavior;
- expert mock-draft position is not ADP;
- analyst confidence is not calibrated probability;
- ESE cannot mutate a CCF recommendation;
- CCF must remain operable when ESE is unavailable.

## Contracts

`ExpertSignalEventV0` records rankings, tiers, start/sit calls, waiver/trade calls, role/injury/scheme interpretations, and other typed analyst opinion.

`ExpertMockDraftSnapshotV0` records one immutable published mock. `mockType` distinguishes redraft, dynasty startup, rookie, best ball, NFL, and other typed mocks. NFL mocks never become fantasy mocks implicitly.

Both contracts require:

- strict schema versioning;
- `publishedAt`, `retrievedAt`, and `knownAt` clocks;
- a non-empty `sourcePolicyRef`;
- explicit missing context via `null` rather than inference;
- ancestry via `independenceCluster` without numeric independence weights;
- append-only correction/revision semantics.

## Temporal rule

Decision eligibility is determined only by:

```text
knownAt <= decisionAsOf
```

`publishedAt` and `retrievedAt` remain provenance clocks. They must not substitute for `knownAt` in historical replay. Later corrections cannot become visible in an earlier replay.

## Source-policy boundary

These states are distinct and must never be collapsed:

1. a source exists;
2. a source may be manually researched;
3. a source may be automatically ingested;
4. source material may be retained;
5. source material may be redistributed or cited.

ESE-0 does not decide any of those permissions. It requires a `sourcePolicyRef` so a later CIF `SourceDefinition` can govern them explicitly. No missing source policy may become decision-ready expert evidence.

## Legacy quarantine / reuse map

Existing code contains useful transport/identity patterns, but these semantics are not ESE authority:

- `server/adapters/ECRAdapter.ts`: reusable Bronze/raw-ingestion shape; current live ranking/ADP paths are largely placeholder structures.
- `server/services/enhancedEcrProvider.ts`: manual/CSV precedent only; randomized football features, mock start percentages, and hard-coded 2025 Sleeper paths are test/stale scaffolding and prohibited from decision-grade ESE evidence.
- `server/processors/MarketSignalsProcessor.ts`: useful provider/identity normalization precedent; hard-coded source `confidence` constants are not analyst reliability or calibrated probability.
- `server/processors/facts/MarketFactsProcessor.ts`: trend/consensus concepts require later audit before reuse; sentiment/prediction/master-score semantics are not ESE authority.
- `server/services/predictionEngine.ts`: legacy COMPASS weights/thresholds are not ESE or CCF authority.
- `shared/schema.ts`: no ESE-0 persistence change.

Consumer proof precedes deletion or replacement of any legacy path.

## ESE-0 non-goals

No live provider access, scraping, paid-source access, credentials, cron/scheduler, DB migration, runtime route, product UI, reliability weighting, lead/lag learning, CCF feature admission, recommendation change, or fantasy transaction.

## Verification target

Focused conformance tests must prove strict parsing, clock ordering, mock-vs-ADP separation, NFL-vs-fantasy mock separation, explicit missing context, future-evidence rejection, correction chronology, and ancestry preservation without fake independence weights.

Passing ESE-0 moves the slice only to `IMPLEMENTED_UNCERTIFIED`. Certification still requires independent review at the exact implementation head.

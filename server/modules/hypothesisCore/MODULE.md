# Hypothesis Core v0

This module is the provider-neutral, operator-local pure-domain slice frozen by
TIBER-Fantasy #352 and planned by the corrected #353 record. It validates
strict immutable record shapes, canonical digest inputs, paper-only witness
evaluation, trigger decisions, and atomic append proposals. It performs no
append itself.

## Public boundary

- `schemas.ts` exports closed Zod schemas and inferred reference/envelope types.
- `canonicalization.ts` exports the `jcs-sha256-v0` normalizer, registry, digest
  function, and stable canonical refusal codes.
- `conformance.ts` exports production validation, isolated paper evaluation,
  wake/no-op evaluation, and authority-bound append-proposal validation.
- `fixtures/` holds byte-exact immutable conformance data. Player-fixture v0 is
  historical only; v1 is the sole current Boston–Holani–Kaleb target.

Accepted results are values, never persisted facts. An `accepted` append
proposal is not a commit, activation, creation-authority issuance, or instruction
to execute.

## Invariants

- Every production Hypothesis has exactly one canonical primary subject.
- Private references remain operator/workspace local and digest pinned.
- History is append-only; corrections, lifecycle, resolution, and supersession
  are records rather than mutation of earlier records.
- Only definition, football evidence, operator context, and evaluation method
  fingerprints can wake evaluation. Output and rationale digests cannot.
- Missing-Witness absence requires its predeclared rule, a closed window, and
  complete governed coverage. Unobserved/unavailable never silently weaken.
- Probability is qualitative only; upside is governed-scenario only; resolution
  is categorical; roster fit and holding cost remain external or unevaluated.
- `LIVE-T0` is a production-refusal vector with `result: not_comparable`.
- Boston, Holani, and Kaleb are isolated synthetic subjects. Their v1 deltas are
  derived solely from witness-local `effect_map` values.

## Explicit exclusions

No file in this module may read environment variables, clocks, randomness,
filesystem, network, database, provider clients, process state, CEM storage,
roster state, or occupancy state. The module has no route, MCP tool, UI, store,
migration, scheduler, comparison/ranking, attention/notification, candidate
discovery, transaction, activation, deployment, or active-Hypothesis creator.
Reserved `fixture:` subjects are valid only in isolated paper mode and are
always refused by production admission with zero durable records.

Any persistence, provider/identity connection, operational evidence contract,
comparison/attention behavior, activation, or expansion of this twelve-file
surface requires a separately reviewed design and explicit operator authority.

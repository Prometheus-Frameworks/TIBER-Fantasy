# External FORGE migration parity harness

This folder now includes a small deterministic parity pack for the compare-only external FORGE migration path.

## What is here

- `fixtures/forgeParityFixtures.ts` — labeled migration fixtures with IDs, requests, and notes.
- `forgeParityHarness.ts` — runs the existing compare service across the fixture pack and aggregates a stable summary.
- `runForgeParityHarness.ts` — optional dev entrypoint that prints deterministic snapshot-style output.

## How to run it

From the repo root:

```bash
tsx server/modules/externalModels/forge/runForgeParityHarness.ts
```

The harness intentionally uses the existing compare path rather than a new production endpoint contract. It does **not** switch live FORGE traffic. It is for migration analysis only.

## How to use it during migration

- Run the harness before and after external FORGE changes.
- Treat the output as a compact regression snapshot for parity drift.
- Review `close`, `drift`, `unavailable`, and `not_comparable` counts along with the worst delta fixture.
- Use the per-fixture notes to debug why parity moved.

## Deterministic output

The harness exposes `formatForgeParitySnapshot(summary)` so tests or migration logs can persist the same stable summary shape each run.

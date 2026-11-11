# Architecture Lab — BIM-style evidence explorer (prototype)

Status: **experimental prototype for [TIBER-Fantasy #434](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/434). Not merged, not deployed, not linked from navigation.** Whether it is expanded, merged, discarded or rebuilt is an operator decision.

Building Information Modeling separates the design from the as-built structure and makes every service run traceable. This page applies that to nine TIBER repositories: each line between two repositories is one specific contract, artifact or route, and it carries the evidence class it has actually earned.

## What it is

- Route: `/architecture-lab`, registered only in the `full` runtime profile, lazy-loaded, with no navigation entry. `/architecture` is unchanged.
- Data: one hand-curated, versioned fixture (`client/src/pages/architectureLab/graphFixture.ts`). The page makes no network call and has no backend, database, auth or provider dependency.
- The fixture's types are UI-local. They are not TIBER-Data contracts.

## Using it

- **Evidence floor** (the four numbered buttons): choose how much proof you require. Lines that do not reach the floor turn into faint ghosts. At "Runtime observed" every line is a ghost, because nothing was observed running.
- **Select a repository**: its direct producers and direct consumers light up; the inspector lists what it owns and each contract in and out. One hop only.
- **Select a line**: the inspector shows the contract, the evidence class, what the evidence shows, what it does not show, any replay that was run, and links to the pinned files on each side.
- **Schedule**: the same relationships as a table, for reading on a phone or with a screen reader.
- Mouse: drag to pan, wheel to zoom. Touch: drag and pinch. Keyboard: Tab moves through repositories and lines, Enter or Space selects, arrow keys pan, `+`/`-` zoom, `0` fits, Escape clears.

Line style carries the class as well as colour: dashed is documented intent, solid is source-inspected, a double line is replay-verified, dotted grey is an unverified candidate. Nothing animates; motion is reserved for runtime-observed flow, and there is none.

## Evidence classes

| Class | Meaning here | Count in seed |
| --- | --- | --- |
| Runtime observed | Seen in a running system. The fixture format has no way to record this, and validation rejects the value. | 0 |
| Replay / test verified | A check was re-run against both pinned commits (byte parity of a bundled or vendored copy). | 3 |
| Source-inspected | Code or committed artifacts were read at pinned commits. Nothing executed. | 14 |
| Documented intent | A governing document says so. | 3 |
| Unknown / proposed | No evidence. Drawn only as a candidate. | 1 |

The full per-edge matrix is in [EVIDENCE_MATRIX.md](EVIDENCE_MATRIX.md), generated from the fixture.

## What reading the sources turned up

These are findings to look at, each with its limits stated on the edge:

1. **Identity crosswalk v2 is stale downstream.** The copy bundled in TIBER-Fantasy has 68 records (generated 2026-08-09); TIBER-Data's promoted export has 94 (2026-09-13). The bundled set is a strict subset. v1 is byte-identical.
2. **FORGE HTTP path mismatch.** TIBER-Fantasy's FORGE client defaults to `POST /v1/forge/evaluations`; the archived TIBER-FORGE serves `POST /api/forge/evaluate` and has no `/v1/` route. An env override exists, so this is not proof of a broken deployment.
3. **Two doctrine edges have no implementation.** The feedback-loop doctrine draws Role & Opportunity → point prediction → FORGE. Forecast's source excludes `role_and_opportunity` (and `teamstate`, `rookie_transition_features`) from its frozen base, and FORGE's source does not read Forecast.
4. **Two cycle review candidates.** TIBER-Fantasy ⇄ TIBER-Forecast (the request carries per-player opportunity averages computed in TIBER-Fantasy's own database) and TIBER-Fantasy → Forecast → FORGE → TIBER-Fantasy (closed only by a documented-intent edge). Neither is shown as a recursion; both need the fields traced.
5. **No declared data edge touches TIBER-Research** in the sources read. It is drawn with one unverified candidate only.

## Running it

With the normal dev server (needs the usual database configuration, `full` profile):

```bash
npm run dev
# http://localhost:5000/architecture-lab
```

Without a database (client only; `/api/runtime-profile` is stubbed to `full`, every other `/api` call returns 503):

```bash
node scripts/architecture-lab/preview.mjs
# http://127.0.0.1:5199/architecture-lab
```

## Checking it

```bash
# Fixture, validator, floors, cycles, route containment, matrix drift (36 tests)
NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.config.cjs --runInBand --coverage=false client/src/pages/architectureLab

# Re-check every evidence path, the key lines and the three byte-parity replays
# against local clones of the eight companion repositories (read-only git commands)
npx tsx scripts/architecture-lab/verifyEvidence.ts <dir-with-sibling-clones>

# Regenerate the evidence matrix after editing the fixture
npx tsx scripts/architecture-lab/writeEvidenceMatrix.ts
```

## Files

| Path | Purpose |
| --- | --- |
| `client/src/pages/architectureLab/types.ts` | UI-local graph shapes |
| `client/src/pages/architectureLab/graphFixture.ts` | The seed graph: 9 repositories, 21 relationships, pins and evidence |
| `client/src/pages/architectureLab/graphLogic.ts` | Validation, one-hop neighbours, floors, cycle candidates, matrix renderer |
| `client/src/pages/architectureLab/layout.ts` | Sheet positions and hand-routed orthogonal runs |
| `client/src/pages/architectureLab/ArchitectureLab.tsx`, `architectureLab.css` | The page |
| `client/src/pages/architectureLab/__tests__/architectureLabGraph.test.ts` | Tests |
| `scripts/architecture-lab/` | Preview server, evidence re-check, matrix generator |
| `client/src/App.tsx` | Route registration only |

## Limits

- **Stale by construction.** The fixture is a snapshot checked by hand on 2026-11-11 against the pinned commits. It does not refresh. TIBER-Fantasy evidence is pinned to `ee937153`, the commit this branch started from.
- **Not exhaustive.** It records relationships found in one reading pass over nine repositories. A missing line means "not found", not "does not exist". TIBER-Strategy, ARC, Age-curve, Signal-Validation and TIBER-Harness are out of the seed even though TIBER-Fantasy has adapters for some of them.
- **Nothing was run upstream.** No companion repository's tests, services or pipelines were executed. Upstream test files are cited as existing, not as passing.
- **No runtime evidence at all.** No deployment, environment or live request was observed. An edge being "replay-verified" says the bytes match, not that anything is running.
- **Replays live outside CI.** `verifyEvidence.ts` needs local clones; the jest suite checks the fixture's internal consistency and cannot tell whether a claim is true.
- **Issue and PR links are mutable** and are never the only evidence for a code claim. One edge (Ops → Fantasy) cites an issue alongside files.
- **One hop.** Impact tracing stops at direct producers and consumers.
- **Layout is hand-routed** for these 21 edges. Adding an edge means adding a route; there is no auto-layout.
- **Phone overview is small.** At 390 px wide the whole sheet fits but labels are about 7 px until you zoom; the Schedule view is the readable alternative.
- **Accessibility is partial.** Keyboard and labelled controls were exercised in Chrome; no screen reader was tested and contrast was not audited.
- **Tested in one browser** (headless Chrome, desktop 1440×1000 and emulated 390×844). No Safari, Firefox or real device.
- **Layout label.** The existing shell shows "Architecture" in its top bar for this route because it matches on the `/architecture` prefix. Left alone to avoid touching `TiberLayout`.

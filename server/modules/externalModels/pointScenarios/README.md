# Point Scenario Lab adapter

This adapter powers the read-only Point Scenario Lab in TIBER Data Lab.

## Architecture

The adapter intentionally follows the same promoted external-model pattern as WR Breakout Lab, Role & Opportunity Lab, and Age Curve / ARC Lab:

- Client: transport/config/file-system access for the upstream Point-prediction-Model output
- Adapter: canonical validation and normalization into a stable TIBER-facing scenario contract
- Service: stable `getPointScenarioLab()` interface for routes

TIBER-Fantasy does **not** compute or author point scenarios. It only reads promoted point-scenario outputs, validates them at the edge, and maps them into a trustable UI contract.

## Product surface

- Route: `GET /api/data-lab/point-scenarios[?season=<year>]`
- Page: `/tiber-data-lab/point-scenarios`
- Purpose: scenario-based point outcome context, complementary to breakout validation, usage/deployment context, and developmental timing

## Upstream expectations

Preferred upstream is a stable compatibility/API response from Point-prediction-Model (PPM). If no API is configured, the adapter can read a stable exported artifact at `POINT_SCENARIO_EXPORTS_PATH`.

Minimum normalized fields when available:

- scenario ID / name
- player ID / name
- team / position
- baseline projection / adjusted projection / delta
- confidence band / label
- scenario type / event type
- notes / explanation
- source metadata / provenance

## Upstream contract status (confirmed)

The upstream compatibility contract now exists in Point-prediction-Model:

- PPM exposes **`GET /api/point-scenarios/lab`** as a compatibility / Data Lab route specifically for this adapter.
- PPM also supports **on-demand `point_scenario_lab.json` export** for the artifact fallback (`POINT_SCENARIO_EXPORTS_PATH`).

PPM itself remains **scoring-first**: its primary surfaces are `/api/scoring/*` and the TIBER scoring views under `/api/tiber/*`. The `/api/point-scenarios/lab` route (and the JSON export) are a **compatibility / Data Lab surface only** — not PPM's primary interface — and exist to keep this adapter's existing contract working.

This adapter (client → adapter → service, normalizing into `CanonicalPointScenarioLabResponse` / the TIBER Point Scenario Lab contract) **remains the correct downstream boundary** for point scenarios in TIBER-Fantasy. The contract confirmation requires no adapter change by itself.

**Management note:** Management receives **none** of this today, and Management point-scenario activation (**Slice 5C**) **remains deferred**. The upstream contract existing is necessary but not sufficient: the next blocker is on the Fantasy side — Management can only cite point-scenario readiness once there is a **governed + fresh readiness surface** around this lab contract (the same `generatedAt` / governance gap tracked for Teamstate movement in Slices 5A/5B).

## Guardrails

- Read only only — no scoring, mutation, or scenario authoring flows in TIBER-Fantasy
- Preserve explicit missing, malformed, empty, and upstream-unavailable states
- Keep trust/inspectability high by exposing grouped detail sections plus raw promoted payload context

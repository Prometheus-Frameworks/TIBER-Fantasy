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

Preferred upstream is a stable compatibility/API response from Point-prediction-Model. If no API is configured, the adapter can read a stable exported artifact at `POINT_SCENARIO_EXPORTS_PATH`.

Minimum normalized fields when available:

- scenario ID / name
- player ID / name
- team / position
- baseline projection / adjusted projection / delta
- confidence band / label
- scenario type / event type
- notes / explanation
- source metadata / provenance

## Guardrails

- Read only only — no scoring, mutation, or scenario authoring flows in TIBER-Fantasy
- Preserve explicit missing, malformed, empty, and upstream-unavailable states
- Keep trust/inspectability high by exposing grouped detail sections plus raw promoted payload context

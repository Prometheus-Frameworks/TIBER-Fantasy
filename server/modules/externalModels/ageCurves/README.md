# Age Curve / ARC Lab adapter

This adapter powers the read-only Age Curve / ARC Lab in TIBER Data Lab.

## Data sources

The adapter intentionally follows the same promoted external-model pattern as WR Breakout Lab and Role & Opportunity Lab:

- Preferred upstream API compatibility endpoint at `AGE_CURVE_MODEL_BASE_URL + AGE_CURVE_MODEL_LAB_ENDPOINT_PATH`
- Stable exported JSON artifact at `AGE_CURVE_EXPORTS_PATH` (defaults to `./data/age-curves/age_curve_lab.json`)

TIBER-Fantasy does **not** compute or backfill age-curve logic. It only reads promoted ARC outputs, validates them at the edge, and maps them into a stable UI contract.

## Current routes

- Route: `GET /api/data-lab/age-curves[?season=<year>]`
- Page: `/tiber-data-lab/age-curves`

## Normalized fields

Where available, the adapter surfaces:

- player identity (`player_id`, `player_name`, `team`, `position`, `season`)
- developmental context (`age`, `career_year`, `peer_bucket`, `trajectory_label`)
- expected-vs-actual framing (`expected_ppg`, `actual_ppg`, `ppg_delta`)
- summary context (`age_curve_score`, provenance/source metadata)

## Guardrails

- Read only
- No write actions
- No in-repo ARC recomputation
- Malformed upstream payloads fail closed with stable internal error codes

# Data Lab Command Center orchestrator

This module powers the read-only Data Lab Command Center at:

- Route: `GET /api/data-lab/command-center`
- Page: `/tiber-data-lab/command-center`
- Purpose: the front door for promoted Data Lab research surfaces, surfacing summary-level signals and clear next clicks without recomputing any underlying model logic.

## What it does

- Reads the promoted Breakout, Role & Opportunity, Age Curve / ARC, and Point Scenario lab adapters in parallel.
- Normalizes a compact, sectioned command-center payload for triage and discovery.
- Produces lightweight per-module readiness states (`ready`, `empty`, `unavailable`).
- Generates direct quick links into Player Research and Team Research so operators can move from summary signals into deeper inspection with one click.
- Preserves graceful partial-data behavior: one missing or unavailable upstream module should not prevent the page from rendering.

## What it does not do

- It does **not** rescore players.
- It does **not** create a unified cross-model score.
- It does **not** write data, ingest raw exports, or modify any upstream model outputs.
- It does **not** replace the underlying promoted labs or workspaces; it only acts as a concise synthesis layer above them.

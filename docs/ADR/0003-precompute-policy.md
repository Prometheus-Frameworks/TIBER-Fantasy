# ADR 0003 — Precompute-First Policy for API Performance

Date: 2026-02-25  
Status: Accepted

## Context
Some endpoints (especially batch/range queries and play-by-play derived aggregations) can be expensive and may time out under load. Agents will call APIs frequently and unpredictably. Platform reliability requires predictable latency.

## Decision
Adopt a precompute-first policy:

1) Any endpoint that is batch, table-driven, or frequently called must be served from:
- gold tables, OR
- cached tables/materialized views, OR
- fast pre-aggregations keyed by common dimensions (player_id, season, week/window)

2) Heavy computations (play-by-play scans, large joins, wide window aggregations) are not allowed on the critical request path for public endpoints.

3) Performance target:
- p95 < 500ms locally
- p95 < 800ms against production DB for public endpoints

If an endpoint violates targets, it is moved to a cached strategy before additional feature work.

## Consequences
- Positive: Predictable performance and fewer timeouts.
- Positive: Better cost control (DB load, compute).
- Positive: Cleaner separation: pipelines compute, API serves.
- Negative: More storage and pipeline complexity.
- Negative: Requires recompute strategy when logic changes.

## Notes
This policy does not ban on-demand computation entirely. It bans it for endpoints that are hot-path platform surfaces.

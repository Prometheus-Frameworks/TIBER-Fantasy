# CURRENT_PHASE — Stabilization & Governance

Phase Name: Stabilization & Governance
Last Updated: February 17, 2026

Primary Objectives (do not exceed 5):
1) FORGE correctness hardening (bounds, monotonic tiers, no anomalies)
2) Sentinel/validation improvements
3) Repo cleanliness + documentation clarity
4) CI reliability (typecheck/lint/tests)
5) Performance + batch stability where applicable

Out of Scope (hard no):
- New modules (IDP, rookie scanner, world vectors, etc.)
- New ingestion pipelines
- DB schema changes / migrations
- Changes to FORGE scoring weights or tier thresholds unless explicitly requested by owner
- Any automation that posts/sends messages without owner approval

Definition of Done (must be measurable):
- Alpha clamped 0–100: Enforced in `server/modules/forge/forgeGrading.ts` line 139 via `Math.max(0, Math.min(100, alpha))`. Tested in `server/modules/forge/__tests__/forgeIntegration.test.ts`.
- Pillars clamped 0–100: Enforced per-pillar — `forgeEngine.ts` (weighted average + normalize), `xfpVolumePillar.ts`, `roleConsistencyPillar.ts`, `robustNormalize.ts`, `envMatchupRefresh.ts` — all use `Math.max(0, Math.min(100, score))`.
- Tier mapping monotonic: `mapAlphaToTier()` in `server/modules/forge/forgeGrading.ts` lines 173-181 uses descending threshold checks — higher alpha always maps to same or better tier.
- Batch endpoint stable under load: `/api/forge/eg/batch` (registered in `server/modules/forge/routes.ts`). Current observed performance: ~9-13 seconds per position for full season aggregation.
- Sentinel checks passing: Sentinel engine at `server/modules/sentinel/sentinelEngine.ts`, rules at `server/modules/sentinel/sentinelRules.ts`, routes at `server/routes/sentinelRoutes.ts`, frontend at `client/src/pages/SentinelDashboard.tsx`. Check via `GET /api/sentinel/status`.

Active Workstreams (max 3):
- FORGE data quality guardrails + regression hardening (snapshotDataValidator, integration tests)
- Governance scaffolding + documentation (manus pack, TIBER_CONTEXT, CURRENT_PHASE)
- Mobile responsiveness + UI polish

/**
 * Teamstate movement v1 activation diagnostics (Phase 4 Slice 5A) — supporting
 * context, visibility only.
 *
 * Slice 5B: the builder was moved to `shared/teamstateMovementActivationDiagnostics.ts`
 * so the client bundle can render the Teamstate Movement Activation card by calling
 * the same builder (no duplicated gate logic). This module re-exports it for
 * back-compat; behavior is unchanged and it remains pure (no artifact reads).
 *
 * NOT WIRED INTO `/api/management/team-direction`. The team-direction route and the
 * league dashboard payload do not carry Teamstate movement v1 status (movement is
 * loaded through its own `teamEnvironmentMovementService` artifact read). The
 * Slice 5B client card maps the movement readiness the dashboard ALREADY fetches
 * from `/api/data-lab/team-environment-movement`; no new runtime artifact read is
 * added, and server route wiring stays deferred.
 */
export * from '@shared/teamstateMovementActivationDiagnostics';

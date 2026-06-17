/**
 * Teamstate movement v1 activation diagnostics (Phase 4 Slice 5A) — supporting
 * context, visibility only.
 *
 * Implements the Teamstate-movement half of proposed slice 5 of
 * `docs/product/MANAGEMENT_PHASE4_ACTIVATION_PLAN.md` ("Teamstate movement v1 →
 * Level 2"). It maps an already-known Teamstate movement v1 status/provenance/
 * freshness response into the Slice 1 model via the Slice 2 evaluator
 * ({@link evaluateTeamstateMovementSupportingContext}) and returns read-only
 * supporting-context activation metadata.
 *
 * Supporting-context / diagnostic only:
 *   - It does NOT re-rank players, change scoring, Team Direction, FORGE, or
 *     Strategy behavior, and emits no advice/recommendation language.
 *   - It performs no artifact reads and no I/O; every input is a value the caller
 *     already has from the Teamstate movement service.
 *   - Fail-closed: a non-ready promoted status, a wrong/missing artifact literal
 *     (legacy v0 vs the pinned v1 contract, gate G2), unverified/missing
 *     governance, stale data, or missing UI labeling cannot promote the source.
 *     Governed status is recognized ONLY via the promoted-artifact path boundary,
 *     never from a provenance-token allowlist and never inferred from missing data.
 *
 * NOT WIRED INTO A ROUTE IN THIS SLICE. `/api/management/team-direction` and the
 * league dashboard payload do not currently carry Teamstate movement v1 status
 * (movement is loaded through its own `teamEnvironmentMovementService` artifact
 * read). Per the Slice 5A issue, this slice does not add a new runtime artifact
 * read; the builder is pure and tested, and route wiring is deferred until the
 * movement readiness is already available on a Management payload.
 */
import type {
  ManagementActivatableLevel,
  ManagementActivationCap,
  ManagementActivationLevel,
  ReadinessGateId,
  ReadinessGateResult,
} from '@shared/managementActivation';
import type { PromotedOperationalState } from '../externalModels/promotedModelStatusService';
import type { TeamEnvironmentMovementState } from '../externalModels/teamState/teamEnvironmentMovementService';
import { TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1 } from '../externalModels/teamState/teamEnvironmentMovementClient';
import {
  evaluateTeamstateMovementSupportingContext,
  type ManagementSourceGovernance,
} from './managementGateEvaluator';

/** Default artifact freshness window (matches DEFAULT_ARTIFACT_MAX_AGE_DAYS). */
const DEFAULT_MAX_AGE_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Known fixture/synthetic provenance tokens. The only concrete token shipped
 * in-repo today is `fixture_scaffold`. These cap the source at Level 1 (fixture).
 */
const FIXTURE_PROVENANCE_STATUSES: ReadonlySet<string> = new Set([
  'fixture_scaffold',
  'fixture',
  'synthetic',
  'seed',
]);

/**
 * IMPORTANT: governed status is NOT derived from a provenance-token allowlist.
 * The producer's governed provenance token is not established in this repo yet
 * (only `fixture_scaffold` exists), so governed-like tokens — `governed`,
 * `promoted`, `production`, `production_promoted`, `governed_promoted`, etc. — are
 * treated as unverified and fail closed (`unknown`). Governed is recognized only
 * via the promoted-artifact *path boundary* (see {@link isPromotedPathBoundary}),
 * which is a deployment/path signal, not a provenance-token claim. The real
 * governed token will be wired in when a Teamstate artifact/contract proves it.
 */
function isPromotedPathBoundary(artifactPath: string | null | undefined): boolean {
  return typeof artifactPath === 'string' && artifactPath.replace(/\\/g, '/').includes('/promoted/');
}

/** The Teamstate movement v1 readiness subset this builder consumes. */
export interface TeamstateMovementActivationInput {
  /** Movement service state: 'ready' | 'unavailable' | 'error'. */
  state?: TeamEnvironmentMovementState | null;
  /**
   * The artifact literal the movement service resolved. The service can return
   * `state: 'ready'` for either the v1 artifact or the legacy v0 artifact during
   * the transition, so the contract gate (G2) only passes for the pinned v1
   * literal; a v0/unknown literal fails closed.
   */
  artifact?: string | null;
  /** ISO timestamp the artifact was generated, for freshness. */
  generatedAt?: string | null;
  /** Provenance marker (e.g. 'fixture_scaffold' for fixtures). */
  provenanceStatus?: string | null;
  /** Source artifact path, used as a governed-boundary signal. */
  artifactPath?: string | null;
  /** Whether the consuming surface labels this source at the point of use (G8). */
  uiLabeled?: boolean;
}

export interface TeamstateMovementActivationDiagnostics {
  diagnostic: true;
  readOnly: true;
  supportingContext: true;
  sourceId: string;
  useId: string;
  /** Mapped promoted operational status used for the availability gate. */
  promotedStatus: PromotedOperationalState | null;
  /** The artifact literal observed, and whether it matched the pinned v1 contract (G2). */
  artifact: string | null;
  contractMatch: boolean | null;
  governance: ManagementSourceGovernance | null;
  fresh: boolean | null;
  provenanceStatus: string | null;
  generatedAt: string | null;
  requestedLevel: ManagementActivationLevel;
  effectiveLevel: ManagementActivatableLevel;
  capped: boolean;
  failedGates: ReadinessGateId[];
  caps: ManagementActivationCap[];
  gateResults: ReadinessGateResult[];
  explanation: string;
}

/**
 * G2 contract literal: passes only for the pinned v1 movement artifact. A legacy
 * v0 (or any other) literal fails closed; a missing literal is omitted and fails
 * closed as a required gate. Governed status of the wrong artifact is never enough.
 */
function deriveContractMatch(artifact: string | null | undefined): boolean | undefined {
  if (artifact === undefined || artifact === null) return undefined;
  return artifact === TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1;
}

function derivePromotedStatus(state: TeamEnvironmentMovementState): PromotedOperationalState {
  switch (state) {
    case 'ready':
      return 'ready';
    case 'unavailable':
      return 'missing_export_artifact';
    case 'error':
    default:
      return 'upstream_unavailable';
  }
}

function deriveGovernance(input: TeamstateMovementActivationInput): ManagementSourceGovernance {
  const status = input.provenanceStatus?.trim().toLowerCase();
  // Known fixture/synthetic tokens are labeled fixture (caps at Level 1).
  if (status && FIXTURE_PROVENANCE_STATUSES.has(status)) return 'fixture';
  // Governed is recognized ONLY via the promoted-artifact path boundary — never
  // from a provenance token. An unverified governed-like token by itself (no
  // promoted path) is not enough and fails closed as unknown.
  if (isPromotedPathBoundary(input.artifactPath)) return 'governed';
  return 'unknown';
}

function deriveFreshness(
  generatedAt: string | null | undefined,
  now: number,
  maxAgeDays: number,
): boolean | undefined {
  if (!generatedAt) return undefined;
  const ts = Date.parse(generatedAt);
  if (Number.isNaN(ts)) return undefined;
  return now - ts <= maxAgeDays * DAY_MS;
}

function explain(effectiveLevel: ManagementActivatableLevel, failedGates: readonly ReadinessGateId[]): string {
  if (effectiveLevel >= 2) {
    return `Teamstate movement v1 is shown as read-only supporting context (Level ${effectiveLevel}). It contextualizes roster/environment changes only; it does not re-rank players, alter scoring, or drive any roster move.`;
  }
  if (effectiveLevel === 1) {
    return `Teamstate movement v1 is shown at read-only diagnostic visibility (Level 1) and labeled as such; it is not eligible supporting context (failed/capping gates: ${failedGates.join(', ') || 'none'}).`;
  }
  return `Teamstate movement v1 is not shown as supporting context (effective Level 0; failed/missing gates: ${failedGates.join(', ') || 'none'}). It is shown as unavailable, never inferred as present.`;
}

/**
 * Build read-only Teamstate movement v1 supporting-context activation diagnostics
 * from an already-known movement readiness response. Pure — no artifact reads.
 */
export function buildTeamstateMovementActivationDiagnostics(
  input: TeamstateMovementActivationInput | null | undefined,
  options: { now?: number; maxAgeDays?: number } = {},
): TeamstateMovementActivationDiagnostics {
  const now = options.now ?? Date.now();
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;

  const state = input?.state ?? null;
  const promotedStatus = state ? derivePromotedStatus(state) : undefined;
  const contractMatch = deriveContractMatch(input?.artifact);
  const governance = input ? deriveGovernance(input) : undefined;
  const fresh = deriveFreshness(input?.generatedAt, now, maxAgeDays);

  const { use, resolved } = evaluateTeamstateMovementSupportingContext(
    {
      promotedStatus,
      contractMatch,
      governance,
      fresh,
      uiLabeled: input?.uiLabeled,
    },
    2,
  );

  return {
    diagnostic: true,
    readOnly: true,
    supportingContext: true,
    sourceId: use.sourceId,
    useId: use.useId,
    promotedStatus: promotedStatus ?? null,
    artifact: input?.artifact ?? null,
    contractMatch: contractMatch ?? null,
    governance: governance ?? null,
    fresh: fresh ?? null,
    provenanceStatus: input?.provenanceStatus ?? null,
    generatedAt: input?.generatedAt ?? null,
    requestedLevel: resolved.requestedLevel,
    effectiveLevel: resolved.effectiveLevel,
    capped: resolved.capped,
    failedGates: resolved.failedGates,
    caps: resolved.caps,
    gateResults: [...use.gateResults],
    explanation: explain(resolved.effectiveLevel, resolved.failedGates),
  };
}

/**
 * Teamstate movement v1 activation diagnostics (Phase 4 Slice 5A builder, moved
 * to shared in Slice 5B) — supporting context, visibility only.
 *
 * Maps an already-known Teamstate movement v1 status/provenance/freshness response
 * into the Slice 1 model via the Slice 2 evaluator
 * ({@link evaluateTeamstateMovementSupportingContext}) and returns read-only
 * supporting-context activation metadata.
 *
 * Pure extraction: this module lives in `shared/` so the client bundle can render
 * the Teamstate Movement Activation card by calling the SAME builder the server
 * uses, instead of duplicating gate logic. It performs no artifact reads and no
 * I/O — every input is a value the caller already has.
 *
 * Supporting-context / diagnostic only:
 *   - It does NOT re-rank players, change scoring, Team Direction, FORGE, or
 *     Strategy behavior, and emits no advice/recommendation language.
 *   - Fail-closed: a non-ready promoted status, a wrong/missing artifact literal
 *     (legacy v0 vs the pinned v1 contract, gate G2), unverified/missing
 *     governance, stale data, or missing UI labeling cannot promote the source.
 *     Governed status is recognized ONLY via the promoted-artifact path boundary,
 *     never from a provenance-token allowlist and never inferred from missing data.
 */
import type {
  ManagementActivatableLevel,
  ManagementActivationCap,
  ManagementActivationLevel,
  ReadinessGateId,
  ReadinessGateResult,
} from './managementActivation';
import {
  evaluateTeamstateMovementSupportingContext,
  type ManagementSourceGovernance,
  type PromotedOperationalState,
  type TeamEnvironmentMovementState,
} from './managementGateEvaluator';
import {
  evaluatePromotionGate,
  type PromotionFreshnessScope,
  type PromotionFreshnessStatus,
  type PromotionGovernanceSource,
  type PromotionGovernanceStatus,
  type PromotionReadiness,
} from './promotionGate';

/**
 * Pinned Teamstate movement v1 artifact literal. Mirrors the server transport
 * client's `TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1`; defined here so the
 * shared builder does not import the Node-coupled client module.
 */
export const TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1 = 'team_environment_movement_v1' as const;

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
 * which is a deployment/path signal, not a provenance-token claim.
 */
function isPromotedPathBoundary(artifactPath: string | null | undefined): boolean {
  return typeof artifactPath === 'string' && artifactPath.replace(/\\/g, '/').includes('/promoted/');
}

/**
 * Producer-owned governance block from team_environment_movement_v1
 * (TIBER-Teamstate PR #41). Drives the explicit promotion gate. Absent/malformed
 * → the gate fails closed and Level 2 stays deferred.
 */
export interface TeamstateMovementGovernanceInput {
  governanceStatus?: string | null;
  governanceSource?: string | null;
  contractVersion?: string | null;
  /** Dataset-level generation timestamp (producer-owned). */
  generatedAt?: string | null;
  promotedAt?: string | null;
  promotionNotes?: string | null;
}

/** The Teamstate movement v1 readiness subset this builder consumes. */
export interface TeamstateMovementActivationInput {
  /** Movement service state: 'ready' | 'unavailable' | 'error'. */
  state?: TeamEnvironmentMovementState | null;
  /** Producer-owned explicit governance block (PR #41); null when absent. */
  governance?: TeamstateMovementGovernanceInput | null;
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
  /**
   * Explicit promotion-gate result (#249). Authoritative for Level 2: a consumer
   * may display Level 2 supporting context only when `promotionReadiness.promotable`
   * is true. `effectiveLevel` above is the source's raw operational readiness; the
   * promotion gate (not the `/promoted/` path) decides eligibility for promotion.
   */
  promotionReadiness: PromotionReadiness;
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

// --- explicit promotion-gate mapping (#249 PR 2) -----------------------------

/** Map the producer governanceStatus token to the shared gate's governance enum. */
function mapGovernanceStatus(status: string | null | undefined): PromotionGovernanceStatus {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'governed':
      return 'governed';
    case 'fixture':
    case 'fixture_scaffold':
    case 'synthetic':
    case 'seed':
      return 'fixture';
    case 'ungoverned':
      return 'ungoverned';
    default:
      return 'unknown';
  }
}

/**
 * Map the producer governanceSource to the shared gate's source model. Only a
 * recognized explicit producer marker counts as `explicit_marker`; a path-derived
 * source is a `path_hint` (never sufficient); an absent block or unrecognized
 * source is `missing` (fail closed). The `/promoted/` artifact path is NOT an
 * explicit marker here — it is only a weak hint.
 */
function mapGovernanceSource(
  governance: TeamstateMovementGovernanceInput | null | undefined,
): PromotionGovernanceSource {
  if (!governance) return 'missing';
  switch ((governance.governanceSource ?? '').trim().toLowerCase()) {
    case 'explicit_marker':
    case 'explicit':
    case 'producer':
    case 'producer_attested':
    case 'attested':
    case 'promotion_pipeline':
    case 'governed_marker':
      return 'explicit_marker';
    case 'path':
    case 'path_hint':
    case 'promoted_path':
      return 'path_hint';
    default:
      return 'missing';
  }
}

/** Dataset-level freshness status for the promotion gate (mirrors assessArtifactFreshness thresholds). */
function deriveDatasetFreshnessStatus(generatedAt: string | null | undefined, now: number, maxAgeDays: number): PromotionFreshnessStatus {
  if (!generatedAt) return 'unknown';
  const ts = Date.parse(generatedAt);
  if (Number.isNaN(ts)) return 'unknown';
  const ageDays = (now - ts) / DAY_MS;
  if (ageDays <= maxAgeDays) return 'fresh';
  if (ageDays <= maxAgeDays * 2) return 'warning';
  return 'stale';
}

/**
 * Build the explicit promotion-gate readiness from the producer governance block.
 * Dataset-level freshness uses the governance block's own generatedAt (falling
 * back to the forwarded top-level generatedAt); freshnessScope is `dataset` only
 * when such a dataset-level timestamp exists.
 */
function buildPromotionReadiness(
  input: TeamstateMovementActivationInput,
  now: number,
  maxAgeDays: number,
): PromotionReadiness {
  const governance = input.governance ?? null;
  const datasetGeneratedAt = governance?.generatedAt ?? input.generatedAt ?? null;
  const freshnessScope: PromotionFreshnessScope = datasetGeneratedAt ? 'dataset' : 'none';
  const freshnessStatus = datasetGeneratedAt
    ? deriveDatasetFreshnessStatus(datasetGeneratedAt, now, maxAgeDays)
    : 'unknown';
  const contractObserved = governance?.contractVersion ?? null;
  return evaluatePromotionGate({
    governanceStatus: mapGovernanceStatus(governance?.governanceStatus),
    governanceSource: mapGovernanceSource(governance),
    contractMatch: contractObserved === TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1,
    contractExpected: TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1,
    contractObserved,
    freshnessStatus,
    freshnessScope,
    freshnessTimestamp: datasetGeneratedAt,
  });
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
  const promotionReadiness = buildPromotionReadiness(input ?? {}, now, maxAgeDays);

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
    promotionReadiness,
  };
}

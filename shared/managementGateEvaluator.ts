/**
 * Shared Management readiness gate primitives + Teamstate movement evaluator
 * (Phase 4 Slice 5B pure extraction).
 *
 * These are the pure gate rules and the Teamstate movement supporting-context
 * evaluator, lifted out of `server/modules/management/managementGateEvaluator.ts`
 * so BOTH the server diagnostics modules and the client bundle can resolve the
 * same activation logic without duplicating gate rules. This module contains only
 * pure types/constants/functions — no I/O, no Node/server-only imports — and is
 * safe to import from the client.
 *
 * Behavior is identical to the original server implementation. The server
 * `managementGateEvaluator.ts` re-exports everything here and keeps the
 * FORGE/Strategy domain evaluators (which depend on server-only FORGE types).
 */
import {
  resolveManagementUseActivation,
  type ManagementActivationLevel,
  type ManagementSourceUse,
  type ReadinessGateId,
  type ReadinessGateResult,
  type ResolvedManagementUseActivation,
} from './managementActivation';

/**
 * Promoted operational state union. Mirrors the server promoted-status service's
 * `PromotedOperationalState` (a pure string union); kept here so the shared gate
 * logic does not import the Node-coupled service.
 */
export type PromotedOperationalState =
  | 'ready'
  | 'available_other_seasons'
  | 'missing_export_artifact'
  | 'upstream_unavailable'
  | 'disabled_by_env_config'
  | 'empty_dataset';

/** Teamstate movement service state. Mirrors the server movement service union. */
export type TeamEnvironmentMovementState = 'ready' | 'unavailable' | 'error';

/**
 * Whether a source is a governed promoted artifact, a fixture/seed, or unknown.
 * Mirrors gate G4 in the plan; governed status is never inferred, so `unknown`
 * fails closed.
 */
export type ManagementSourceGovernance = 'governed' | 'fixture' | 'unknown';

/** Canonical source ids used by the modeled evaluator cases. */
export const FORGE_PLAYER_STATIC_SOURCE_ID = 'forge_player_static_v1';
export const STRATEGY_CONTEXT_SOURCE_ID = 'management_strategy_context';
export const TEAMSTATE_MOVEMENT_SOURCE_ID = 'teamstate_movement_v1';

/** Canonical use ids. Each is a distinct *use*, gated independently. */
export const FORGE_PLAYER_SPECIFIC_TEAM_DIRECTION_USE = 'forge_player_specific.team_direction_classification';
export const FORGE_GENERATED_BASELINE_VISIBILITY_USE = 'forge_generated_baseline.visibility';
export const STRATEGY_CONTEXT_READINESS_USE = 'strategy_context.readiness';
export const TEAMSTATE_MOVEMENT_SUPPORTING_USE = 'teamstate_movement_v1.supporting_context';

/** The result of evaluating one source use: the built use and its resolution. */
export interface ManagementUseEvaluation {
  use: ManagementSourceUse;
  resolved: ResolvedManagementUseActivation;
}

// --- gate-result helpers -----------------------------------------------------

export function gateResult(
  use: string,
  gate: ReadinessGateId,
  passed: boolean,
  effectiveCap: ManagementActivationLevel | null,
  reason: string,
): ReadinessGateResult {
  return { gate, use, passed, effectiveCap, reason };
}

/** G1 from a promoted operational state: only `ready` clears availability. */
export function promotedAvailabilityGate(use: string, state: PromotedOperationalState): ReadinessGateResult {
  if (state === 'ready') return gateResult(use, 'G1', true, null, 'promoted artifact ready');
  return gateResult(use, 'G1', false, 0, `promoted artifact not ready (${state})`);
}

/** G4 governed-vs-fixture: governed clears; fixture caps at Level 1; unknown fails closed. */
export function governanceGate(use: string, governance: ManagementSourceGovernance): ReadinessGateResult {
  switch (governance) {
    case 'governed':
      return gateResult(use, 'G4', true, null, 'governed promoted artifact');
    case 'fixture':
      return gateResult(use, 'G4', false, 1, 'fixture-backed data may not exceed Level 1');
    default:
      return gateResult(use, 'G4', false, 0, 'governance unknown — governed status is never inferred');
  }
}

/** G5 coverage completeness: below the documented rate caps confidence at Level 2. */
export function coverageGate(
  use: string,
  coverage: { covered: number; total: number; minimumRate: number },
): ReadinessGateResult {
  const { covered, total, minimumRate } = coverage;
  const rate = total > 0 ? covered / total : 0;
  if (rate >= minimumRate) {
    return gateResult(use, 'G5', true, null, `coverage ${covered}/${total} meets ${minimumRate}`);
  }
  return gateResult(use, 'G5', false, 2, `coverage ${covered}/${total} below ${minimumRate} — cannot raise confidence`);
}

/** G6 freshness: stale data caps at Level 1 (shown as stale, never current certainty). */
export function freshnessGate(use: string, fresh: boolean): ReadinessGateResult {
  return fresh
    ? gateResult(use, 'G6', true, null, 'data is fresh')
    : gateResult(use, 'G6', false, 1, 'data is stale — shown as stale, not current certainty');
}

/** G7 consumer fail-closed behavior: an unproven consumer cannot promote past Level 1. */
export function consumerFailClosedGate(use: string, failClosed: boolean): ReadinessGateResult {
  return failClosed
    ? gateResult(use, 'G7', true, null, 'consumer degrades safely on malformed input')
    : gateResult(use, 'G7', false, 1, 'consumer fail-closed handling unproven');
}

/** G8 explicit UI labeling: hidden state caps at Level 1. */
export function uiLabelingGate(use: string, labeled: boolean): ReadinessGateResult {
  return labeled
    ? gateResult(use, 'G8', true, null, 'level/provenance/coverage/freshness labeled at point of use')
    : gateResult(use, 'G8', false, 1, 'state not labeled — no label, no promotion');
}

/** G2 literal/version match: a contract mismatch is unsupported and fails closed. */
export function contractMatchGate(use: string, matches: boolean): ReadinessGateResult {
  return matches
    ? gateResult(use, 'G2', true, null, 'artifact_type / schema_version / model_version match the pinned contract')
    : gateResult(use, 'G2', false, 0, 'contract mismatch — unsupported, fail closed');
}

// --- Teamstate movement evaluator -------------------------------------------

export interface TeamstateMovementGateInput {
  promotedStatus?: PromotedOperationalState;
  /** Whether the artifact literal/version matches the pinned movement contract (G2). */
  contractMatch?: boolean;
  governance?: ManagementSourceGovernance;
  fresh?: boolean;
  uiLabeled?: boolean;
}

// G2 (contract/version) and G8 (UI labeling) are required because this use can
// resolve to Level 2: the wrong artifact literal (e.g. legacy v0 vs v1) or an
// unlabeled source must not reach eligible-supporting context. Omitting either
// therefore fails closed via the missing-required-gate path.
export const TEAMSTATE_MOVEMENT_REQUIRED_GATES: readonly ReadinessGateId[] = ['G1', 'G2', 'G4', 'G6', 'G8'];

/**
 * Case 4: Teamstate movement v1 as read-only supporting context (Level 2
 * ceiling). Gated only on status/contract/governance/freshness inputs the caller
 * already has — no artifact read. A wrong artifact literal/version fails closed
 * (G2); fixture-backed data caps at Level 1 (G4); a non-ready promoted status
 * fails closed (G1).
 */
export function evaluateTeamstateMovementSupportingContext(
  input: TeamstateMovementGateInput,
  requestedLevel: ManagementActivationLevel = 2,
): ManagementUseEvaluation {
  const useId = TEAMSTATE_MOVEMENT_SUPPORTING_USE;
  const gateResults: ReadinessGateResult[] = [];
  if (input.promotedStatus !== undefined) gateResults.push(promotedAvailabilityGate(useId, input.promotedStatus));
  if (input.contractMatch !== undefined) gateResults.push(contractMatchGate(useId, input.contractMatch));
  if (input.governance !== undefined) gateResults.push(governanceGate(useId, input.governance));
  if (input.fresh !== undefined) gateResults.push(freshnessGate(useId, input.fresh));
  if (input.uiLabeled !== undefined) gateResults.push(uiLabelingGate(useId, input.uiLabeled));

  const use: ManagementSourceUse = {
    sourceId: TEAMSTATE_MOVEMENT_SOURCE_ID,
    useId,
    requestedLevel,
    gateResults,
  };
  return {
    use,
    resolved: resolveManagementUseActivation(use, { requiredGates: TEAMSTATE_MOVEMENT_REQUIRED_GATES }),
  };
}

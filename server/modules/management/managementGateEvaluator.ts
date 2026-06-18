/**
 * Management readiness gate evaluator (Phase 4 Slice 2) — diagnostic only.
 *
 * Implements proposed slice 2 of `docs/product/MANAGEMENT_PHASE4_ACTIVATION_PLAN.md`
 * ("Gate evaluator over existing services"): a pure, read-only mapping from
 * already-known Management source readiness signals into {@link ReadinessGateResult}s
 * and a resolved activation, using the Slice 1 model in `shared/managementActivation.ts`.
 *
 * Slice 5B note: the pure gate primitives and the Teamstate movement evaluator
 * were lifted into `shared/managementGateEvaluator.ts` so the client bundle can
 * resolve the same activation logic without duplicating gate rules. This module
 * re-exports them (`export *` below) for back-compat and keeps the FORGE/Strategy
 * domain evaluators here, since they depend on server-only FORGE types. Behavior
 * is unchanged.
 *
 * Scope and guardrails (carried from the plan and the Slice 2 issue):
 *   - **Diagnostic only / not wired.** Output is NOT consumed by any runtime
 *     product behavior in this slice; it translates status callers already have.
 *   - **Pure & read-only.** No artifact reads, no I/O, no network.
 *   - **Fail closed.** Missing/unknown signals never promote a source.
 *   - **Levels attach to uses.** Each evaluator returns a {@link ManagementSourceUse}.
 *   - **No contract/scoring/Team Direction/Strategy template changes.**
 */
export * from '@shared/managementGateEvaluator';

import {
  resolveManagementUseActivation,
  type ManagementActivationLevel,
  type ManagementSourceUse,
  type ReadinessGateId,
  type ReadinessGateResult,
} from '@shared/managementActivation';
import {
  gateResult,
  contractMatchGate,
  governanceGate,
  coverageGate,
  freshnessGate,
  consumerFailClosedGate,
  uiLabelingGate,
  FORGE_PLAYER_STATIC_SOURCE_ID,
  STRATEGY_CONTEXT_SOURCE_ID,
  FORGE_PLAYER_SPECIFIC_TEAM_DIRECTION_USE,
  FORGE_GENERATED_BASELINE_VISIBILITY_USE,
  STRATEGY_CONTEXT_READINESS_USE,
  type ManagementSourceGovernance,
  type ManagementUseEvaluation,
} from '@shared/managementGateEvaluator';
import type { ManagementStrategyContextStatus } from '@shared/managementStrategyContext';
import type {
  ForgePlayerStaticArtifactState,
  ForgePlayerStaticScoreSource,
} from '../externalModels/forge/forgePlayerStaticTypes';

/**
 * Future evaluator cases that need new runtime artifact reads / integration
 * plumbing and are intentionally NOT implemented. Documented here so the omission
 * is explicit rather than silent.
 */
export const FUTURE_EVALUATOR_CASES: readonly string[] = [
  'Point-prediction scenario outputs (requires reading promoted point-scenarios artifact)',
  'Player ownership / identity coverage accounting (requires crosswalk + identity map reads)',
  'Rookie Alpha fallback visibility (requires promoted rookie-alpha artifact reads)',
];

// --- FORGE-specific gate helpers (depend on server-only FORGE types) ---------

/** G1 from a FORGE static artifact state: only `available` clears availability. */
function forgeArtifactAvailabilityGate(use: string, state: ForgePlayerStaticArtifactState): ReadinessGateResult {
  if (state === 'available') return gateResult(use, 'G1', true, null, 'FORGE static artifact available');
  // Any non-available state fails closed to Level 0 — never fabricate presence.
  return gateResult(use, 'G1', false, 0, `FORGE static artifact not available (${state})`);
}

/** G3 from FORGE provenance: only `player_specific` is evidence-bearing. */
function forgeProvenanceGate(use: string, scoreSource: ForgePlayerStaticScoreSource): ReadinessGateResult {
  switch (scoreSource) {
    case 'player_specific':
      return gateResult(use, 'G3', true, null, 'player_specific provenance is evidence-bearing');
    case 'generated_baseline':
      // Valid but visibility-only — caps below evidence (Level 3), never promotes.
      return gateResult(use, 'G3', false, 1, 'generated_baseline provenance is visibility-only');
    default:
      // fallback_default / unknown are non-evidence: fail closed.
      return gateResult(use, 'G3', false, 0, `non-evidence provenance (${scoreSource})`);
  }
}

// --- FORGE static evaluators -------------------------------------------------

/**
 * Inputs for a FORGE static use. Each signal is optional: an undefined signal
 * emits no gate result, so a gate required for the use's level fails closed when
 * its data is missing.
 */
export interface ForgeStaticGateInput {
  artifactState?: ForgePlayerStaticArtifactState;
  contractMatch?: boolean;
  scoreSource?: ForgePlayerStaticScoreSource;
  governance?: ManagementSourceGovernance;
  coverage?: { covered: number; total: number; minimumRate: number };
  fresh?: boolean;
  consumerFailClosed?: boolean;
  uiLabeled?: boolean;
}

function buildForgeStaticGateResults(use: string, input: ForgeStaticGateInput): ReadinessGateResult[] {
  const results: ReadinessGateResult[] = [];
  if (input.artifactState !== undefined) results.push(forgeArtifactAvailabilityGate(use, input.artifactState));
  if (input.contractMatch !== undefined) results.push(contractMatchGate(use, input.contractMatch));
  if (input.scoreSource !== undefined) results.push(forgeProvenanceGate(use, input.scoreSource));
  if (input.governance !== undefined) results.push(governanceGate(use, input.governance));
  if (input.coverage !== undefined) results.push(coverageGate(use, input.coverage));
  if (input.fresh !== undefined) results.push(freshnessGate(use, input.fresh));
  if (input.consumerFailClosed !== undefined) results.push(consumerFailClosedGate(use, input.consumerFailClosed));
  if (input.uiLabeled !== undefined) results.push(uiLabelingGate(use, input.uiLabeled));
  return results;
}

/** Every gate is required for the FORGE player-specific Level 3 classification use. */
const FORGE_PLAYER_SPECIFIC_REQUIRED_GATES: readonly ReadinessGateId[] = [
  'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8',
];

/**
 * Case 1: FORGE player-specific evidence driving the read-only Team Direction
 * classification (Level 3 ceiling). All gates are required; any missing/failed
 * gate demotes the use, and non-`player_specific` provenance can never reach
 * Level 3.
 */
export function evaluateForgePlayerSpecificTeamDirection(
  input: ForgeStaticGateInput,
  requestedLevel: ManagementActivationLevel = 3,
): ManagementUseEvaluation {
  const use: ManagementSourceUse = {
    sourceId: FORGE_PLAYER_STATIC_SOURCE_ID,
    useId: FORGE_PLAYER_SPECIFIC_TEAM_DIRECTION_USE,
    requestedLevel,
    gateResults: buildForgeStaticGateResults(FORGE_PLAYER_SPECIFIC_TEAM_DIRECTION_USE, input),
  };
  return {
    use,
    resolved: resolveManagementUseActivation(use, { requiredGates: FORGE_PLAYER_SPECIFIC_REQUIRED_GATES }),
  };
}

/** Visibility-only use needs availability, provenance, and labeling. */
const FORGE_GENERATED_BASELINE_REQUIRED_GATES: readonly ReadinessGateId[] = ['G1', 'G3', 'G8'];

/**
 * Case 2: FORGE generated-baseline visibility. A second, independent use of the
 * same source. Provenance gate (G3) caps it at Level 1 visibility; it can never
 * become coverage, confidence, or evidence regardless of the requested level.
 */
export function evaluateForgeGeneratedBaselineVisibility(
  input: ForgeStaticGateInput,
  requestedLevel: ManagementActivationLevel = 1,
): ManagementUseEvaluation {
  const use: ManagementSourceUse = {
    sourceId: FORGE_PLAYER_STATIC_SOURCE_ID,
    useId: FORGE_GENERATED_BASELINE_VISIBILITY_USE,
    requestedLevel,
    gateResults: buildForgeStaticGateResults(FORGE_GENERATED_BASELINE_VISIBILITY_USE, input),
  };
  return {
    use,
    resolved: resolveManagementUseActivation(use, { requiredGates: FORGE_GENERATED_BASELINE_REQUIRED_GATES }),
  };
}

// --- Strategy Context evaluator ---------------------------------------------

export interface StrategyContextGateInput {
  status?: ManagementStrategyContextStatus;
  uiLabeled?: boolean;
}

const STRATEGY_CONTEXT_REQUIRED_GATES: readonly ReadinessGateId[] = ['G1'];

/**
 * Case 3: Strategy Context readiness. Diagnostic visibility only — this never
 * selects, renders, or interpolates a template.
 *   - `unavailable` fails closed (G1) to Level 0.
 *   - `blocked` is inspectable but deferred: it stays at read-only diagnostic
 *     visibility (Level 1) and does not activate templates.
 *   - `available` is reserved for a future activation phase; in this diagnostic
 *     slice it is still treated as visibility only.
 */
export function evaluateStrategyContextReadiness(
  input: StrategyContextGateInput,
  requestedLevel: ManagementActivationLevel = 1,
): ManagementUseEvaluation {
  const useId = STRATEGY_CONTEXT_READINESS_USE;
  const gateResults: ReadinessGateResult[] = [];
  if (input.status !== undefined) {
    if (input.status === 'unavailable') {
      gateResults.push(gateResult(useId, 'G1', false, 0, 'strategy context unavailable — fail closed'));
    } else {
      // `blocked`/`available` are inspectable for diagnostics, but Strategy Context
      // is visibility-only in this slice (template selection stays disabled). The
      // gate passes (it is inspectable) yet caps at Level 1, so a caller that
      // requests a higher level — or future wiring — can never promote blocked
      // readiness past read-only diagnostic.
      gateResults.push(
        gateResult(useId, 'G1', true, 1, `strategy context inspectable but diagnostic visibility only (${input.status})`),
      );
    }
  }
  if (input.uiLabeled !== undefined) gateResults.push(uiLabelingGate(useId, input.uiLabeled));

  const use: ManagementSourceUse = {
    sourceId: STRATEGY_CONTEXT_SOURCE_ID,
    useId,
    requestedLevel,
    gateResults,
  };
  return {
    use,
    resolved: resolveManagementUseActivation(use, { requiredGates: STRATEGY_CONTEXT_REQUIRED_GATES }),
  };
}

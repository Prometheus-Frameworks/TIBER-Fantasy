/**
 * Management readiness gate evaluator (Phase 4 Slice 2) — diagnostic only.
 *
 * Implements proposed slice 2 of `docs/product/MANAGEMENT_PHASE4_ACTIVATION_PLAN.md`
 * ("Gate evaluator over existing services"): a pure, read-only mapping from
 * already-known Management source readiness signals (artifact/promoted status,
 * FORGE provenance, coverage, freshness, governed-vs-fixture, Strategy Context
 * status) into {@link ReadinessGateResult}s and a resolved activation, using the
 * Slice 1 model in `shared/managementActivation.ts`.
 *
 * Scope and guardrails (carried from the plan and the Slice 2 issue):
 *   - **Diagnostic only / not wired.** This module's output is NOT consumed by any
 *     UI, route, or runtime product behavior in this slice. It only translates
 *     status that callers already have into gate results for inspection/testing.
 *   - **Pure & read-only.** It performs no artifact reads, no I/O, and no network
 *     calls. Every input is a value the caller already computed elsewhere.
 *   - **Fail closed.** Missing/unknown signals never promote a source: a required
 *     gate with no input resolves to Level 0, unknown provenance is non-evidence,
 *     and fixture/ungoverned data cannot exceed read-only diagnostic.
 *   - **Levels attach to uses.** Each evaluator returns a {@link ManagementSourceUse}
 *     whose gate results are scoped to that use's id, so multiple uses of one
 *     source resolve independently (e.g. FORGE player-specific vs generated
 *     baseline are two uses of `forge_player_static_v1`).
 *   - **No contract/scoring/Team Direction/Strategy template changes.** The gate
 *     vocabulary reuses shipped status enums; it does not introduce new ones.
 *
 * Sources requiring new runtime artifact reads or integration plumbing are left
 * as documented future cases (see {@link FUTURE_EVALUATOR_CASES}) rather than
 * wired here.
 */
import {
  resolveManagementUseActivation,
  type ManagementActivationLevel,
  type ManagementSourceUse,
  type ReadinessGateId,
  type ReadinessGateResult,
  type ResolvedManagementUseActivation,
} from '@shared/managementActivation';
import type { ManagementStrategyContextStatus } from '@shared/managementStrategyContext';
import type { PromotedOperationalState } from '../externalModels/promotedModelStatusService';
import type {
  ForgePlayerStaticArtifactState,
  ForgePlayerStaticScoreSource,
} from '../externalModels/forge/forgePlayerStaticTypes';

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

/**
 * Future evaluator cases that need new runtime artifact reads / integration
 * plumbing and are intentionally NOT implemented in this slice. Documented here
 * so the omission is explicit rather than silent.
 */
export const FUTURE_EVALUATOR_CASES: readonly string[] = [
  'Point-prediction scenario outputs (requires reading promoted point-scenarios artifact)',
  'Player ownership / identity coverage accounting (requires crosswalk + identity map reads)',
  'Rookie Alpha fallback visibility (requires promoted rookie-alpha artifact reads)',
];

// --- gate-result helpers -----------------------------------------------------

function gateResult(
  use: string,
  gate: ReadinessGateId,
  passed: boolean,
  effectiveCap: ManagementActivationLevel | null,
  reason: string,
): ReadinessGateResult {
  return { gate, use, passed, effectiveCap, reason };
}

/** G1 from a FORGE static artifact state: only `available` clears availability. */
function forgeArtifactAvailabilityGate(use: string, state: ForgePlayerStaticArtifactState): ReadinessGateResult {
  if (state === 'available') return gateResult(use, 'G1', true, null, 'FORGE static artifact available');
  // Any non-available state fails closed to Level 0 — never fabricate presence.
  return gateResult(use, 'G1', false, 0, `FORGE static artifact not available (${state})`);
}

/** G1 from a promoted operational state: only `ready` clears availability. */
function promotedAvailabilityGate(use: string, state: PromotedOperationalState): ReadinessGateResult {
  if (state === 'ready') return gateResult(use, 'G1', true, null, 'promoted artifact ready');
  return gateResult(use, 'G1', false, 0, `promoted artifact not ready (${state})`);
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

/** G4 governed-vs-fixture: governed clears; fixture caps at Level 1; unknown fails closed. */
function governanceGate(use: string, governance: ManagementSourceGovernance): ReadinessGateResult {
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
function coverageGate(
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
function freshnessGate(use: string, fresh: boolean): ReadinessGateResult {
  return fresh
    ? gateResult(use, 'G6', true, null, 'data is fresh')
    : gateResult(use, 'G6', false, 1, 'data is stale — shown as stale, not current certainty');
}

/** G7 consumer fail-closed behavior: an unproven consumer cannot promote past Level 1. */
function consumerFailClosedGate(use: string, failClosed: boolean): ReadinessGateResult {
  return failClosed
    ? gateResult(use, 'G7', true, null, 'consumer degrades safely on malformed input')
    : gateResult(use, 'G7', false, 1, 'consumer fail-closed handling unproven');
}

/** G8 explicit UI labeling: hidden state caps at Level 1. */
function uiLabelingGate(use: string, labeled: boolean): ReadinessGateResult {
  return labeled
    ? gateResult(use, 'G8', true, null, 'level/provenance/coverage/freshness labeled at point of use')
    : gateResult(use, 'G8', false, 1, 'state not labeled — no label, no promotion');
}

/** G2 literal/version match: a contract mismatch is unsupported and fails closed. */
function contractMatchGate(use: string, matches: boolean): ReadinessGateResult {
  return matches
    ? gateResult(use, 'G2', true, null, 'artifact_type / schema_version / model_version match the pinned contract')
    : gateResult(use, 'G2', false, 0, 'contract mismatch — unsupported, fail closed');
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

// --- Teamstate movement evaluator -------------------------------------------

export interface TeamstateMovementGateInput {
  promotedStatus?: PromotedOperationalState;
  governance?: ManagementSourceGovernance;
  fresh?: boolean;
  uiLabeled?: boolean;
}

const TEAMSTATE_MOVEMENT_REQUIRED_GATES: readonly ReadinessGateId[] = ['G1', 'G4', 'G6'];

/**
 * Case 4: Teamstate movement v1 as read-only supporting context (Level 2
 * ceiling). Gated only on status/governance/freshness inputs the caller already
 * has — no artifact read. Fixture-backed data caps at Level 1 (G4); a non-ready
 * promoted status fails closed (G1).
 */
export function evaluateTeamstateMovementSupportingContext(
  input: TeamstateMovementGateInput,
  requestedLevel: ManagementActivationLevel = 2,
): ManagementUseEvaluation {
  const useId = TEAMSTATE_MOVEMENT_SUPPORTING_USE;
  const gateResults: ReadinessGateResult[] = [];
  if (input.promotedStatus !== undefined) gateResults.push(promotedAvailabilityGate(useId, input.promotedStatus));
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

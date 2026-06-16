/**
 * Strategy Context activation diagnostics (Phase 4 Slice 3) — visibility only.
 *
 * Implements proposed slice 3 of `docs/product/MANAGEMENT_PHASE4_ACTIVATION_PLAN.md`
 * ("Strategy Context readiness → Level 2 (visibility only)"): surface the
 * read-only readiness/gate state of the Management Strategy Context, derived from
 * the Slice 1 model and the Slice 2 evaluator, without activating anything.
 *
 * Strictly diagnostic / non-prescriptive:
 *   - Reuses the existing Strategy Context normalization path
 *     ({@link normalizeManagementStrategyContext}) so malformed/unsafe input fails
 *     closed exactly as it does today.
 *   - Reuses {@link evaluateStrategyContextReadiness} from the Slice 2 evaluator;
 *     in this slice inspectable statuses cap at read-only diagnostic visibility
 *     (Level 1) and `unavailable`/missing data fails closed to Level 0.
 *   - Never selects, renders, interpolates, or activates a Strategy template:
 *     `templateSelectionEnabled` is always `false` and `selectedTemplateId` is
 *     always `null`. No template body/content is read or exposed.
 *   - Does not influence Team Direction, scoring, rankings, recommendations,
 *     roster actions, or advice. It only explains why the context is unavailable,
 *     blocked, or inspectable.
 *   - Performs no artifact reads and no I/O; governed/readiness status is never
 *     inferred from missing data.
 */
import type {
  ManagementActivatableLevel,
  ManagementActivationCap,
  ManagementActivationLevel,
  ReadinessGateId,
  ReadinessGateResult,
} from '@shared/managementActivation';
import {
  normalizeManagementStrategyContext,
  type ManagementStrategyContextBlockedReason,
  type ManagementStrategyContextStatus,
} from '@shared/managementStrategyContext';
import { evaluateStrategyContextReadiness } from './managementGateEvaluator';

/**
 * Read-only diagnostic summary of Strategy Context activation readiness. Additive
 * shape only — it is attached alongside existing fields and changes no existing
 * behavior.
 */
export interface StrategyContextActivationDiagnostics {
  /** Explicit markers that this payload is diagnostic and never prescriptive. */
  diagnostic: true;
  readOnly: true;
  /** The normalized Strategy Context status, or `null` when no data is present. */
  status: ManagementStrategyContextStatus | null;
  /** Whether the context is inspectable for diagnostics (blocked/available). */
  inspectable: boolean;
  /** Source/use identity from the gate evaluator. */
  sourceId: string;
  useId: string;
  /** The level requested for this diagnostic read and the level actually allowed. */
  requestedLevel: ManagementActivationLevel;
  effectiveLevel: ManagementActivatableLevel;
  /** `true` when the effective level was demoted below the requested level. */
  capped: boolean;
  /** Gates that failed (including required gates whose data was missing). */
  failedGates: ReadinessGateId[];
  /** Caps applied during resolution, with the gate and reason that imposed each. */
  caps: ManagementActivationCap[];
  /** Per-gate results behind the resolution. */
  gateResults: ReadinessGateResult[];
  /** Why the context is unavailable / blocked / inspectable. */
  blockedReasons: ManagementStrategyContextBlockedReason[];
  /** Missing template inputs reported by the read-only context. */
  missingInputs: string[];
  /** Hard invariants — templates are never activated in this slice. */
  templateSelectionEnabled: false;
  selectedTemplateId: null;
  /** Human-readable explanation of the readiness state. */
  explanation: string;
}

function explainReadiness(
  status: ManagementStrategyContextStatus | null,
  effectiveLevel: ManagementActivatableLevel,
  failedGates: readonly ReadinessGateId[],
): string {
  switch (status) {
    case 'blocked':
      return `Strategy Context is inspectable but deferred: shown as read-only diagnostic visibility (Level ${effectiveLevel}). Template selection remains disabled; no template is selected, rendered, or interpolated.`;
    case 'available':
      return `Strategy Context status 'available' is reserved for a future activation phase; in this slice it is shown as diagnostic visibility only (Level ${effectiveLevel}). Template selection remains disabled.`;
    case 'unavailable':
      return `Strategy Context is unavailable and fails closed to Level ${effectiveLevel}. It is shown as unavailable, never inferred as present. Template selection remains disabled.`;
    default:
      return `Strategy Context readiness data is missing (failed gates: ${failedGates.join(', ') || 'none'}); fails closed to Level ${effectiveLevel}. Missing data is never inferred as present.`;
  }
}

/**
 * Build the read-only Strategy Context activation diagnostics from any
 * (possibly partial / malformed / untrusted) Strategy Context value. The value
 * is normalized through the existing Strategy Context normalizer first, so unsafe
 * input fails closed identically to the rest of the Management path.
 *
 * @param value A Management Strategy Context (or anything coercible / `null`).
 * @param requestedLevel The diagnostic ceiling to request (defaults to the
 *   Strategy Context Phase 4 ceiling, Level 2); the evaluator caps it down to the
 *   level its gates currently permit (Level 1 visibility in this slice).
 */
export function buildStrategyContextActivationDiagnostics(
  value: unknown,
  requestedLevel: ManagementActivationLevel = 2,
): StrategyContextActivationDiagnostics {
  const context = normalizeManagementStrategyContext(value);
  const status: ManagementStrategyContextStatus | null = context?.status ?? null;

  // Missing data → omit status so the required gate fails closed; never infer.
  const { use, resolved } = evaluateStrategyContextReadiness(
    status === null ? { uiLabeled: true } : { status, uiLabeled: true },
    requestedLevel,
  );

  return {
    diagnostic: true,
    readOnly: true,
    status,
    inspectable: status === 'blocked' || status === 'available',
    sourceId: use.sourceId,
    useId: use.useId,
    requestedLevel: resolved.requestedLevel,
    effectiveLevel: resolved.effectiveLevel,
    capped: resolved.capped,
    failedGates: resolved.failedGates,
    caps: resolved.caps,
    gateResults: [...use.gateResults],
    blockedReasons: context?.blocked_reasons ?? [],
    missingInputs: context?.missing_inputs ?? [],
    // Hard invariants — never trust input to enable activation.
    templateSelectionEnabled: false,
    selectedTemplateId: null,
    explanation: explainReadiness(status, resolved.effectiveLevel, resolved.failedGates),
  };
}

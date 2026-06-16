/**
 * Management activation-level and readiness-gate data model (types only).
 *
 * This module is the typed expression of the Phase 4 activation contract defined
 * in `docs/product/MANAGEMENT_PHASE4_ACTIVATION_PLAN.md`:
 *   - Section 1 ("Activation levels") → {@link ManagementActivationLevel} and the
 *     level metadata below.
 *   - Section 2 ("Readiness gates") → {@link ReadinessGateId} and
 *     {@link ReadinessGateResult}.
 *
 * Phase 4 Slice 1 (plan Section 5, item 1) is intentionally *types only*. Nothing
 * here reads, evaluates, or promotes a real artifact; no surface consumes it yet.
 * The functions in this file are pure resolvers over already-computed gate
 * results so the model can be unit tested before any evaluator is built.
 *
 * Load-bearing invariants carried from the plan and enforced by this model:
 *   - Levels attach to *uses*, not raw sources: a single source can power several
 *     uses at different levels, so the resolver evaluates a {@link ManagementSourceUse}
 *     and never collapses a multi-use source to one level (plan Section 1).
 *   - Gates are conjunctive: a use's effective level is the *minimum* of what each
 *     gate permits (plan Section 2, "Gate principles").
 *   - Fail-closed, never fail-open: a failed or missing gate result can only cap
 *     (demote) a level, never raise it. Missing data is never evidence
 *     (plan Section 2). Absence cannot promote a source.
 *   - Level 4 (recommendation / advice) is explicitly out of scope: it exists
 *     only as a declared value and is never a resolvable / enabled state
 *     (plan Section 1, "Rules that bind the ladder").
 */

/**
 * Management activation levels 0–4 (plan Section 1).
 *
 * The level is a property of *how a source is allowed to influence a surface*,
 * not a measure of how good the underlying data is.
 *
 * - `0` unavailable / ignored
 * - `1` read-only diagnostic
 * - `2` eligible supporting context
 * - `3` active but non-prescriptive Management evidence
 * - `4` recommendation / advice layer — explicitly OUT OF SCOPE for Phase 4
 */
export type ManagementActivationLevel = 0 | 1 | 2 | 3 | 4;

/** All declared activation levels, in ascending order. */
export const MANAGEMENT_ACTIVATION_LEVELS: readonly ManagementActivationLevel[] = [0, 1, 2, 3, 4];

/**
 * Highest level a source/use may ever *reach* in Phase 4. Level 4 is declared
 * (so the ladder is complete) but is never an enabled/resolvable state; reaching
 * it requires a separate, explicitly named later gate and issue.
 */
export const MANAGEMENT_MAX_ACTIVATABLE_LEVEL: ManagementActivationLevel = 3;

/** The single out-of-scope advice level. Declared, never enabled. */
export const MANAGEMENT_OUT_OF_SCOPE_LEVEL: ManagementActivationLevel = 4;

export interface ManagementActivationLevelMeta {
  level: ManagementActivationLevel;
  /** Stable machine identifier for the level. */
  id: 'unavailable' | 'read_only_diagnostic' | 'eligible_supporting_context' | 'active_non_prescriptive_evidence' | 'recommendation_advice';
  /** Human-readable name from the plan. */
  name: string;
  /**
   * `true` only for Level 4. An out-of-scope level may be *named* but never
   * resolved to as an effective level.
   */
  outOfScope: boolean;
}

/**
 * Ordered metadata for every level (plan Section 1 table). The array order is the
 * canonical level ordering, so index === level.
 */
export const MANAGEMENT_ACTIVATION_LEVEL_META: readonly ManagementActivationLevelMeta[] = [
  { level: 0, id: 'unavailable', name: 'Unavailable / ignored', outOfScope: false },
  { level: 1, id: 'read_only_diagnostic', name: 'Read-only diagnostic', outOfScope: false },
  { level: 2, id: 'eligible_supporting_context', name: 'Eligible supporting context', outOfScope: false },
  { level: 3, id: 'active_non_prescriptive_evidence', name: 'Active but non-prescriptive Management evidence', outOfScope: false },
  { level: 4, id: 'recommendation_advice', name: 'Recommendation / advice layer', outOfScope: true },
];

/**
 * Readiness gate identifiers G1–G8 (plan Section 2). A source may sit at a given
 * level only while it passes every gate required for that level.
 */
export type ReadinessGateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8';

/** All readiness gate ids, in canonical order. */
export const READINESS_GATE_IDS: readonly ReadinessGateId[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'];

export interface ReadinessGateMeta {
  id: ReadinessGateId;
  /** Short name from the plan table. */
  name: string;
  /** The question the gate answers. */
  question: string;
}

/** Descriptive metadata for each gate (plan Section 2 table). */
export const READINESS_GATE_META: readonly ReadinessGateMeta[] = [
  { id: 'G1', name: 'Artifact availability', question: 'Does the promoted artifact exist and load?' },
  { id: 'G2', name: 'Literal / version match', question: 'Do artifact_type, schema_version, and model_version match the pinned contract?' },
  { id: 'G3', name: 'Provenance status', question: 'Is each row\'s provenance the evidence-bearing kind?' },
  { id: 'G4', name: 'Fixture vs governed status', question: 'Is the data a governed promoted artifact or a fixture/seed?' },
  { id: 'G5', name: 'Coverage completeness', question: 'What fraction of the active-team roster does the source cover?' },
  { id: 'G6', name: 'Stale / missing state', question: 'Is generated_at fresh enough, and is the row present at all?' },
  { id: 'G7', name: 'Consumer fail-closed behavior', question: 'Does the consumer degrade safely on malformed/forged/partial input?' },
  { id: 'G8', name: 'Explicit UI labeling', question: 'Is the source\'s level, provenance, coverage, and freshness visible at the point of use?' },
];

/**
 * The result of evaluating one readiness gate for one source/use (plan Section 2).
 *
 * `effectiveCap` records the highest level this gate permits *when it constrains*:
 *   - A failed gate caps the use (e.g. G1 failure → Level 0; G3 non-evidence
 *     provenance → Level 1–2). When a failure provides no explicit cap, the model
 *     fails closed to Level 0.
 *   - A *passed* gate may still cap (e.g. G5 coverage below threshold passes
 *     availability but caps confidence at a visibility level). A passed gate with
 *     `effectiveCap: null` imposes no constraint.
 */
export interface ReadinessGateResult {
  /** Which gate produced this result. */
  gate: ReadinessGateId;
  /**
   * The source/use this result belongs to. Levels attach to uses, so a gate
   * result is always scoped to a use identifier, never a bare source.
   */
  use: string;
  /** Whether the gate passed. */
  passed: boolean;
  /**
   * Highest level this gate permits when it constrains the use, or `null` for a
   * passing gate that imposes no cap. Never higher than
   * {@link MANAGEMENT_MAX_ACTIVATABLE_LEVEL}.
   */
  effectiveCap: ManagementActivationLevel | null;
  /** Human-readable reason / message explaining the result and any cap. */
  reason: string;
}

/**
 * A single *use* of a source (plan Section 1, "Levels attach to uses").
 *
 * The same `sourceId` may appear in multiple uses (different `useId`s) at
 * different requested levels — e.g. FORGE player-specific evidence *drives* the
 * Team Direction classification at Level 3 while *feeding coverage counts* at
 * Level 2. Each use is gated and resolved independently.
 */
export interface ManagementSourceUse {
  /** The raw source backing this use (e.g. `forge_player_static_v1`). */
  sourceId: string;
  /** The specific use of the source (e.g. `team_direction_classification`). */
  useId: string;
  /** The level this use aspires to if all of its gates pass (its ceiling). */
  requestedLevel: ManagementActivationLevel;
  /** Gate results gathered for this use. */
  gateResults: readonly ReadinessGateResult[];
}

/** A cap applied to a use, with the gate and reason that imposed it. */
export interface ManagementActivationCap {
  gate: ReadinessGateId;
  cap: ManagementActivationLevel;
  reason: string;
}

/**
 * The resolved activation for one use after applying every gate result. The
 * effective level is the minimum of the requested level and all gate caps, and is
 * never the out-of-scope Level 4.
 */
export interface ResolvedManagementUseActivation {
  sourceId: string;
  useId: string;
  requestedLevel: ManagementActivationLevel;
  effectiveLevel: ManagementActivationLevel;
  /** `true` when the effective level was demoted below the requested level. */
  capped: boolean;
  /** Gates that failed (including required gates whose result was missing). */
  failedGates: ReadinessGateId[];
  /** Every cap that was applied, in the order encountered. */
  caps: ManagementActivationCap[];
}

export interface ResolveUseActivationOptions {
  /**
   * Gates that MUST be present and passing for this use. A required gate whose
   * result is missing is treated as a fail-closed cap to Level 0 — missing gate
   * data can never promote a source (plan Section 2, "Missing data is never
   * evidence").
   */
  requiredGates?: readonly ReadinessGateId[];
}

/** Whether a level is a real, enabled (resolvable) activation state. */
export function isActivatableLevel(level: ManagementActivationLevel): boolean {
  return level >= 0 && level <= MANAGEMENT_MAX_ACTIVATABLE_LEVEL;
}

/** Whether a level is declared but explicitly out of scope (only Level 4). */
export function isOutOfScopeLevel(level: ManagementActivationLevel): boolean {
  return level === MANAGEMENT_OUT_OF_SCOPE_LEVEL;
}

/**
 * Negative for `a < b`, positive for `a > b`, zero when equal. Levels order by
 * their numeric value, which is the canonical Phase 4 ordering.
 */
export function compareActivationLevels(a: ManagementActivationLevel, b: ManagementActivationLevel): number {
  return a - b;
}

/** Clamp any number into the activatable range [0, MANAGEMENT_MAX_ACTIVATABLE_LEVEL]. */
function clampToActivatable(level: number): ManagementActivationLevel {
  if (!Number.isFinite(level)) return 0;
  const clamped = Math.max(0, Math.min(MANAGEMENT_MAX_ACTIVATABLE_LEVEL, Math.trunc(level)));
  return clamped as ManagementActivationLevel;
}

/**
 * Resolve the effective activation level for a single use by applying every gate
 * result conjunctively (plan Section 2).
 *
 * Fail-closed rules enforced here:
 *   - The effective level is the minimum of the requested level and every cap.
 *   - A failed gate caps at its `effectiveCap`, or Level 0 when none is given.
 *   - A passed gate may still cap (e.g. coverage below threshold).
 *   - A required gate with no result caps at Level 0 — absence cannot promote.
 *   - The result is always clamped to the activatable range, so it can never be
 *     the out-of-scope Level 4 regardless of the requested level.
 */
export function resolveManagementUseActivation(
  use: ManagementSourceUse,
  options: ResolveUseActivationOptions = {},
): ResolvedManagementUseActivation {
  const requestedLevel = clampToActivatable(use.requestedLevel);
  const caps: ManagementActivationCap[] = [];
  const failedGates: ReadinessGateId[] = [];

  let effectiveLevel: ManagementActivationLevel = requestedLevel;
  const applyCap = (gate: ReadinessGateId, rawCap: number, reason: string): void => {
    const cap = clampToActivatable(rawCap);
    caps.push({ gate, cap, reason });
    if (compareActivationLevels(cap, effectiveLevel) < 0) {
      effectiveLevel = cap;
    }
  };

  const seenGates = new Set<ReadinessGateId>();
  for (const result of use.gateResults ?? []) {
    seenGates.add(result.gate);
    if (!result.passed) {
      failedGates.push(result.gate);
      // A failure caps; missing/explicitly-null cap fails closed to Level 0.
      applyCap(result.gate, result.effectiveCap ?? 0, result.reason);
    } else if (result.effectiveCap !== null && result.effectiveCap !== undefined) {
      // A passing gate that still constrains the level (e.g. coverage threshold).
      applyCap(result.gate, result.effectiveCap, result.reason);
    }
  }

  // Required gates with no result can never promote a source: fail closed.
  for (const required of options.requiredGates ?? []) {
    if (!seenGates.has(required)) {
      failedGates.push(required);
      applyCap(required, 0, 'required gate result missing — fail closed');
    }
  }

  return {
    sourceId: use.sourceId,
    useId: use.useId,
    requestedLevel,
    effectiveLevel,
    capped: compareActivationLevels(effectiveLevel, requestedLevel) < 0,
    failedGates,
    caps,
  };
}

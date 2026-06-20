/**
 * Shared promotion-gate evaluator (Phase 4 #249 PR 1) — pure, diagnostic only.
 *
 * Defines the explicit contract an external lab source must satisfy before a
 * readiness builder may move it from Level 1 (read-only diagnostic) to Level 2
 * (supporting context). This module ONLY decides `promotable` from already-known,
 * caller-supplied signals — it performs no I/O, no artifact reads, and wires
 * nothing. No source is promoted by importing it; source-specific builders must
 * opt in later, and only once their upstream metadata can satisfy this gate.
 *
 * Promotion requires ALL of:
 *   1. governanceStatus === 'governed'
 *   2. governanceSource === 'explicit_marker'   (a `/promoted/` path is only a hint)
 *   3. contractMatch === true                   (explicit dataset-level literal match)
 *   4. freshnessStatus === 'fresh'
 *   5. freshnessScope === 'dataset'             (row-level freshness is not enough)
 *
 * Anything else returns `promotable: false` with explicit, deterministic blockers.
 */

/** Explicit governance claim. `governed` is never inferred from a path alone. */
export type PromotionGovernanceStatus = 'governed' | 'fixture' | 'ungoverned' | 'unknown';

/** Where the governance signal came from. Only `explicit_marker` can promote. */
export type PromotionGovernanceSource = 'explicit_marker' | 'path_hint' | 'missing';

/** Freshness status (mirrors ArtifactFreshnessStatus values; kept local so this module stays client-safe). */
export type PromotionFreshnessStatus = 'fresh' | 'warning' | 'stale' | 'unknown';

/** Scope of the freshness signal. Only `dataset` can promote. */
export type PromotionFreshnessScope = 'dataset' | 'row_level' | 'none';

/** Deterministic blocker identifiers surfaced when a source cannot be promoted. */
export type PromotionGateBlocker =
  | 'governance_marker_missing'
  | 'governance_not_governed'
  | 'governance_path_hint_only'
  | 'contract_literal_missing'
  | 'contract_mismatch'
  | 'dataset_freshness_missing'
  | 'dataset_freshness_not_fresh'
  | 'dataset_freshness_scope_not_dataset';

export interface PromotionGateInput {
  governanceStatus: PromotionGovernanceStatus;
  governanceSource: PromotionGovernanceSource;
  /** Whether the explicit dataset-level contract literal matched the pinned expectation. */
  contractMatch: boolean;
  /** The pinned contract literal the consumer requires (for UI + missing-vs-mismatch). */
  contractExpected?: string | null;
  /** The dataset-level contract literal actually observed (null = none surfaced). */
  contractObserved?: string | null;
  freshnessStatus: PromotionFreshnessStatus;
  freshnessScope: PromotionFreshnessScope;
  freshnessAgeDays?: number | null;
  freshnessTimestamp?: string | null;
}

export interface PromotionReadiness {
  promotable: boolean;
  governanceStatus: PromotionGovernanceStatus;
  governanceSource: PromotionGovernanceSource;
  contractMatch: boolean;
  contractExpected: string | null;
  contractObserved: string | null;
  freshnessStatus: PromotionFreshnessStatus;
  freshnessScope: PromotionFreshnessScope;
  freshnessAgeDays: number | null;
  freshnessTimestamp: string | null;
  blockers: PromotionGateBlocker[];
  /** UI-ready detail strings; safe to render directly. */
  details: string[];
}

function governanceBlocker(
  status: PromotionGovernanceStatus,
  source: PromotionGovernanceSource,
): PromotionGateBlocker | null {
  if (status === 'governed' && source === 'explicit_marker') return null;
  if (source === 'missing') return 'governance_marker_missing';
  // A `/promoted/` (or similar) path is only a weak hint, never sufficient alone.
  if (source === 'path_hint') return 'governance_path_hint_only';
  // An explicit marker is present but it does not assert governed status.
  return 'governance_not_governed';
}

function contractBlocker(input: PromotionGateInput): PromotionGateBlocker | null {
  if (input.contractMatch) return null;
  const observed = input.contractObserved ?? null;
  // No dataset-level literal surfaced at all → missing; otherwise it mismatched.
  return observed === null || observed === '' ? 'contract_literal_missing' : 'contract_mismatch';
}

function freshnessBlocker(
  status: PromotionFreshnessStatus,
  scope: PromotionFreshnessScope,
): PromotionGateBlocker | null {
  if (status === 'fresh' && scope === 'dataset') return null;
  if (scope === 'none') return 'dataset_freshness_missing';
  if (scope === 'row_level') return 'dataset_freshness_scope_not_dataset';
  // scope === 'dataset' but status is warning/stale/unknown.
  return 'dataset_freshness_not_fresh';
}

/**
 * Evaluate the explicit promotion gate. Pure: returns a normalized
 * {@link PromotionReadiness} with `promotable` and deterministic `blockers`.
 */
export function evaluatePromotionGate(input: PromotionGateInput): PromotionReadiness {
  const contractExpected = input.contractExpected ?? null;
  const contractObserved = input.contractObserved ?? null;
  const freshnessAgeDays = input.freshnessAgeDays ?? null;
  const freshnessTimestamp = input.freshnessTimestamp ?? null;

  const blockers: PromotionGateBlocker[] = [];
  const governance = governanceBlocker(input.governanceStatus, input.governanceSource);
  if (governance) blockers.push(governance);
  const contract = contractBlocker(input);
  if (contract) blockers.push(contract);
  const freshness = freshnessBlocker(input.freshnessStatus, input.freshnessScope);
  if (freshness) blockers.push(freshness);

  const promotable = blockers.length === 0;

  const details = [
    `Promotable: ${promotable ? 'yes' : 'no'}.`,
    `Governance: ${input.governanceStatus} (source: ${input.governanceSource}).`,
    `Contract match: ${input.contractMatch ? 'yes' : 'no'}${contractObserved ? ` (observed: ${contractObserved}` + (contractExpected ? `, expected: ${contractExpected})` : ')') : ''}.`,
    `Freshness: ${input.freshnessStatus} (scope: ${input.freshnessScope}${freshnessAgeDays != null ? `, age ${freshnessAgeDays}d` : ''}).`,
    `Blockers: ${blockers.length ? blockers.join(', ') : 'none'}.`,
    promotable
      ? 'Promotion gate satisfied: source is eligible for Level 2 supporting context.'
      : 'Level 2 deferred: promotion gate not satisfied (shown as read-only diagnostic only).',
  ];

  return {
    promotable,
    governanceStatus: input.governanceStatus,
    governanceSource: input.governanceSource,
    contractMatch: input.contractMatch,
    contractExpected,
    contractObserved,
    freshnessStatus: input.freshnessStatus,
    freshnessScope: input.freshnessScope,
    freshnessAgeDays,
    freshnessTimestamp,
    blockers,
    details,
  };
}

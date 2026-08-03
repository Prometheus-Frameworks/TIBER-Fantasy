/**
 * FORGE evidence activation diagnostics (Phase 4 Slice 4 + W6 G6 enforcement).
 *
 * Implements proposed slice 4 of `docs/product/MANAGEMENT_PHASE4_ACTIVATION_PLAN.md`
 * ("FORGE player-specific evidence — formalize at Level 3 + add citation"). It
 * maps the FORGE diagnostics the Management route already has (artifact status,
 * provenance/score_source counts, coverage, freshness) into the Slice 1 model via
 * the Slice 2 evaluator, and emits read-only citation/activation metadata for two
 * distinct uses of one source:
 *   - FORGE player-specific evidence behind the Team Direction read (Level 3).
 *   - FORGE generated-baseline visibility (capped at Level 1).
 *
 * W6 keeps this output diagnostic/read-only, but its G6 and G7 gates now cite
 * the same request-time receipt that the classifier enforces:
 *   - It performs no artifact reads and no I/O; it only re-reads diagnostics the
 *     caller already computed.
 *   - Generated baselines stay visibility-only and never count as FORGE scoring,
 *     coverage, evidence, or confidence.
 *   - Unknown/fallback provenance is non-evidence; missing artifact/status fails
 *     closed; governed status is never inferred from missing data.
 *   - It emits no advice/recommendation language.
 */
import type {
  ManagementActivatableLevel,
  ManagementActivationCap,
  ManagementActivationLevel,
  ReadinessGateId,
  ReadinessGateResult,
} from '@shared/managementActivation';
import type {
  ForgePlayerStaticArtifactState,
  ForgePlayerStaticScoreSource,
} from '../externalModels/forge/forgePlayerStaticTypes';
import {
  isAcceptedTeamDirectionForgeFreshnessReceipt,
  type TeamDirectionForgeFreshnessReceiptV1,
} from './forgeTeamDirectionFreshnessPolicy';
import {
  evaluateForgeGeneratedBaselineVisibility,
  evaluateForgePlayerSpecificTeamDirection,
  type ForgeStaticGateInput,
  type ManagementSourceGovernance,
} from './managementGateEvaluator';

/** Default Team Direction documented coverage gate (≥ 50% player-specific). */
const DEFAULT_COVERAGE_MINIMUM_RATE = 0.5;

/** The pinned FORGE static contract/version this consumer expects (gate G2). */
const EXPECTED_FORGE_CONTRACT_VERSION = 'forge_player_static_v1';

/**
 * Stable path suffix of the bundled, deploy-safe FORGE snapshot. Per the FORGE
 * adapter README this file is a *pinned promoted* TIBER-FORGE snapshot (governed),
 * packaged for hosts (e.g. Railway) without a sibling `TIBER-FORGE` checkout — not
 * a fixture. The client falls back to it when no env override / promoted export is
 * configured, so governance must recognize it as governed.
 */
const BUNDLED_PROMOTED_FORGE_SNAPSHOT_SUFFIX = 'server/artifacts/external/forge/forge_player_static_v1.json';

/** A FORGE source path is governed when it is a promoted export or the bundled promoted snapshot. */
function isGovernedForgeSourcePath(sourcePath: string): boolean {
  const normalized = sourcePath.replace(/\\/g, '/');
  // Sibling promoted export, or an env override pointing at a promoted export.
  if (normalized.includes('/promoted/')) return true;
  // Bundled, pinned promoted deploy-safe snapshot.
  return normalized.endsWith(BUNDLED_PROMOTED_FORGE_SNAPSHOT_SUFFIX);
}

const KNOWN_ARTIFACT_STATES: readonly ForgePlayerStaticArtifactState[] = [
  'available',
  'missing',
  'malformed',
  'duplicate_ids',
  'unsupported',
  'disabled',
];

/** The FORGE diagnostics subset this builder consumes (already on the route payload). */
export interface ForgeEvidenceActivationInput {
  forgeArtifact?: {
    state?: string | null;
    available?: boolean | null;
    sourcePath?: string | null;
    generatedAt?: string | null;
    freshness?: { status?: string | null } | null;
    contractVersion?: string | null;
    playerSpecificCount?: number | null;
    generatedBaselineCount?: number | null;
  } | null;
  rosterMatching?: {
    playerSpecificRosterMatches?: number | null;
    generatedBaselineRosterMatches?: number | null;
    rosterCanonicalIdsChecked?: number | null;
    rosterCanonicalIdsMatched?: number | null;
  } | null;
  /** Player-specific FORGE coverage from the classifier result (already computed). */
  forgeCoverage?: { matched?: number | null; total?: number | null; rate?: number | null } | null;
  /** The exact request-time G6 receipt consumed by the classifier. */
  freshnessReceipt?: TeamDirectionForgeFreshnessReceiptV1 | null;
  /** True only when the caller passed this same receipt into the classifier. */
  classifierFreshnessEnforced?: boolean;
}

/** Read-only activation/citation metadata for one FORGE use. */
export interface ForgeUseActivationCitation {
  sourceId: string;
  useId: string;
  /** Provenance the use was evaluated under (player-specific vs generated baseline). */
  scoreSource: ForgePlayerStaticScoreSource | null;
  requestedLevel: ManagementActivationLevel;
  effectiveLevel: ManagementActivatableLevel;
  capped: boolean;
  failedGates: ReadinessGateId[];
  caps: ManagementActivationCap[];
  gateResults: ReadinessGateResult[];
  explanation: string;
}

export interface ForgeEvidenceActivationDiagnostics {
  diagnostic: true;
  readOnly: true;
  /** FORGE player-specific evidence cited behind the Team Direction read (Level 3). */
  playerSpecific: ForgeUseActivationCitation;
  /** FORGE generated-baseline visibility-only use (Level 1 cap). */
  generatedBaseline: ForgeUseActivationCitation;
  /** Provenance / score_source summary from the existing diagnostics. */
  provenanceSummary: {
    artifactState: ForgePlayerStaticArtifactState | null;
    playerSpecificMatches: number | null;
    generatedBaselineMatches: number | null;
    playerSpecificCount: number | null;
    generatedBaselineCount: number | null;
  };
  /** Coverage counts carried from the existing diagnostics (unchanged). */
  coverage: { matched: number | null; total: number | null; rate: number | null } | null;
  /** Full W6 receipt retained for backend/operator inspection. */
  freshnessReceipt: TeamDirectionForgeFreshnessReceiptV1 | null;
  explanation: string;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function deriveArtifactState(
  forgeArtifact: ForgeEvidenceActivationInput['forgeArtifact'],
): ForgePlayerStaticArtifactState | undefined {
  const state = forgeArtifact?.state;
  if (typeof state === 'string' && (KNOWN_ARTIFACT_STATES as readonly string[]).includes(state)) {
    return state as ForgePlayerStaticArtifactState;
  }
  if (forgeArtifact?.available === true) return 'available';
  if (forgeArtifact?.available === false) return 'missing';
  return undefined;
}

function derivePlayerSpecificScoreSource(
  rosterMatching: ForgeEvidenceActivationInput['rosterMatching'],
): ForgePlayerStaticScoreSource | undefined {
  if (!rosterMatching) return undefined;
  const playerSpecific = finiteOrNull(rosterMatching.playerSpecificRosterMatches);
  const generatedBaseline = finiteOrNull(rosterMatching.generatedBaselineRosterMatches);
  if (playerSpecific !== null && playerSpecific > 0) return 'player_specific';
  if (generatedBaseline !== null && generatedBaseline > 0) return 'generated_baseline';
  // Matching data present but no evidence rows: non-evidence, fail closed.
  return 'unknown';
}

/**
 * The generated-baseline use is only evidence when generated-baseline rows
 * actually exist in the diagnostics. With zero matches/counts it is non-evidence
 * (`unknown`, → Level 0); with no diagnostics at all it is omitted (→ fail closed).
 * Visibility is never inferred from artifact availability alone.
 */
function deriveGeneratedBaselineScoreSource(
  input: ForgeEvidenceActivationInput,
): ForgePlayerStaticScoreSource | undefined {
  const matches = finiteOrNull(input.rosterMatching?.generatedBaselineRosterMatches);
  const count = finiteOrNull(input.forgeArtifact?.generatedBaselineCount);
  if ((matches !== null && matches > 0) || (count !== null && count > 0)) return 'generated_baseline';
  // Diagnostics present but no generated-baseline rows → non-evidence.
  if (input.rosterMatching || input.forgeArtifact) return 'unknown';
  return undefined;
}

/**
 * G2 contract/version match: passes only when the FORGE static artifact reports
 * the pinned contract version. A missing/unknown/wrong version fails closed; with
 * no artifact data at all the gate is omitted (and fails closed as a required gate).
 */
function deriveContractMatch(
  forgeArtifact: ForgeEvidenceActivationInput['forgeArtifact'],
  artifactState: ForgePlayerStaticArtifactState | undefined,
): boolean | undefined {
  if (artifactState === undefined) return undefined;
  const version = forgeArtifact?.contractVersion;
  if (typeof version !== 'string' || version.trim().length === 0) return false;
  return version.trim().toLowerCase() === EXPECTED_FORGE_CONTRACT_VERSION;
}

function deriveGovernance(
  forgeArtifact: ForgeEvidenceActivationInput['forgeArtifact'],
  artifactState: ForgePlayerStaticArtifactState | undefined,
): ManagementSourceGovernance | undefined {
  if (artifactState !== 'available') return undefined;
  const path = forgeArtifact?.sourcePath;
  if (typeof path !== 'string' || path.length === 0) return 'unknown';
  // Governed status is read from the promoted-artifact boundary (a promoted export
  // or the bundled pinned promoted snapshot), never inferred from missing data.
  if (isGovernedForgeSourcePath(path)) return 'governed';
  return 'fixture';
}

function deriveFreshness(
  receipt: TeamDirectionForgeFreshnessReceiptV1 | null | undefined,
): boolean | undefined {
  if (!receipt) return undefined;
  return isAcceptedTeamDirectionForgeFreshnessReceipt(receipt);
}

function explainUse(
  label: string,
  effectiveLevel: ManagementActivatableLevel,
  targetLevel: number,
  failedGates: readonly ReadinessGateId[],
): string {
  if (effectiveLevel >= targetLevel) {
    return label === 'player_specific'
      ? `FORGE player-specific evidence is cited as active, non-prescriptive Management evidence (Level ${effectiveLevel}) behind the existing read-only Team Direction classification.`
      : `FORGE generated baselines are shown as visibility-only context (Level ${effectiveLevel}); they never count as FORGE scoring, coverage, evidence, or confidence.`;
  }
  const reason = failedGates.length ? `failed/missing gates: ${failedGates.join(', ')}` : 'readiness inputs incomplete';
  return label === 'player_specific'
    ? `FORGE player-specific evidence is not currently citable at Level ${targetLevel} (effective Level ${effectiveLevel}; ${reason}). It does not influence the Team Direction classification.`
    : `No FORGE generated-baseline visibility is shown (effective Level ${effectiveLevel}; ${reason}); generated baselines never count as FORGE scoring, coverage, evidence, or confidence.`;
}

/**
 * Build read-only FORGE evidence activation/citation diagnostics from the same
 * W6 receipt enforced by the classifier. This function does not make a second
 * clock decision and cannot override the classifier.
 */
export function buildForgeEvidenceActivationDiagnostics(
  input: ForgeEvidenceActivationInput | null | undefined,
  options: { coverageMinimumRate?: number } = {},
): ForgeEvidenceActivationDiagnostics {
  const minimumRate = options.coverageMinimumRate ?? DEFAULT_COVERAGE_MINIMUM_RATE;
  const forgeArtifact = input?.forgeArtifact ?? null;
  const rosterMatching = input?.rosterMatching ?? null;

  const artifactState = deriveArtifactState(forgeArtifact);
  const contractMatch = deriveContractMatch(forgeArtifact, artifactState);
  const governance = deriveGovernance(forgeArtifact, artifactState);
  const freshnessReceipt = input?.freshnessReceipt ?? null;
  const fresh = deriveFreshness(freshnessReceipt);
  const playerSpecificScoreSource = derivePlayerSpecificScoreSource(rosterMatching);
  const generatedBaselineScoreSource = deriveGeneratedBaselineScoreSource(input ?? {});

  const matched = finiteOrNull(input?.forgeCoverage?.matched);
  const total = finiteOrNull(input?.forgeCoverage?.total);
  const coverage = matched !== null && total !== null ? { covered: matched, total, minimumRate } : undefined;

  // FORGE player-specific evidence → Team Direction citation (Level 3).
  const playerSpecificInput: ForgeStaticGateInput = {
    artifactState,
    contractMatch,
    scoreSource: playerSpecificScoreSource,
    governance,
    coverage,
    fresh,
    // G7 is asserted only when the route explicitly confirms it passed this
    // exact receipt through the classifier.
    consumerFailClosed: input?.classifierFreshnessEnforced,
    // This citation field labels level/provenance/coverage/freshness at the point of use.
    uiLabeled: true,
  };
  const playerSpecificEval = evaluateForgePlayerSpecificTeamDirection(playerSpecificInput, 3);

  // FORGE generated-baseline visibility (Level 1) — an independent use of the
  // source. Only evidence when generated-baseline rows actually exist; otherwise
  // it stays non-evidence (Level 0) and is never inferred from availability alone.
  const generatedBaselineInput: ForgeStaticGateInput = {
    artifactState,
    scoreSource: generatedBaselineScoreSource,
    governance,
    uiLabeled: true,
  };
  const generatedBaselineEval = evaluateForgeGeneratedBaselineVisibility(generatedBaselineInput, 1);

  const playerSpecific: ForgeUseActivationCitation = {
    sourceId: playerSpecificEval.use.sourceId,
    useId: playerSpecificEval.use.useId,
    scoreSource: playerSpecificScoreSource ?? null,
    requestedLevel: playerSpecificEval.resolved.requestedLevel,
    effectiveLevel: playerSpecificEval.resolved.effectiveLevel,
    capped: playerSpecificEval.resolved.capped,
    failedGates: playerSpecificEval.resolved.failedGates,
    caps: playerSpecificEval.resolved.caps,
    gateResults: [...playerSpecificEval.use.gateResults],
    explanation: explainUse('player_specific', playerSpecificEval.resolved.effectiveLevel, 3, playerSpecificEval.resolved.failedGates),
  };

  const generatedBaseline: ForgeUseActivationCitation = {
    sourceId: generatedBaselineEval.use.sourceId,
    useId: generatedBaselineEval.use.useId,
    scoreSource: generatedBaselineScoreSource ?? null,
    requestedLevel: generatedBaselineEval.resolved.requestedLevel,
    effectiveLevel: generatedBaselineEval.resolved.effectiveLevel,
    capped: generatedBaselineEval.resolved.capped,
    failedGates: generatedBaselineEval.resolved.failedGates,
    caps: generatedBaselineEval.resolved.caps,
    gateResults: [...generatedBaselineEval.use.gateResults],
    explanation: explainUse('generated_baseline', generatedBaselineEval.resolved.effectiveLevel, 1, generatedBaselineEval.resolved.failedGates),
  };

  return {
    diagnostic: true,
    readOnly: true,
    playerSpecific,
    generatedBaseline,
    provenanceSummary: {
      artifactState: artifactState ?? null,
      playerSpecificMatches: finiteOrNull(rosterMatching?.playerSpecificRosterMatches),
      generatedBaselineMatches: finiteOrNull(rosterMatching?.generatedBaselineRosterMatches),
      playerSpecificCount: finiteOrNull(forgeArtifact?.playerSpecificCount),
      generatedBaselineCount: finiteOrNull(forgeArtifact?.generatedBaselineCount),
    },
    coverage: matched !== null || total !== null
      ? { matched, total, rate: finiteOrNull(input?.forgeCoverage?.rate) }
      : null,
    freshnessReceipt,
    explanation:
      `FORGE evidence activation cites the enforced ${freshnessReceipt?.policyId ?? 'missing G6 freshness policy'} receipt: player-specific evidence resolves at Level ${playerSpecific.effectiveLevel} and generated baselines stay visibility-only at Level ${generatedBaseline.effectiveLevel}. Scoring and direction thresholds are unchanged.`,
  };
}

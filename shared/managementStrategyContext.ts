import type { StrategyTemplateDiagnostics } from './strategyTemplateDiagnostics';

const STRATEGY_TEMPLATE_SELECTION_ENABLED = false as const;
const STRATEGY_CONTEXT_DEFERRED_REASON = 'strategy_template_activation_deferred' as const;

type CoverageSummary = {
  matched?: number | null;
  total?: number | null;
  rate?: number | null;
  forgeMatched?: number | null;
  rookieAlphaMatched?: number | null;
};

type RosterVisibilitySummary = {
  total?: number | null;
  identityCovered?: number | null;
  forgeScored?: number | null;
  rookieAlphaFallback?: number | null;
  evidenceCovered?: number | null;
  unresolved?: number | null;
};

type StrategyOntologyArtifactSummary = {
  available?: boolean | null;
  state?: string | null;
  reason?: string | null;
  artifactType?: string | null;
  contractVersion?: string | null;
  modelVersion?: string | null;
  generatedAt?: string | null;
  futureContractInputs?: string[] | null;
};

type ManagementDiagnosticsSummary = {
  rosterCount?: number | null;
  resolvedCanonicalCount?: number | null;
  strategyOntologyArtifact?: StrategyOntologyArtifactSummary | null;
};

export type ManagementStrategyContextStatus = 'available' | 'blocked' | 'unavailable';
export type ManagementStrategyContextBlockedReason =
  | typeof STRATEGY_CONTEXT_DEFERRED_REASON
  | 'strategy_ontology_diagnostics_missing'
  | 'strategy_ontology_unavailable'
  | 'team_direction_missing'
  | 'team_direction_confidence_missing';

export type ManagementStrategyContextInput = {
  teamDirection?: {
    direction?: string | null;
    confidence?: string | null;
    coverage?: CoverageSummary | null;
    evidenceCoverage?: CoverageSummary | null;
    forgeCoverage?: CoverageSummary | null;
    visibilityCounts?: RosterVisibilitySummary | null;
  } | null;
  rosterVisibility?: RosterVisibilitySummary | null;
  diagnostics?: ManagementDiagnosticsSummary | null;
  strategyTemplateDiagnostics?: Pick<
    StrategyTemplateDiagnostics,
    'available' | 'missing_future_contract_inputs' | 'template_selection_enabled' | 'selected_template_id' | 'unavailable_reason'
  > | null;
  rosterTimelineSignals?: Record<string, unknown> | null;
  assetArchetypeSignals?: Record<string, unknown> | null;
  managementTensions?: string[] | null;
};

export type ManagementStrategyContext = {
  available: boolean;
  status: ManagementStrategyContextStatus;
  team_direction: string | null;
  team_direction_confidence: string | null;
  evidence_coverage: CoverageSummary | null;
  identity_coverage: CoverageSummary | null;
  forge_coverage: CoverageSummary | null;
  strategy_ontology_available: boolean;
  strategy_template_selection_enabled: false;
  selected_template_id: null;
  blocked_reasons: ManagementStrategyContextBlockedReason[];
  missing_inputs: string[];
  roster_timeline_signals: Record<string, unknown> | null;
  asset_archetype_signals: Record<string, unknown> | null;
  management_tensions: string[];
  source_summary: {
    roster_count: number | null;
    resolved_identity_rows_scanned: number | null;
    strategy_ontology_contract_version: string | null;
    strategy_ontology_model_version: string | null;
    strategy_ontology_generated_at: string | null;
  };
  notes: string[];
};

function cleanString(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function cleanStringList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim());
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function coverageFromCounts(matched: unknown, total: unknown): CoverageSummary | null {
  const normalizedMatched = finiteNumberOrNull(matched);
  const normalizedTotal = finiteNumberOrNull(total);
  if (normalizedMatched === null && normalizedTotal === null) return null;
  return {
    matched: normalizedMatched,
    total: normalizedTotal,
    rate: normalizedMatched !== null && normalizedTotal !== null && normalizedTotal > 0 ? normalizedMatched / normalizedTotal : null,
  };
}

function preserveCoverage(coverage?: CoverageSummary | null): CoverageSummary | null {
  if (!coverage) return null;
  const summary: CoverageSummary = {
    matched: finiteNumberOrNull(coverage.matched),
    total: finiteNumberOrNull(coverage.total),
    rate: finiteNumberOrNull(coverage.rate),
  };
  if ('forgeMatched' in coverage) summary.forgeMatched = finiteNumberOrNull(coverage.forgeMatched);
  if ('rookieAlphaMatched' in coverage) summary.rookieAlphaMatched = finiteNumberOrNull(coverage.rookieAlphaMatched);

  return Object.values(summary).some((value) => value !== null) ? summary : null;
}

function uniqueReasons(reasons: ManagementStrategyContextBlockedReason[]): ManagementStrategyContextBlockedReason[] {
  return Array.from(new Set(reasons));
}

export function buildManagementStrategyContext(input: ManagementStrategyContextInput | null | undefined): ManagementStrategyContext {
  const teamDirection = input?.teamDirection ?? null;
  const rosterVisibility = input?.rosterVisibility ?? teamDirection?.visibilityCounts ?? null;
  const ontology = input?.diagnostics?.strategyOntologyArtifact ?? null;
  const direction = cleanString(teamDirection?.direction ?? null);
  const confidence = cleanString(teamDirection?.confidence ?? null);
  const ontologyDiagnosticsAvailable = ontology !== null;
  const ontologyAvailable = ontology?.available === true;
  const blockedReasons: ManagementStrategyContextBlockedReason[] = [];

  if (!ontologyDiagnosticsAvailable) blockedReasons.push('strategy_ontology_diagnostics_missing');
  else if (!ontologyAvailable) blockedReasons.push('strategy_ontology_unavailable');
  if (!direction) blockedReasons.push('team_direction_missing');
  if (!confidence) blockedReasons.push('team_direction_confidence_missing');
  if (ontologyAvailable && direction && confidence) blockedReasons.push(STRATEGY_CONTEXT_DEFERRED_REASON);

  const hasRequiredPreviewInputs = ontologyAvailable && Boolean(direction) && Boolean(confidence);
  const missingFutureInputs = input?.strategyTemplateDiagnostics?.missing_future_contract_inputs
    ?? ontology?.futureContractInputs
    ?? [];
  const unavailableNote = !ontologyAvailable && ontology?.reason
    ? [`Strategy ontology unavailable: ${ontology.reason}`]
    : [];

  return {
    available: hasRequiredPreviewInputs,
    status: hasRequiredPreviewInputs ? 'blocked' : ontologyDiagnosticsAvailable && ontologyAvailable ? 'blocked' : 'unavailable',
    team_direction: direction,
    team_direction_confidence: confidence,
    evidence_coverage: preserveCoverage(teamDirection?.evidenceCoverage) ?? coverageFromCounts(rosterVisibility?.evidenceCovered, rosterVisibility?.total),
    identity_coverage: preserveCoverage(teamDirection?.coverage) ?? coverageFromCounts(rosterVisibility?.identityCovered, rosterVisibility?.total),
    forge_coverage: preserveCoverage(teamDirection?.forgeCoverage) ?? coverageFromCounts(rosterVisibility?.forgeScored, rosterVisibility?.total),
    strategy_ontology_available: ontologyAvailable,
    strategy_template_selection_enabled: STRATEGY_TEMPLATE_SELECTION_ENABLED,
    selected_template_id: null,
    blocked_reasons: uniqueReasons(blockedReasons),
    missing_inputs: cleanStringList(missingFutureInputs),
    roster_timeline_signals: input?.rosterTimelineSignals ?? null,
    asset_archetype_signals: input?.assetArchetypeSignals ?? null,
    management_tensions: cleanStringList(input?.managementTensions),
    source_summary: {
      roster_count: finiteNumberOrNull(input?.diagnostics?.rosterCount ?? rosterVisibility?.total),
      resolved_identity_rows_scanned: finiteNumberOrNull(input?.diagnostics?.resolvedCanonicalCount),
      strategy_ontology_contract_version: cleanString(ontology?.contractVersion ?? null),
      strategy_ontology_model_version: cleanString(ontology?.modelVersion ?? null),
      strategy_ontology_generated_at: cleanString(ontology?.generatedAt ?? null),
    },
    notes: [
      'Read-only Management Strategy Context for future Strategy ontology activation.',
      'Strategy template selection remains disabled; no template rendering, interpolation, or recommendations are performed.',
      ...unavailableNote,
    ],
  };
}

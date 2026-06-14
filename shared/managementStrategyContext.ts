import type { StrategyTemplateDiagnostics } from './strategyTemplateDiagnostics';

const STRATEGY_TEMPLATE_SELECTION_ENABLED = false as const;
const STRATEGY_CONTEXT_DEFERRED_REASON = 'strategy_template_activation_deferred' as const;

const STRATEGY_CONTEXT_NOTE_READONLY =
  'Read-only Management Strategy Context for future Strategy ontology activation.' as const;
const STRATEGY_CONTEXT_NOTE_SELECTION_DISABLED =
  'Strategy template selection remains disabled; no template rendering, interpolation, or recommendations are performed.' as const;
const STRATEGY_ONTOLOGY_UNAVAILABLE_NOTE_PREFIX = 'Strategy ontology unavailable:' as const;

const STRATEGY_CONTEXT_SAFE_BUILDER_NOTES: readonly string[] = [
  STRATEGY_CONTEXT_NOTE_READONLY,
  STRATEGY_CONTEXT_NOTE_SELECTION_DISABLED,
];

// Interpolation markers are never legitimate in a read-only context note.
const STRATEGY_NOTE_INTERPOLATION_MARKER_PATTERN = /\{\{|\}\}/;
// Advice/activation language that could imply active strategy output.
const STRATEGY_NOTE_ADVICE_ACTIVATION_PATTERN =
  /\b(recommend(?:s|ed|ation|ations|ing)?|advis(?:e|es|ed|ory|ing)|should\s+(?:start|sit|trade|drop|add|stash|cut|hold))\b/i;

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

const STRATEGY_CONTEXT_STATUSES: readonly ManagementStrategyContextStatus[] = ['available', 'blocked', 'unavailable'];
const KNOWN_BLOCKED_REASONS: readonly ManagementStrategyContextBlockedReason[] = [
  STRATEGY_CONTEXT_DEFERRED_REASON,
  'strategy_ontology_diagnostics_missing',
  'strategy_ontology_unavailable',
  'team_direction_missing',
  'team_direction_confidence_missing',
];

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isKnownSafeBuilderNote(note: string): boolean {
  return STRATEGY_CONTEXT_SAFE_BUILDER_NOTES.includes(note) || note.startsWith(STRATEGY_ONTOLOGY_UNAVAILABLE_NOTE_PREFIX);
}

/**
 * Applies the same fail-closed rules to a single context note that we apply to
 * template bodies: interpolation markers are never legitimate, and any note that
 * implies active strategy advice/output is dropped. Known read-only builder
 * notes (whose advice wording is a negation) are preserved verbatim.
 *
 * Returns the note to keep, or `null` to drop it.
 */
function sanitizeStrategyContextNote(note: string): string | null {
  if (STRATEGY_NOTE_INTERPOLATION_MARKER_PATTERN.test(note)) return null;
  if (isKnownSafeBuilderNote(note)) return note;
  if (STRATEGY_NOTE_ADVICE_ACTIVATION_PATTERN.test(note)) return null;
  return note;
}

function sanitizeStrategyContextNotes(value: unknown): string[] {
  return cleanStringList(Array.isArray(value) ? (value as string[]) : null)
    .map((note) => sanitizeStrategyContextNote(note))
    .filter((note): note is string => note !== null);
}

/**
 * Resolves the readiness status for the Strategy Context.
 *
 * `'available'` is reserved for a future Strategy activation phase and is never
 * emitted while template selection is deferred. Until then an inspectable
 * ontology reports `'blocked'` (visible but gated) and a missing/unavailable
 * ontology fails closed to `'unavailable'`.
 */
function resolveManagementStrategyContextStatus(ontologyAvailable: boolean): ManagementStrategyContextStatus {
  return ontologyAvailable ? 'blocked' : 'unavailable';
}

/**
 * A Strategy Context is "inspectable" when Management can show its read-only
 * diagnostics. This is visibility only — it never implies template selection,
 * rendering, interpolation, advice output, or Team Direction recalculation.
 */
export function isManagementStrategyContextInspectable(
  context: ManagementStrategyContext | null | undefined,
): boolean {
  if (!context) return false;
  return context.available || context.status === 'blocked' || context.status === 'available';
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
    ? [`${STRATEGY_ONTOLOGY_UNAVAILABLE_NOTE_PREFIX} ${ontology.reason}`]
    : [];

  return {
    available: hasRequiredPreviewInputs,
    status: resolveManagementStrategyContextStatus(ontologyAvailable),
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
    notes: sanitizeStrategyContextNotes([
      STRATEGY_CONTEXT_NOTE_READONLY,
      STRATEGY_CONTEXT_NOTE_SELECTION_DISABLED,
      ...unavailableNote,
    ]),
  };
}

function normalizeStatus(value: unknown): ManagementStrategyContextStatus {
  return typeof value === 'string' && (STRATEGY_CONTEXT_STATUSES as readonly string[]).includes(value)
    ? (value as ManagementStrategyContextStatus)
    : 'unavailable';
}

function normalizeBlockedReasons(value: unknown): ManagementStrategyContextBlockedReason[] {
  if (!Array.isArray(value)) return [];
  return uniqueReasons(
    value.filter(
      (reason): reason is ManagementStrategyContextBlockedReason =>
        typeof reason === 'string' && (KNOWN_BLOCKED_REASONS as readonly string[]).includes(reason),
    ),
  );
}

function normalizeCoverage(value: unknown): CoverageSummary | null {
  const record = asRecord(value);
  if (!record) return null;
  const summary: CoverageSummary = {
    matched: finiteNumberOrNull(record.matched),
    total: finiteNumberOrNull(record.total),
    rate: finiteNumberOrNull(record.rate),
  };
  if ('forgeMatched' in record) summary.forgeMatched = finiteNumberOrNull(record.forgeMatched);
  if ('rookieAlphaMatched' in record) summary.rookieAlphaMatched = finiteNumberOrNull(record.rookieAlphaMatched);
  return Object.values(summary).some((entry) => entry !== null) ? summary : null;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? cleanStringList(value as string[]) : [];
}

/**
 * Defensively coerces an arbitrary (possibly partial, malformed, or untrusted)
 * value into a safe {@link ManagementStrategyContext}, or returns `null` when the
 * value is not an object at all.
 *
 * Fail-closed guarantees enforced here regardless of input:
 * - `strategy_template_selection_enabled` is always `false`.
 * - `selected_template_id` is always `null`.
 * - `available` cannot be `true` unless the status is also inspectable.
 * - Only known fields are copied, so injected template bodies/slots cannot leak
 *   through into Management surfaces.
 */
export function normalizeManagementStrategyContext(value: unknown): ManagementStrategyContext | null {
  const record = asRecord(value);
  if (!record) return null;

  const status = normalizeStatus(record.status);
  const sourceSummary = asRecord(record.source_summary) ?? {};

  return {
    available: record.available === true && status !== 'unavailable',
    status,
    team_direction: cleanString(typeof record.team_direction === 'string' ? record.team_direction : null),
    team_direction_confidence: cleanString(
      typeof record.team_direction_confidence === 'string' ? record.team_direction_confidence : null,
    ),
    evidence_coverage: normalizeCoverage(record.evidence_coverage),
    identity_coverage: normalizeCoverage(record.identity_coverage),
    forge_coverage: normalizeCoverage(record.forge_coverage),
    strategy_ontology_available: record.strategy_ontology_available === true,
    // Hard invariants — never trust an incoming payload to enable activation.
    strategy_template_selection_enabled: STRATEGY_TEMPLATE_SELECTION_ENABLED,
    selected_template_id: null,
    blocked_reasons: normalizeBlockedReasons(record.blocked_reasons),
    missing_inputs: normalizeStringArray(record.missing_inputs),
    roster_timeline_signals: asRecord(record.roster_timeline_signals),
    asset_archetype_signals: asRecord(record.asset_archetype_signals),
    management_tensions: normalizeStringArray(record.management_tensions),
    source_summary: {
      roster_count: finiteNumberOrNull(sourceSummary.roster_count),
      resolved_identity_rows_scanned: finiteNumberOrNull(sourceSummary.resolved_identity_rows_scanned),
      strategy_ontology_contract_version: cleanString(
        typeof sourceSummary.strategy_ontology_contract_version === 'string'
          ? sourceSummary.strategy_ontology_contract_version
          : null,
      ),
      strategy_ontology_model_version: cleanString(
        typeof sourceSummary.strategy_ontology_model_version === 'string'
          ? sourceSummary.strategy_ontology_model_version
          : null,
      ),
      strategy_ontology_generated_at: cleanString(
        typeof sourceSummary.strategy_ontology_generated_at === 'string'
          ? sourceSummary.strategy_ontology_generated_at
          : null,
      ),
    },
    notes: sanitizeStrategyContextNotes(record.notes),
  };
}

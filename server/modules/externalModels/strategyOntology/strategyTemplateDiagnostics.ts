import type { TeamDirectionResult } from '../../../services/teamDirectionClassifier';
import type { StrategyOntologyDiagnostics, StrategyOntologyLookup } from './types';

const TEMPLATE_SELECTION_ENABLED = false as const;

export const EXPECTED_STRATEGY_TEMPLATE_FUTURE_INPUTS = [
  'age_band',
  'experience_band',
  'role_security_signal',
  'market_liquidity_signal',
] as const;

type StrategyTemplateBlockedReason = 'template_selection_disabled' | 'missing_future_contract_inputs';
type StrategyTemplateEligibilityState = 'blocked' | 'not_applicable';

export type StrategyOntologyTemplateSummary = {
  template_id: string;
  applies_to: string[];
};

type StrategyTemplateRecord = {
  template_id: string;
  classification_compatible: boolean;
  eligibility_state: StrategyTemplateEligibilityState;
  blocked_reasons: StrategyTemplateBlockedReason[];
  missing_inputs: string[];
};

export type StrategyTemplateDiagnostics = {
  available: boolean;
  artifact_type: 'DYNASTY_STRATEGY_ONTOLOGY_V1' | null;
  contract_version: string | null;
  model_version: string | null;
  generated_at: string | null;
  template_selection_enabled: false;
  selected_template_id: null;
  current_team_direction: string | null;
  current_confidence: string | null;
  evaluated_template_count: number;
  classification_compatible_template_ids: string[];
  blocked_reasons: StrategyTemplateBlockedReason[];
  missing_future_contract_inputs: string[];
  templates: StrategyTemplateRecord[];
  unavailable_reason: string | null;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickTemplateId(template: Record<string, unknown>): string | null {
  const id = template.id ?? template.template_id ?? template.templateId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function pickAppliesTo(template: Record<string, unknown>): string[] {
  const appliesTo = template.applies_to ?? template.appliesTo;
  if (!Array.isArray(appliesTo)) return [];
  return appliesTo
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
}

function normalizeTeamDirection(direction?: string | null): string | null {
  const normalized = direction?.trim().toLowerCase();
  return normalized || null;
}

function displayValue(value?: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function missingFutureInputs(lookup: { artifact: Pick<StrategyOntologyDiagnostics, 'futureContractInputs'> }): string[] {
  const artifactInputs = lookup.artifact.futureContractInputs.filter((input) => input.trim().length > 0);
  return artifactInputs.length > 0 ? artifactInputs : [...EXPECTED_STRATEGY_TEMPLATE_FUTURE_INPUTS];
}


export function summarizeStrategyOntologyTemplates(lookup: StrategyOntologyLookup): StrategyOntologyTemplateSummary[] {
  if (!lookup.artifact.available || !lookup.raw) return [];
  const rawTemplates = Array.isArray(lookup.raw.explanation_templates) ? lookup.raw.explanation_templates : [];
  return rawTemplates.flatMap((rawTemplate): StrategyOntologyTemplateSummary[] => {
    const template = toRecord(rawTemplate);
    const templateId = pickTemplateId(template);
    if (!templateId) return [];
    return [{ template_id: templateId, applies_to: pickAppliesTo(template) }];
  });
}

type StrategyTemplateDiagnosticsSource =
  | StrategyOntologyLookup
  | { artifact: StrategyOntologyDiagnostics; templates: StrategyOntologyTemplateSummary[] };

function templatesForDiagnostics(source: StrategyTemplateDiagnosticsSource): StrategyOntologyTemplateSummary[] {
  if ('templates' in source) return source.templates;
  return summarizeStrategyOntologyTemplates(source);
}

export function buildStrategyTemplateDiagnostics(
  lookup: StrategyTemplateDiagnosticsSource | null | undefined,
  teamDirection: Pick<TeamDirectionResult, 'direction' | 'confidence'> | null | undefined,
): StrategyTemplateDiagnostics {
  const currentDirection = normalizeTeamDirection(teamDirection?.direction ?? null);
  const currentConfidence = teamDirection?.confidence ?? null;

  if (!lookup?.artifact.available || ('raw' in lookup && !lookup.raw)) {
    return {
      available: false,
      artifact_type: lookup?.artifact.artifactType ?? null,
      contract_version: lookup?.artifact.contractVersion ?? null,
      model_version: lookup?.artifact.modelVersion ?? null,
      generated_at: lookup?.artifact.generatedAt ?? null,
      template_selection_enabled: TEMPLATE_SELECTION_ENABLED,
      selected_template_id: null,
      current_team_direction: displayValue(teamDirection?.direction ?? null),
      current_confidence: displayValue(currentConfidence),
      evaluated_template_count: 0,
      classification_compatible_template_ids: [],
      blocked_reasons: [],
      missing_future_contract_inputs: [],
      templates: [],
      unavailable_reason: lookup?.artifact.reason ?? 'DYNASTY_STRATEGY_ONTOLOGY_V1 artifact diagnostics are unavailable.',
    };
  }

  const templateSummaries = templatesForDiagnostics(lookup);
  const missingInputs = missingFutureInputs(lookup);
  const templates = templateSummaries.flatMap((template): StrategyTemplateRecord[] => {
    const templateId = template.template_id;
    const appliesTo = template.applies_to;
    const classificationCompatible = Boolean(currentDirection && appliesTo.includes(currentDirection));
    const blockedReasons: StrategyTemplateBlockedReason[] = classificationCompatible
      ? [
          'template_selection_disabled',
          ...(missingInputs.length > 0 ? (['missing_future_contract_inputs'] as const) : []),
        ]
      : [];

    return [{
      template_id: templateId,
      classification_compatible: classificationCompatible,
      eligibility_state: classificationCompatible ? 'blocked' : 'not_applicable',
      blocked_reasons: blockedReasons,
      missing_inputs: classificationCompatible ? missingInputs : [],
    }];
  });

  const classificationCompatibleTemplateIds = templates
    .filter((template) => template.classification_compatible)
    .map((template) => template.template_id);
  const blockedReasons: StrategyTemplateBlockedReason[] = classificationCompatibleTemplateIds.length > 0
    ? ['template_selection_disabled', ...(missingInputs.length > 0 ? (['missing_future_contract_inputs'] as const) : [])]
    : [];

  return {
    available: true,
    artifact_type: lookup.artifact.artifactType,
    contract_version: lookup.artifact.contractVersion,
    model_version: lookup.artifact.modelVersion,
    generated_at: lookup.artifact.generatedAt,
    template_selection_enabled: TEMPLATE_SELECTION_ENABLED,
    selected_template_id: null,
    current_team_direction: displayValue(teamDirection?.direction ?? null),
    current_confidence: displayValue(currentConfidence),
    evaluated_template_count: templates.length,
    classification_compatible_template_ids: classificationCompatibleTemplateIds,
    blocked_reasons: blockedReasons,
    missing_future_contract_inputs: missingInputs,
    templates,
    unavailable_reason: null,
  };
}

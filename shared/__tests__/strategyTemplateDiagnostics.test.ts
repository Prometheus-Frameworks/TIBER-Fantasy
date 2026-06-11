import { adaptStrategyOntologyArtifact } from '../../server/modules/externalModels/strategyOntology/strategyOntologyAdapter';
import {
  buildStrategyTemplateDiagnostics,
  summarizeStrategyOntologyTemplates,
} from '../strategyTemplateDiagnostics';
import type { StrategyOntologyLookup } from '../../server/modules/externalModels/strategyOntology/types';

const requiredSafetyRules = [
  'cannot_override_identity',
  'cannot_override_team_assignment',
  'cannot_override_forge_evidence',
  'cannot_count_generated_baselines_as_evidence',
  'cannot_create_projections',
  'cannot_assign_player_labels_itself',
  'cannot_consume_operator_notes_as_evidence',
  'cannot_replace_human_decision',
];

const futureContractInputs = ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'];

function validArtifact() {
  return {
    artifact_type: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
    schema_version: 'dynasty_strategy_ontology_v1',
    model_version: 'dynasty-strategy-ontology-v1.0.0',
    generated_at: '2026-06-10T00:00:00.000Z',
    row_count: 0,
    concepts: [],
    player_asset_archetypes: [],
    roster_state_definitions: [],
    timeline_rules: [],
    explanation_templates: [
      {
        id: 'rebuild_low_alpha_concentration',
        applies_to: ['rebuild'],
        slots: ['anchor_count'],
        text: 'Do not expose this template text: {anchor_count}.',
      },
      {
        id: 'rebuild_premium_assets_timeline_mismatch',
        applies_to: ['rebuild', 'timeline_mismatch'],
        slots: ['premium_asset_count'],
        text: 'Do not interpolate {premium_asset_count}.',
      },
      {
        id: 'productive_rebuild_with_anchor_base',
        applies_to: ['productive_rebuild'],
        text: 'Richer state template text must stay hidden.',
      },
      {
        id: 'contender_with_future_pick_drag',
        applies_to: ['contender'],
        text: 'Contender template text must stay hidden.',
      },
    ],
    consumer_manifest: {
      intended_consumers: ['TIBER-Fantasy'],
      missing_input_behavior: 'do_not_assign_fail_closed',
      required_inputs: futureContractInputs.map((input_id) => ({ input_id, status: 'future_contract' })),
      consumer_safety_rules: requiredSafetyRules.map((rule_id) => ({ rule_id })),
    },
  };
}

describe('strategy template diagnostics', () => {
  it('reports read-only template readiness for a valid ontology without selecting or rendering templates', () => {
    const lookup = adaptStrategyOntologyArtifact(validArtifact(), '/artifact.json');
    const diagnostics = buildStrategyTemplateDiagnostics(lookup, { direction: 'rebuild', confidence: 'high' });

    expect(diagnostics).toMatchObject({
      available: true,
      artifact_type: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
      contract_version: 'dynasty_strategy_ontology_v1',
      model_version: 'dynasty-strategy-ontology-v1.0.0',
      generated_at: '2026-06-10T00:00:00.000Z',
      template_selection_enabled: false,
      selected_template_id: null,
      current_team_direction: 'Rebuild',
      current_confidence: 'High',
      evaluated_template_count: 4,
      classification_compatible_template_ids: [
        'rebuild_low_alpha_concentration',
        'rebuild_premium_assets_timeline_mismatch',
      ],
      blocked_reasons: ['template_selection_disabled', 'missing_future_contract_inputs'],
      missing_future_contract_inputs: futureContractInputs,
    });

    expect(diagnostics.templates).toEqual(expect.arrayContaining([
      {
        template_id: 'rebuild_low_alpha_concentration',
        classification_compatible: true,
        eligibility_state: 'blocked',
        blocked_reasons: ['template_selection_disabled', 'missing_future_contract_inputs'],
        missing_inputs: futureContractInputs,
      },
      {
        template_id: 'productive_rebuild_with_anchor_base',
        classification_compatible: false,
        eligibility_state: 'not_applicable',
        blocked_reasons: [],
        missing_inputs: [],
      },
    ]));
    expect(JSON.stringify(diagnostics)).not.toContain('Do not expose this template text');
    expect(JSON.stringify(diagnostics)).not.toContain('{anchor_count}');
  });

  it('can build diagnostics from sanitized template summaries only', () => {
    const lookup = adaptStrategyOntologyArtifact(validArtifact(), '/artifact.json');
    const diagnostics = buildStrategyTemplateDiagnostics(
      { artifact: lookup.artifact, templates: summarizeStrategyOntologyTemplates(lookup) },
      { direction: 'contender', confidence: 'medium' },
    );

    expect(diagnostics.classification_compatible_template_ids).toEqual(['contender_with_future_pick_drag']);
    expect(diagnostics.selected_template_id).toBeNull();
    expect(diagnostics.template_selection_enabled).toBe(false);
  });

  it('fails closed when the ontology artifact is unavailable', () => {
    const unavailableLookup: StrategyOntologyLookup = {
      artifact: {
        state: 'missing',
        available: false,
        reason: 'missing artifact',
        code: 'not_found',
        sourcePath: '/missing.json',
        artifactId: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
        artifactType: null,
        contractVersion: null,
        modelVersion: null,
        generatedAt: null,
        rowCount: null,
        concepts: 0,
        playerAssetArchetypes: 0,
        rosterStateDefinitions: 0,
        timelineRules: 0,
        explanationTemplates: 0,
        futureContractInputs: [],
        safetyRules: [],
        archetypeAssignmentEnabled: false,
        templateSelectionEnabled: false,
      },
      raw: null,
    };

    const diagnostics = buildStrategyTemplateDiagnostics(unavailableLookup, { direction: 'rebuild', confidence: 'low' });

    expect(diagnostics).toMatchObject({
      available: false,
      template_selection_enabled: false,
      selected_template_id: null,
      evaluated_template_count: 0,
      classification_compatible_template_ids: [],
      templates: [],
      unavailable_reason: 'missing artifact',
    });
  });
});

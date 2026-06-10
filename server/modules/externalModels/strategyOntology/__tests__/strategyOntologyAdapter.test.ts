import { readFileSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { adaptStrategyOntologyArtifact } from '../strategyOntologyAdapter';
import { StrategyOntologyClient } from '../strategyOntologyClient';
import { StrategyOntologyIntegration } from '../StrategyOntologyIntegration';

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

function ruleObjects(ruleIds: string[] = requiredSafetyRules) {
  return ruleIds.map((ruleId) => ({ rule_id: ruleId, statement: `${ruleId} boundary.` }));
}

function futureRequiredInputs() {
  return ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'].map((inputId) => ({
    input_id: inputId,
    status: 'future_contract',
    description: `${inputId} will be supplied by a future governed producer.`,
  }));
}

function validArtifact(overrides: Record<string, unknown> = {}) {
  return {
    artifact_type: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
    schema_version: 'dynasty_strategy_ontology_v1',
    row_count: 0,
    concepts: [{ id: 'concept_1' }, { id: 'concept_2' }],
    player_asset_archetypes: [{ id: 'archetype_1' }],
    roster_state_definitions: [{ id: 'state_1' }],
    timeline_rules: [{ id: 'timeline_1' }],
    explanation_templates: [{ id: 'template_1' }],
    consumer_manifest: {
      intended_consumers: ['TIBER-Fantasy'],
      missing_input_behavior: 'do_not_assign_fail_closed',
      required_inputs: futureRequiredInputs(),
      consumer_safety_rules: ruleObjects(),
    },
    ...overrides,
  };
}

describe('strategy ontology consumer adapter', () => {
  it('loads the bundled promoted DYNASTY_STRATEGY_ONTOLOGY_V1 artifact shape as read-only diagnostics', () => {
    const artifactPath = path.join(process.cwd(), 'server', 'artifacts', 'external', 'strategy', 'dynasty_strategy_ontology_v1.json');
    const payload = JSON.parse(readFileSync(artifactPath, 'utf8')) as unknown;

    const lookup = adaptStrategyOntologyArtifact(payload, artifactPath);

    expect(lookup.artifact).toMatchObject({
      available: true,
      sourcePath: artifactPath,
      artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
      contractVersion: 'dynasty_strategy_ontology_v1',
      rowCount: 0,
      concepts: 11,
      playerAssetArchetypes: 10,
      rosterStateDefinitions: 8,
      timelineRules: 9,
      explanationTemplates: 7,
      futureContractInputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
      safetyRules: requiredSafetyRules,
      archetypeAssignmentEnabled: false,
      templateSelectionEnabled: false,
    });
  });

  it('loads a valid DYNASTY_STRATEGY_ONTOLOGY_V1 artifact as read-only diagnostics', () => {
    const lookup = adaptStrategyOntologyArtifact(validArtifact(), '/artifact.json');

    expect(lookup.artifact).toMatchObject({
      available: true,
      sourcePath: '/artifact.json',
      artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
      contractVersion: 'dynasty_strategy_ontology_v1',
      rowCount: 0,
      concepts: 2,
      playerAssetArchetypes: 1,
      rosterStateDefinitions: 1,
      timelineRules: 1,
      explanationTemplates: 1,
      futureContractInputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
      archetypeAssignmentEnabled: false,
      templateSelectionEnabled: false,
    });
  });

  it('fails closed when the configured artifact is missing', async () => {
    const missingPath = path.join(os.tmpdir(), `missing-strategy-${Date.now()}.json`);
    const integration = new StrategyOntologyIntegration(new StrategyOntologyClient({ artifactPath: missingPath }));

    const lookup = await integration.getLookup();

    expect(lookup.artifact).toMatchObject({
      available: false,
      state: 'missing',
      code: 'not_found',
      sourcePath: missingPath,
      archetypeAssignmentEnabled: false,
      templateSelectionEnabled: false,
    });
    expect(lookup.raw).toBeNull();
  });

  it('fails closed when a parsed artifact has a malformed envelope', async () => {
    const integration = new StrategyOntologyIntegration({
      getConfig: () => ({ enabled: true, configured: true, artifactPath: '/artifact.json', sourcePath: '/artifact.json' }),
      loadPromotedArtifact: async () => ({ payload: { ...validArtifact(), concepts: null }, sourcePath: '/artifact.json' }),
    });

    const lookup = await integration.getLookup();

    expect(lookup.artifact).toMatchObject({
      available: false,
      state: 'malformed',
      code: 'invalid_payload',
      concepts: 0,
      archetypeAssignmentEnabled: false,
      templateSelectionEnabled: false,
    });
  });

  it('fails closed when the artifact is malformed JSON', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'strategy-ontology-'));
    const artifactPath = path.join(dir, 'dynasty_strategy_ontology_v1.json');
    await writeFile(artifactPath, '{not-json', 'utf8');

    const integration = new StrategyOntologyIntegration(new StrategyOntologyClient({ artifactPath }));
    const lookup = await integration.getLookup();

    expect(lookup.artifact).toMatchObject({ available: false, state: 'malformed', code: 'invalid_payload' });
    await rm(dir, { recursive: true, force: true });
  });

  it('enforces required consumer safety rules', () => {
    const artifact = validArtifact({
      consumer_manifest: {
        ...validArtifact().consumer_manifest,
        consumer_safety_rules: ruleObjects(requiredSafetyRules.filter((ruleId) => ruleId !== 'cannot_replace_human_decision')),
      },
    });

    expect(() => adaptStrategyOntologyArtifact(artifact, '/artifact.json')).toThrow(/cannot_replace_human_decision/);
  });

  it.each([
    ['wrong artifact_type', { artifact_type: 'OTHER_ARTIFACT' }],
    ['wrong schema_version', { schema_version: 'v2' }],
    ['nonzero row_count', { row_count: 1 }],
  ])('rejects %s', (_caseName, overrides) => {
    expect(() => adaptStrategyOntologyArtifact(validArtifact(overrides), '/artifact.json')).toThrow();
  });
});

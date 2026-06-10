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
      modelVersion: 'dynasty-strategy-ontology-v1.0.0',
      generatedAt: '2026-06-10T00:00:00.000Z',
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

  it('accepts the canonical TIBER-Strategy promoted artifact contract, not a Fantasy-shaped substitute', () => {
    const artifactPath = path.join(process.cwd(), 'server', 'artifacts', 'external', 'strategy', 'dynasty_strategy_ontology_v1.json');
    const payload = JSON.parse(readFileSync(artifactPath, 'utf8')) as Record<string, unknown>;

    // Canonical producer identity (TIBER-Strategy exports/promoted/dynasty_strategy_ontology).
    expect(payload.model_version).toBe('dynasty-strategy-ontology-v1.0.0');
    expect(payload.generated_at).toBe('2026-06-10T00:00:00.000Z');

    // Canonical entries use the producer's `id` field, so a local substitute keyed by
    // concept_id/archetype_id (or with generic stand-in entries) fails these assertions
    // even when section counts match.
    const idsOf = (key: string) =>
      (payload[key] as Array<{ id: string }>).map((entry) => entry.id);

    expect(idsOf('concepts')).toEqual(expect.arrayContaining(['alpha_concentration']));
    expect(idsOf('player_asset_archetypes')).toEqual(
      expect.arrayContaining([
        'franchise_anchor',
        'premium_young_wr',
        'elite_short_window_veteran',
        'rebuild_core',
        'liquidation_candidate',
        'consolidation_target',
      ]),
    );
    expect(idsOf('roster_state_definitions')).toEqual(
      expect.arrayContaining([
        'contender',
        'rebuild',
        'productive_rebuild',
        'fragile_contender',
        'false_contender',
        'asset_rich_rebuild',
        'timeline_mismatch',
      ]),
    );
    expect(idsOf('timeline_rules')).toEqual(
      expect.arrayContaining(['tr_concentration_share_is_not_quality', 'tr_elite_short_window_not_anchor']),
    );
    expect(idsOf('explanation_templates')).toEqual(
      expect.arrayContaining([
        'rebuild_low_alpha_concentration',
        'rebuild_premium_assets_timeline_mismatch',
        'productive_rebuild_with_anchor_base',
      ]),
    );

    // The adapter must accept the real producer contract and keep read-only boundaries.
    const lookup = adaptStrategyOntologyArtifact(payload, artifactPath);
    expect(lookup.artifact).toMatchObject({
      available: true,
      artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
      contractVersion: 'dynasty_strategy_ontology_v1',
      modelVersion: 'dynasty-strategy-ontology-v1.0.0',
      generatedAt: '2026-06-10T00:00:00.000Z',
      rowCount: 0,
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
      modelVersion: null,
      generatedAt: null,
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
      modelVersion: null,
      generatedAt: null,
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

    expect(lookup.artifact).toMatchObject({ available: false, state: 'malformed', code: 'invalid_payload', modelVersion: null, generatedAt: null });
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

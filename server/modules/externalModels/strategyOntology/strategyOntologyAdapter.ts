import {
  REQUIRED_STRATEGY_ONTOLOGY_SAFETY_RULES,
  StrategyOntologyIntegrationError,
  StrategyOntologyLookup,
} from './types';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

function assertArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new StrategyOntologyIntegrationError(
      'invalid_payload',
      `DYNASTY_STRATEGY_ONTOLOGY_V1 artifact is missing required ${key} array.`,
      502,
      'malformed',
    );
  }
  return value;
}

function assertConsumerManifest(record: Record<string, unknown>): {
  futureContractInputs: string[];
  safetyRules: string[];
} {
  const manifest = toRecord(record.consumer_manifest);
  if (Object.keys(manifest).length === 0) {
    throw new StrategyOntologyIntegrationError(
      'invalid_payload',
      'DYNASTY_STRATEGY_ONTOLOGY_V1 artifact is missing consumer_manifest.',
      502,
      'malformed',
    );
  }

  const intendedConsumers = pickStringArray(manifest.intended_consumers);
  if (!intendedConsumers.includes('TIBER-Fantasy')) {
    throw new StrategyOntologyIntegrationError(
      'unsupported',
      'DYNASTY_STRATEGY_ONTOLOGY_V1 consumer_manifest does not list TIBER-Fantasy as an intended consumer.',
      422,
      'unsupported',
    );
  }

  if (manifest.missing_input_behavior !== 'do_not_assign_fail_closed') {
    throw new StrategyOntologyIntegrationError(
      'unsupported',
      'DYNASTY_STRATEGY_ONTOLOGY_V1 missing_input_behavior must be do_not_assign_fail_closed.',
      422,
      'unsupported',
    );
  }

  const safetyRules = pickStringArray(manifest.consumer_safety_rules ?? manifest.safety_rules);
  const missingRules = REQUIRED_STRATEGY_ONTOLOGY_SAFETY_RULES.filter((rule) => !safetyRules.includes(rule));
  if (missingRules.length > 0) {
    throw new StrategyOntologyIntegrationError(
      'unsupported',
      `DYNASTY_STRATEGY_ONTOLOGY_V1 consumer_manifest is missing required safety rules: ${missingRules.join(', ')}.`,
      422,
      'unsupported',
    );
  }

  return {
    futureContractInputs: pickStringArray(manifest.future_contract_inputs),
    safetyRules,
  };
}

export function adaptStrategyOntologyArtifact(payload: unknown, sourcePath: string): StrategyOntologyLookup {
  const record = toRecord(payload);
  if (Object.keys(record).length === 0) {
    throw new StrategyOntologyIntegrationError(
      'invalid_payload',
      'DYNASTY_STRATEGY_ONTOLOGY_V1 artifact must be a JSON object.',
      502,
      'malformed',
    );
  }

  const artifactType = pickString(record, ['artifact_type', 'artifactType']);
  if (artifactType !== 'DYNASTY_STRATEGY_ONTOLOGY_V1') {
    throw new StrategyOntologyIntegrationError(
      'unsupported',
      `Unsupported strategy ontology artifact (${artifactType ?? 'missing'}); expected DYNASTY_STRATEGY_ONTOLOGY_V1.`,
      422,
      'unsupported',
    );
  }

  const schemaVersion = pickString(record, ['schema_version', 'schemaVersion']);
  if (schemaVersion !== 'dynasty_strategy_ontology_v1') {
    throw new StrategyOntologyIntegrationError(
      'unsupported',
      `Unsupported strategy ontology schema_version (${schemaVersion ?? 'missing'}); expected dynasty_strategy_ontology_v1.`,
      422,
      'unsupported',
    );
  }

  if (record.row_count !== 0) {
    throw new StrategyOntologyIntegrationError(
      'unsupported',
      'DYNASTY_STRATEGY_ONTOLOGY_V1 row_count must be 0 because the ontology cannot carry player rows.',
      422,
      'unsupported',
    );
  }

  const concepts = assertArray(record, 'concepts');
  const playerAssetArchetypes = assertArray(record, 'player_asset_archetypes');
  const rosterStateDefinitions = assertArray(record, 'roster_state_definitions');
  const timelineRules = assertArray(record, 'timeline_rules');
  const explanationTemplates = assertArray(record, 'explanation_templates');
  const { futureContractInputs, safetyRules } = assertConsumerManifest(record);

  return {
    artifact: {
      state: 'available',
      available: true,
      reason: null,
      code: null,
      sourcePath,
      artifactId: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
      artifactType,
      contractVersion: schemaVersion,
      rowCount: 0,
      concepts: concepts.length,
      playerAssetArchetypes: playerAssetArchetypes.length,
      rosterStateDefinitions: rosterStateDefinitions.length,
      timelineRules: timelineRules.length,
      explanationTemplates: explanationTemplates.length,
      futureContractInputs,
      safetyRules,
      archetypeAssignmentEnabled: false,
      templateSelectionEnabled: false,
    },
    raw: record,
  };
}

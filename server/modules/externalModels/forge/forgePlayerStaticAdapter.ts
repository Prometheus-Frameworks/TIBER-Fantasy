import {
  ForgePlayerStaticIntegrationError,
  ForgePlayerStaticLookup,
  ForgePlayerStaticRow,
  ForgePlayerStaticScoreSource,
} from './forgePlayerStaticTypes';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getPathValue(record: Record<string, unknown>, key: string): unknown {
  if (!key.includes('.')) return record[key];
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, record);
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = getPathValue(record, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = getPathValue(record, key);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickRows(payload: Record<string, unknown>): unknown[] {
  const candidates = [payload.rows, payload.players, payload.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeScoreSource(value: unknown): ForgePlayerStaticScoreSource {
  if (value === 'player_specific') return 'player_specific';
  if (value === 'generated_baseline') return 'generated_baseline';
  if (value === 'fallback_default') return 'fallback_default';
  return 'unknown';
}

function assertSupportedArtifact(payload: Record<string, unknown>) {
  const meta = toRecord(payload.meta ?? payload.metadata ?? payload.manifest);
  const manifest = toRecord(payload.consumer_manifest ?? payload.downstream_consumer_manifest ?? payload.manifest);
  const declaredId = pickString({ ...payload, ...meta, ...manifest }, [
    'artifact_type',
    'artifactType',
    'artifact_id',
    'artifactId',
    'artifact_name',
    'artifactName',
    'name',
    'id',
    'contract',
    'contract_id',
    'contractId',
  ]);
  const declaredVersion = pickString({ ...payload, ...meta, ...manifest }, ['version', 'contract_version', 'contractVersion', 'schema_version', 'schemaVersion']);
  const normalizedDeclaredId = declaredId?.toUpperCase();

  if (
    normalizedDeclaredId
    && normalizedDeclaredId !== 'FORGE_PLAYER_STATIC_V1'
    && normalizedDeclaredId !== 'FORGE_PLAYER_STATIC'
    && !normalizedDeclaredId.includes('FORGE_PLAYER_STATIC_V1')
  ) {
    throw new ForgePlayerStaticIntegrationError(
      'unsupported',
      `Unsupported FORGE static artifact (${declaredId}); expected FORGE_PLAYER_STATIC_V1.`,
      422,
      'unsupported',
    );
  }

  if (declaredVersion && !String(declaredVersion).toLowerCase().includes('v1') && !String(declaredVersion).startsWith('1')) {
    throw new ForgePlayerStaticIntegrationError(
      'unsupported',
      `Unsupported FORGE static artifact version (${declaredVersion}); expected v1.`,
      422,
      'unsupported',
    );
  }
}

function normalizeRow(row: unknown): ForgePlayerStaticRow {
  const record = toRecord(row);
  const score = toRecord(record.score);
  const scores = toRecord(record.scores);
  const provenance = toRecord(record.provenance);
  const nested = { ...record, score, scores };

  const playerId = pickString(nested, [
    'player_id',
    'playerId',
    'canonical_player_id',
    'canonicalPlayerId',
    'tiber_id',
    'tiberId',
  ]);
  if (!playerId) {
    throw new ForgePlayerStaticIntegrationError(
      'invalid_payload',
      'FORGE_PLAYER_STATIC_V1 row is missing a canonical player ID.',
      502,
      'malformed',
    );
  }

  const scoreSource = normalizeScoreSource(provenance.score_source ?? provenance.scoreSource);
  const alpha = pickNumber(nested, [
    'forge_alpha',
    'forgeAlpha',
    'alpha',
    'alpha_final',
    'alphaFinal',
    'score.forge_alpha',
    'score.forgeAlpha',
    'score.alpha',
    'score.alpha_final',
    'scores.forge_alpha',
    'scores.forgeAlpha',
    'scores.alpha',
    'scores.alphaFinal',
  ]);

  return {
    playerId,
    playerName: pickString(nested, ['player_name', 'playerName', 'name', 'full_name', 'fullName']),
    position: pickString(nested, ['position', 'pos']),
    team: pickString(nested, ['team', 'nfl_team', 'nflTeam']),
    alpha,
    tier: pickNumber(nested, ['forge_tier', 'forgeTier', 'tier', 'tier_final', 'tierFinal', 'score.tier_rank', 'score.tierRank'])
      ?? pickString(nested, ['forge_tier', 'forgeTier', 'tier', 'tier_label', 'tierLabel', 'score.forge_tier', 'score.forgeTier', 'score.tier']),
    confidence: pickNumber(nested, ['confidence.score', 'confidence.value', 'confidence', 'confidence_score', 'confidenceScore', 'score.confidence']),
    scoreSource,
    isPlayerSpecificEvidence: scoreSource === 'player_specific' && typeof alpha === 'number',
    isGeneratedBaselineVisibility: scoreSource === 'generated_baseline' && typeof alpha === 'number',
    provenance,
    raw: record,
  };
}

export function adaptForgePlayerStaticArtifact(payload: unknown, sourcePath: string): ForgePlayerStaticLookup {
  const record = toRecord(payload);
  if (Object.keys(record).length === 0) {
    throw new ForgePlayerStaticIntegrationError(
      'invalid_payload',
      'FORGE_PLAYER_STATIC_V1 artifact must be a JSON object.',
      502,
      'malformed',
    );
  }

  assertSupportedArtifact(record);

  const rows = pickRows(record);
  if (rows.length === 0) {
    throw new ForgePlayerStaticIntegrationError(
      'invalid_payload',
      'FORGE_PLAYER_STATIC_V1 artifact has no rows.',
      502,
      'malformed',
    );
  }

  const rowsByPlayerId = new Map<string, ForgePlayerStaticRow>();
  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    if (rowsByPlayerId.has(row.playerId)) {
      throw new ForgePlayerStaticIntegrationError(
        'duplicate_ids',
        `FORGE_PLAYER_STATIC_V1 artifact contains duplicate player ID ${row.playerId}.`,
        502,
        'duplicate_ids',
      );
    }
    rowsByPlayerId.set(row.playerId, row);
  }

  const meta = toRecord(record.meta ?? record.metadata ?? {});
  const manifest = toRecord(record.consumer_manifest ?? record.downstream_consumer_manifest ?? record.manifest ?? {});
  const playerSpecificCount = Array.from(rowsByPlayerId.values()).filter((row) => row.isPlayerSpecificEvidence).length;
  const generatedBaselineCount = Array.from(rowsByPlayerId.values()).filter((row) => row.isGeneratedBaselineVisibility).length;

  return {
    artifact: {
      state: 'available',
      available: true,
      reason: null,
      code: null,
      sourcePath,
      artifactId: 'FORGE_PLAYER_STATIC_V1',
      contractVersion: pickString({ ...record, ...meta, ...manifest }, ['contract_version', 'contractVersion', 'version', 'schema_version', 'schemaVersion']),
      generatedAt: pickString({ ...record, ...meta, ...manifest }, ['generated_at', 'generatedAt', 'promoted_at', 'promotedAt']),
      rowCount: rowsByPlayerId.size,
      playerSpecificCount,
      generatedBaselineCount,
      nonEvidenceCount: rowsByPlayerId.size - playerSpecificCount - generatedBaselineCount,
    },
    rowsByPlayerId,
  };
}

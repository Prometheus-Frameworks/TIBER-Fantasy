import {
  TiberIdentityCrosswalkIntegrationError,
  TiberIdentityCrosswalkLookup,
  TiberIdentityCrosswalkProviderMapping,
} from './tiberIdentityCrosswalkTypes';

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
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeProvider(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'sleeper_id') return 'sleeper';
  return normalized;
}

function providerKey(provider: string, providerId: string): string {
  return `${provider}:${providerId}`;
}

function pickRows(payload: Record<string, unknown>): unknown[] {
  for (const candidate of [payload.records, payload.rows, payload.mappings, payload.data, payload.players]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
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
    && normalizedDeclaredId !== 'TIBER_IDENTITY_CROSSWALK_V1'
    && normalizedDeclaredId !== 'TIBER_IDENTITY_CROSSWALK'
    && !normalizedDeclaredId.includes('TIBER_IDENTITY_CROSSWALK_V1')
  ) {
    throw new TiberIdentityCrosswalkIntegrationError(
      'unsupported',
      `Unsupported TIBER identity crosswalk artifact (${declaredId}); expected TIBER_IDENTITY_CROSSWALK_V1.`,
      422,
      'unsupported',
    );
  }

  if (declaredVersion && !String(declaredVersion).toLowerCase().includes('v1') && !String(declaredVersion).startsWith('1')) {
    throw new TiberIdentityCrosswalkIntegrationError(
      'unsupported',
      `Unsupported TIBER identity crosswalk artifact version (${declaredVersion}); expected v1.`,
      422,
      'unsupported',
    );
  }
}

function normalizeProviderMappingsFromRow(row: unknown): TiberIdentityCrosswalkProviderMapping[] {
  const record = toRecord(row);
  const ids = toRecord(record.ids ?? record.provider_ids ?? record.providerIds ?? record.external_ids ?? record.externalIds);
  const tiberPlayerId = pickString({ ...record, ids }, [
    'tiber_player_id',
    'tiberPlayerId',
    'tiber_id',
    'tiberId',
    'canonical_player_id',
    'canonicalPlayerId',
    'player_id',
    'playerId',
    'ids.tiber',
    'ids.tiber_player_id',
  ]);

  if (!tiberPlayerId) {
    throw new TiberIdentityCrosswalkIntegrationError(
      'invalid_payload',
      'TIBER_IDENTITY_CROSSWALK_V1 row is missing a TIBER canonical player ID.',
      502,
      'malformed',
    );
  }

  const playerName = pickString(record, ['player_name', 'playerName', 'name', 'full_name', 'fullName']);
  const position = pickString(record, ['position', 'pos']);
  const mappings: TiberIdentityCrosswalkProviderMapping[] = [];

  const provider = normalizeProvider(pickString(record, ['provider', 'source', 'platform']));
  const providerId = pickString(record, ['provider_player_id', 'providerPlayerId', 'provider_id', 'providerId', 'external_id', 'externalId', 'id_value', 'idValue']);
  const providerCanonicalId = pickString(record, ['provider_canonical_id', 'providerCanonicalId']);
  if (provider && providerId) {
    mappings.push({
      provider,
      providerId,
      providerCanonicalId: providerCanonicalId ?? providerKey(provider, providerId),
      tiberPlayerId,
      playerName,
      position,
      raw: record,
    });
  }

  for (const [rawProvider, rawProviderId] of Object.entries(ids)) {
    const nested = toRecord(rawProviderId);
    const normalizedProvider = normalizeProvider(rawProvider);
    const idValue = typeof rawProviderId === 'string' || typeof rawProviderId === 'number'
      ? String(rawProviderId)
      : pickString(nested, ['id', 'provider_id', 'providerId', 'value']);
    if (!normalizedProvider || normalizedProvider === 'tiber' || !idValue) continue;
    mappings.push({
      provider: normalizedProvider,
      providerId: idValue,
      providerCanonicalId: providerKey(normalizedProvider, idValue),
      tiberPlayerId,
      playerName,
      position,
      raw: record,
    });
  }

  const nestedMappings = record.provider_mappings ?? record.providerMappings ?? record.identities ?? record.external_mappings ?? record.externalMappings;
  if (Array.isArray(nestedMappings)) {
    for (const nestedRow of nestedMappings) {
      const nested = toRecord(nestedRow);
      const nestedProvider = normalizeProvider(pickString(nested, ['provider', 'source', 'platform']));
      const nestedProviderId = pickString(nested, ['provider_player_id', 'providerPlayerId', 'provider_id', 'providerId', 'external_id', 'externalId', 'id', 'value']);
      const nestedProviderCanonicalId = pickString(nested, ['provider_canonical_id', 'providerCanonicalId']);
      if (!nestedProvider || !nestedProviderId) continue;
      mappings.push({
        provider: nestedProvider,
        providerId: nestedProviderId,
        providerCanonicalId: nestedProviderCanonicalId ?? providerKey(nestedProvider, nestedProviderId),
        tiberPlayerId,
        playerName,
        position,
        raw: record,
      });
    }
  }

  const uniqueByProviderKey = new Map<string, TiberIdentityCrosswalkProviderMapping>();
  for (const mapping of mappings) {
    uniqueByProviderKey.set(mapping.providerCanonicalId, mapping);
  }
  return Array.from(uniqueByProviderKey.values());
}

export function adaptTiberIdentityCrosswalkArtifact(payload: unknown, sourcePath: string): TiberIdentityCrosswalkLookup {
  const record = toRecord(payload);
  if (Object.keys(record).length === 0) {
    throw new TiberIdentityCrosswalkIntegrationError(
      'invalid_payload',
      'TIBER_IDENTITY_CROSSWALK_V1 artifact must be a JSON object.',
      502,
      'malformed',
    );
  }

  assertSupportedArtifact(record);

  const rows = pickRows(record);
  if (rows.length === 0) {
    throw new TiberIdentityCrosswalkIntegrationError(
      'invalid_payload',
      'TIBER_IDENTITY_CROSSWALK_V1 artifact has no rows.',
      502,
      'malformed',
    );
  }

  const mappings: TiberIdentityCrosswalkProviderMapping[] = [];
  const tiberPlayerIdsByProviderKey = new Map<string, string>();
  const seenProviderIdKeys = new Set<string>();
  for (const rawRow of rows) {
    const rowMappings = normalizeProviderMappingsFromRow(rawRow);
    if (rowMappings.length === 0) {
      throw new TiberIdentityCrosswalkIntegrationError(
        'invalid_payload',
        'TIBER_IDENTITY_CROSSWALK_V1 row has no provider mappings.',
        502,
        'malformed',
      );
    }
    for (const mapping of rowMappings) {
      const normalizedProviderIdKey = providerKey(mapping.provider, mapping.providerId);
      if (tiberPlayerIdsByProviderKey.has(mapping.providerCanonicalId) || seenProviderIdKeys.has(normalizedProviderIdKey)) {
        throw new TiberIdentityCrosswalkIntegrationError(
          'duplicate_ids',
          `TIBER_IDENTITY_CROSSWALK_V1 artifact contains duplicate provider mapping ${mapping.providerCanonicalId}.`,
          502,
          'duplicate_ids',
        );
      }
      seenProviderIdKeys.add(normalizedProviderIdKey);
      tiberPlayerIdsByProviderKey.set(mapping.providerCanonicalId, mapping.tiberPlayerId);
      if (mapping.provider === 'sleeper') {
        tiberPlayerIdsByProviderKey.set(mapping.providerId, mapping.tiberPlayerId);
      }
      mappings.push(mapping);
    }
  }

  const meta = toRecord(record.meta ?? record.metadata ?? {});
  const manifest = toRecord(record.consumer_manifest ?? record.downstream_consumer_manifest ?? record.manifest ?? {});
  const providerCount = new Set(mappings.map((mapping) => mapping.provider)).size;

  return {
    artifact: {
      state: 'available',
      available: true,
      reason: null,
      code: null,
      sourcePath,
      artifactId: 'TIBER_IDENTITY_CROSSWALK_V1',
      contractVersion: pickString({ ...record, ...meta, ...manifest }, ['contract_version', 'contractVersion', 'version', 'schema_version', 'schemaVersion']),
      generatedAt: pickString({ ...record, ...meta, ...manifest }, ['generated_at', 'generatedAt', 'promoted_at', 'promotedAt']),
      rowCount: rows.length,
      providerMappingCount: mappings.length,
      providerCount,
    },
    rows: mappings,
    tiberPlayerIdsByProviderKey,
  };
}

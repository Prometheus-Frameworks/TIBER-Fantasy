import { adaptTiberIdentityCrosswalkArtifact } from '../tiberIdentityCrosswalkAdapter';
import { TiberIdentityCrosswalkIntegrationError } from '../tiberIdentityCrosswalkTypes';

const producerPayload = {
  artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1',
  schema_version: 'v1',
  generated_at: '2026-06-08T00:00:00.000Z',
  supported_providers: ['sleeper'],
  coverage: {
    provider_record_counts: { sleeper: 3 },
    total_records: 3,
  },
  record_count: 3,
  records: [
    {
      provider: 'sleeper',
      provider_player_id: '6797',
      provider_canonical_id: 'sleeper:6797',
      tiber_player_id: 'tiber-data-player-2025-justin-herbert',
      player_name: 'Justin Herbert',
      position: 'QB',
      team: 'LAC',
      confidence: 1,
      match_method: 'promoted_identity_crosswalk',
      source: 'TIBER-Data',
      source_updated_at: '2026-06-08T00:00:00.000Z',
    },
    {
      provider: 'sleeper',
      provider_player_id: '9493',
      provider_canonical_id: 'sleeper:9493',
      tiber_player_id: 'tiber-data-player-2025-puka-nacua',
      player_name: 'Puka Nacua',
      position: 'WR',
      team: 'LAR',
      confidence: 1,
      match_method: 'promoted_identity_crosswalk',
      source: 'TIBER-Data',
      source_updated_at: '2026-06-08T00:00:00.000Z',
    },
    {
      provider: 'sleeper',
      provider_player_id: '9509',
      provider_canonical_id: 'sleeper:9509',
      tiber_player_id: 'tiber-data-player-2025-bijan-robinson',
      player_name: 'Bijan Robinson',
      position: 'RB',
      team: 'ATL',
      confidence: 1,
      match_method: 'promoted_identity_crosswalk',
      source: 'TIBER-Data',
      source_updated_at: '2026-06-08T00:00:00.000Z',
    },
  ],
};

describe('TIBER_IDENTITY_CROSSWALK_V1 adapter', () => {
  it('consumes the producer records[] artifact shape without reshaping it in Fantasy', () => {
    const lookup = adaptTiberIdentityCrosswalkArtifact(producerPayload, '/tmp/tiber_identity_crosswalk_v1.json');

    expect(lookup.artifact).toEqual(expect.objectContaining({
      available: true,
      artifactId: 'TIBER_IDENTITY_CROSSWALK_V1',
      contractVersion: 'v1',
      rowCount: 3,
      providerMappingCount: 3,
      providerCount: 1,
    }));
    expect(lookup.rows[0].raw).toEqual(expect.objectContaining({
      provider_player_id: '6797',
      provider_canonical_id: 'sleeper:6797',
      confidence: 1,
      match_method: 'promoted_identity_crosswalk',
      source: 'TIBER-Data',
      source_updated_at: '2026-06-08T00:00:00.000Z',
    }));
  });

  it.each([
    ['6797', 'tiber-data-player-2025-justin-herbert'],
    ['sleeper:6797', 'tiber-data-player-2025-justin-herbert'],
    ['9493', 'tiber-data-player-2025-puka-nacua'],
    ['sleeper:9493', 'tiber-data-player-2025-puka-nacua'],
    ['9509', 'tiber-data-player-2025-bijan-robinson'],
    ['sleeper:9509', 'tiber-data-player-2025-bijan-robinson'],
  ])('resolves %s to %s from producer records[]', (lookupKey, expectedTiberPlayerId) => {
    const lookup = adaptTiberIdentityCrosswalkArtifact(producerPayload, '/tmp/tiber_identity_crosswalk_v1.json');

    expect(lookup.tiberPlayerIdsByProviderKey.get(lookupKey)).toBe(expectedTiberPlayerId);
  });

  it('normalizes compact ids objects into provider mappings', () => {
    const lookup = adaptTiberIdentityCrosswalkArtifact({
      meta: { artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1', contract_version: 'v1' },
      rows: [{ tiber_player_id: 'tiber-data-player-2025-puka-nacua', ids: { sleeper: '9493' } }],
    }, '/tmp/tiber_identity_crosswalk_v1.json');

    expect(lookup.tiberPlayerIdsByProviderKey.get('9493')).toBe('tiber-data-player-2025-puka-nacua');
    expect(lookup.tiberPlayerIdsByProviderKey.get('sleeper:9493')).toBe('tiber-data-player-2025-puka-nacua');
  });

  it('fails closed for malformed producer rows without TIBER canonical player IDs', () => {
    expect(() => adaptTiberIdentityCrosswalkArtifact({
      artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1',
      schema_version: 'v1',
      records: [{ provider: 'sleeper', provider_player_id: '6797', provider_canonical_id: 'sleeper:6797' }],
    }, '/tmp/tiber_identity_crosswalk_v1.json')).toThrow(TiberIdentityCrosswalkIntegrationError);
  });

  it('fails closed for duplicate producer provider mappings', () => {
    expect(() => adaptTiberIdentityCrosswalkArtifact({
      artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1',
      schema_version: 'v1',
      records: [
        { provider: 'sleeper', provider_player_id: '6797', provider_canonical_id: 'sleeper:6797', tiber_player_id: 'tiber-data-player-2025-justin-herbert' },
        { provider: 'sleeper', provider_player_id: '6797', provider_canonical_id: 'sleeper:6797', tiber_player_id: 'tiber-data-player-2025-other' },
      ],
    }, '/tmp/tiber_identity_crosswalk_v1.json')).toThrow(/duplicate provider mapping/);
  });


  it('fails closed for duplicate producer provider IDs even if canonical IDs differ', () => {
    expect(() => adaptTiberIdentityCrosswalkArtifact({
      artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1',
      schema_version: 'v1',
      records: [
        { provider: 'sleeper', provider_player_id: '6797', provider_canonical_id: 'sleeper:6797', tiber_player_id: 'tiber-data-player-2025-justin-herbert' },
        { provider: 'sleeper', provider_player_id: '6797', provider_canonical_id: 'sleeper:duplicate-6797', tiber_player_id: 'tiber-data-player-2025-other' },
      ],
    }, '/tmp/tiber_identity_crosswalk_v1.json')).toThrow(/duplicate provider mapping/);
  });

  it('fails closed for unsupported artifact IDs', () => {
    expect(() => adaptTiberIdentityCrosswalkArtifact({
      artifact_id: 'OTHER_ARTIFACT',
      schema_version: 'v1',
      records: [{ provider: 'sleeper', provider_player_id: '1', provider_canonical_id: 'sleeper:1', tiber_player_id: 'p1' }],
    }, '/tmp/tiber_identity_crosswalk_v1.json')).toThrow(/Unsupported TIBER identity crosswalk artifact/);
  });
});

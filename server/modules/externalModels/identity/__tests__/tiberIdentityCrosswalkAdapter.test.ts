import { adaptTiberIdentityCrosswalkArtifact } from '../tiberIdentityCrosswalkAdapter';
import { TiberIdentityCrosswalkIntegrationError } from '../tiberIdentityCrosswalkTypes';

const validPayload = {
  meta: { artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1', contract_version: 'v1', generated_at: '2026-06-08T00:00:00.000Z' },
  rows: [
    {
      tiber_player_id: 'tiber-data-player-2025-justin-herbert',
      player_name: 'Justin Herbert',
      position: 'QB',
      provider_mappings: [{ provider: 'sleeper', provider_id: '6797' }],
    },
  ],
};

describe('TIBER_IDENTITY_CROSSWALK_V1 adapter', () => {
  it('normalizes valid provider mappings and supports prefixed Sleeper lookup keys', () => {
    const lookup = adaptTiberIdentityCrosswalkArtifact(validPayload, '/tmp/tiber_identity_crosswalk_v1.json');

    expect(lookup.artifact).toEqual(expect.objectContaining({
      available: true,
      artifactId: 'TIBER_IDENTITY_CROSSWALK_V1',
      rowCount: 1,
      providerMappingCount: 1,
      providerCount: 1,
    }));
    expect(lookup.tiberPlayerIdsByProviderKey.get('sleeper:6797')).toBe('tiber-data-player-2025-justin-herbert');
  });

  it('normalizes compact ids objects into provider mappings', () => {
    const lookup = adaptTiberIdentityCrosswalkArtifact({
      meta: { artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1', contract_version: 'v1' },
      rows: [{ tiber_player_id: 'tiber-data-player-2025-puka-nacua', ids: { sleeper: '9493' } }],
    }, '/tmp/tiber_identity_crosswalk_v1.json');

    expect(lookup.tiberPlayerIdsByProviderKey.get('sleeper:9493')).toBe('tiber-data-player-2025-puka-nacua');
  });

  it('fails closed for malformed rows without TIBER canonical player IDs', () => {
    expect(() => adaptTiberIdentityCrosswalkArtifact({
      meta: { artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1', contract_version: 'v1' },
      rows: [{ provider_mappings: [{ provider: 'sleeper', provider_id: '6797' }] }],
    }, '/tmp/tiber_identity_crosswalk_v1.json')).toThrow(TiberIdentityCrosswalkIntegrationError);
  });

  it('fails closed for duplicate provider mappings', () => {
    expect(() => adaptTiberIdentityCrosswalkArtifact({
      meta: { artifact_id: 'TIBER_IDENTITY_CROSSWALK_V1', contract_version: 'v1' },
      rows: [
        { tiber_player_id: 'tiber-data-player-2025-justin-herbert', provider_mappings: [{ provider: 'sleeper', provider_id: '6797' }] },
        { tiber_player_id: 'tiber-data-player-2025-other', provider_mappings: [{ provider: 'sleeper', provider_id: '6797' }] },
      ],
    }, '/tmp/tiber_identity_crosswalk_v1.json')).toThrow(/duplicate provider mapping/);
  });

  it('fails closed for unsupported artifact IDs', () => {
    expect(() => adaptTiberIdentityCrosswalkArtifact({
      meta: { artifact_id: 'OTHER_ARTIFACT', contract_version: 'v1' },
      rows: [{ tiber_player_id: 'p1', provider_mappings: [{ provider: 'sleeper', provider_id: '1' }] }],
    }, '/tmp/tiber_identity_crosswalk_v1.json')).toThrow(/Unsupported TIBER identity crosswalk artifact/);
  });
});

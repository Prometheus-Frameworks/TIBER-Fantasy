import { TiberIdentityCrosswalkService } from '../tiberIdentityCrosswalkService';
import { TiberIdentityCrosswalkIntegrationError } from '../tiberIdentityCrosswalkTypes';

describe('TiberIdentityCrosswalkService', () => {
  it('returns unavailable lookup when the promoted artifact is missing', async () => {
    const service = new TiberIdentityCrosswalkService({
      getConfig: () => ({ enabled: true, artifactPath: '/tmp/missing.json', sourcePath: '/tmp/missing.json', configured: true }),
      loadPromotedArtifact: async () => {
        throw new TiberIdentityCrosswalkIntegrationError(
          'not_found',
          'TIBER_IDENTITY_CROSSWALK_V1 artifact is missing.',
          404,
          'missing',
        );
      },
    });

    const lookup = await service.getLookup();
    expect(lookup.artifact).toEqual(expect.objectContaining({
      available: false,
      state: 'missing',
      code: 'not_found',
      artifactId: 'TIBER_IDENTITY_CROSSWALK_V1',
    }));
    expect(lookup.tiberPlayerIdsByProviderKey.size).toBe(0);
  });
});

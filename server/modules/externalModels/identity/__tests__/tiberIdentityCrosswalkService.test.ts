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

  it('loads the bundled expanded TIBER-Data artifact through the service boundary', async () => {
    const artifactPath = `${process.cwd()}/server/artifacts/external/identity/tiber_identity_crosswalk_v1.json`;
    const service = new TiberIdentityCrosswalkService({
      getConfig: () => ({ enabled: true, artifactPath, sourcePath: artifactPath, configured: true }),
      loadPromotedArtifact: async () => ({
        payload: JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(artifactPath, 'utf8'))),
        sourcePath: artifactPath,
      }),
    });

    const lookup = await service.getLookup();

    expect(lookup.artifact).toEqual(expect.objectContaining({
      available: true,
      rowCount: 68,
      providerMappingCount: 68,
      providerCount: 1,
    }));
    expect(lookup.tiberPlayerIdsByProviderKey.get('sleeper:11635')).toBe('00-0039915');
    expect(lookup.tiberPlayerIdsByProviderKey.get('sleeper:11624')).toBe('00-0039894');
  });

});

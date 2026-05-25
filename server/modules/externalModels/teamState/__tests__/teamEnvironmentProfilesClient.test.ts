import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { TeamEnvironmentProfilesClient } from '../teamEnvironmentProfilesClient';

describe('TeamEnvironmentProfilesClient', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'team-env-profiles-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('accepts sourceSnapshotAt as null per Teamstate v0 contract', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_profiles_v0.json');
    await writeFile(
      artifactPath,
      JSON.stringify({
        artifact: 'team_environment_profiles_v0',
        generatedAt: '2026-05-25T00:00:00.000Z',
        season: 2026,
        profiles: [
          {
            teamAbbr: 'BUF',
            offenseTier: 'elite',
            passEnvironmentTier: 'pass_heavy',
            paceTier: 'fast',
            volatilityTier: 'stable',
            marketTier: null,
            sourceSnapshotAt: null,
            warnings: [],
            signals: [],
          },
        ],
      }),
      'utf8',
    );

    const client = new TeamEnvironmentProfilesClient(artifactPath);
    const result = await client.readArtifact();

    expect(result.available).toBe(true);
    expect(result.artifact?.artifact).toBe('team_environment_profiles_v0');
    expect(result.artifact?.profiles[0].sourceSnapshotAt).toBeNull();
  });
});

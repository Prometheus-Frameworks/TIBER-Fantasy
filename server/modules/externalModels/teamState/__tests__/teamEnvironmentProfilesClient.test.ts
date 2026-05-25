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

  it('accepts real v0 shape with teamAbbr and artifact token', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_profiles_v0.json');
    await writeFile(artifactPath, JSON.stringify({
      artifact: 'team_environment_profiles_v0',
      profiles: [{
        teamId: 'nfl-buf', teamAbbr: 'BUF', season: 2026,
        generatedAt: '2026-05-25T00:00:00.000Z', sourceSnapshotAt: '2026-05-25T00:00:00.000Z',
        marketTier: null, offenseTier: 'elite', passEnvironmentTier: 'pass_heavy', paceTier: 'fast', volatilityTier: 'stable',
        signals: {}, warnings: ['ok'],
      }],
    }), 'utf8');

    const client = new TeamEnvironmentProfilesClient(artifactPath);
    const result = await client.readArtifact();
    expect(result.available).toBe(true);
    expect(result.artifact?.artifact).toBe('team_environment_profiles_v0');
    expect(result.artifact?.profiles[0].teamAbbr).toBe('BUF');
  });

  it('rejects legacy nested team.abbreviation shape', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_profiles_v0.json');
    await writeFile(artifactPath, JSON.stringify({ artifact: 'team_environment_profiles_v0', profiles: [{ team: { abbreviation: 'BUF' } }] }), 'utf8');
    const client = new TeamEnvironmentProfilesClient(artifactPath);
    const result = await client.readArtifact();
    expect(result.available).toBe(false);
    expect(result.warnings[0]).toMatch(/invalid_payload/);
  });
});

import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { TeamEnvironmentProfilesClient } from '../teamEnvironmentProfilesClient';

const baseProfile = {
  contractVersion: 'team_environment_profile_v0', teamId: 'nfl-buf', teamAbbr: 'BUF', season: 2026, generatedAt: '2026-05-25T00:00:00.000Z',
  marketTier: 'strong', offenseTier: 'elite', passEnvironmentTier: 'pass_heavy', paceTier: 'fast', volatilityTier: 'stable', signals: [], warnings: [],
};

describe('TeamEnvironmentProfilesClient', () => {
  let tmpDir: string;
  beforeEach(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), 'team-env-client-')); });
  afterEach(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it('accepts real shape with top-level teamAbbr and sourceSnapshotAt string/null', async () => {
    const p = path.join(tmpDir, 'team_environment_profiles_v0.json');
    await writeFile(p, JSON.stringify({ artifact: 'team_environment_profiles_v0', generatedAt: 'x', sourceArtifacts: [], profiles: [{ ...baseProfile, sourceSnapshotAt: '2026-05-24T00:00:00.000Z' }, { ...baseProfile, teamAbbr: 'PHI', sourceSnapshotAt: null }] }));
    const out = await new TeamEnvironmentProfilesClient(p).readArtifact();
    expect(out?.profiles[0].teamAbbr).toBe('BUF');
    expect(out?.profiles[1].sourceSnapshotAt).toBeNull();
  });

  it('rejects legacy/wrong profile.team.abbreviation shape', async () => {
    const p = path.join(tmpDir, 'team_environment_profiles_v0.json');
    await writeFile(p, JSON.stringify({ artifact: 'team_environment_profiles_v0', generatedAt: 'x', sourceArtifacts: [], profiles: [{ contractVersion: 'team_environment_profile_v0', team: { abbreviation: 'BUF' } }] }));
    await expect(new TeamEnvironmentProfilesClient(p).readArtifact()).rejects.toThrow(/shape/i);
  });
});

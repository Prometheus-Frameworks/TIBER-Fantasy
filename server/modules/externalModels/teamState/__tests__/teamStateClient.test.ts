import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { TeamStateClient } from '../teamStateClient';
import { TeamStateIntegrationError } from '../types';

function buildValidArtifact() {
  return {
    generatedAt: '2026-04-02T00:00:00.000Z',
    artifact: 'tiber_team_state_v0_1',
    source: {
      provider: 'tiber-data',
      season: 2025,
      throughWeek: 17,
      seasonType: 'REG',
      gamesIncluded: 17,
      notes: ['test export'],
    },
    definitions: {
      confidenceBand: ['high', 'mid', 'low'],
    },
    teams: [
      {
        team: 'BUF',
        sample: {
          games: 17,
          plays: 1020,
          neutralPlays: 700,
          earlyDownPlays: 550,
          redZonePlays: 75,
          drives: 180,
        },
        features: {
          neutralPassRate: 0.57,
          earlyDownPassRate: 0.55,
          earlyDownSuccessRate: 0.5,
          redZonePassRate: 0.53,
          redZoneTdEfficiency: 0.69,
          explosivePlayRate: 0.12,
          driveSustainRate: 0.72,
          paceSecondsPerPlay: 27.9,
        },
        stability: {
          sampleFlag: 'stable',
          confidenceBand: 'high',
          notes: ['full season'],
        },
      },
    ],
  };
}

describe('TeamStateClient artifact validation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'team-state-client-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('accepts valid team state artifacts', async () => {
    const artifactPath = path.join(tmpDir, 'tiber_team_state_v0_1_2025.json');
    await writeFile(artifactPath, JSON.stringify(buildValidArtifact()), 'utf8');

    const client = new TeamStateClient({ exportsDir: tmpDir, enabled: true });
    const result = await client.readTeamStateArtifact({ season: 2025 });

    expect(result.season).toBe(2025);
    expect(result.throughWeek).toBeNull();
    expect((result.data as any).artifact).toBe('tiber_team_state_v0_1');
  });

  it('rejects parseable JSON that does not satisfy team state contract shape', async () => {
    const artifactPath = path.join(tmpDir, 'tiber_team_state_v0_1_2025.json');
    await writeFile(
      artifactPath,
      JSON.stringify({
        generatedAt: '2026-04-02T00:00:00.000Z',
        artifact: 'tiber_team_state_v0_1',
        source: { provider: 'tiber-data', season: 2025, throughWeek: 17, seasonType: 'REG', gamesIncluded: 17, notes: [] },
        definitions: {},
        teams: [{ team: 'BUF', sample: { games: 17 }, features: {}, stability: {} }],
      }),
      'utf8',
    );

    const client = new TeamStateClient({ exportsDir: tmpDir, enabled: true });

    await expect(client.readTeamStateArtifact({ season: 2025 })).rejects.toMatchObject<TeamStateIntegrationError>({
      code: 'invalid_payload',
      status: 502,
    });
  });
});

import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { TeamEnvironmentMovementClient } from '../teamEnvironmentMovementClient';
import { TeamEnvironmentMovementService } from '../teamEnvironmentMovementService';

const validArtifact = {
  artifact: 'team_environment_movement_v0',
  generatedAt: '2026-05-30T00:00:00.000Z',
  metadata: {
    provenanceStatus: 'fixture_scaffold',
    inputSources: ['team_week_raw_v0.tampa_bay_temporal.sample.json'],
    coverage: {
      teamCount: 1,
      teams: ['TB'],
      seasons: [2025],
      weeks: [1, 2, 3, 4, 5, 6, 7, 8],
      latestWeek: 8,
      isFullLeague: false,
    },
  },
  teams: [
    {
      teamId: 'nfl-tb',
      teamAbbr: 'TB',
      season: 2025,
      weeksCovered: [1, 2, 3, 4, 5, 6, 7, 8],
      earlyWindow: { weeks: [1, 2, 3, 4], offensiveEnvironmentScore: 0.61 },
      lateWindow: { weeks: [5, 6, 7, 8], offensiveEnvironmentScore: 0.42 },
      deltas: { offensiveEnvironmentScore: -0.19, pressureRate: 0.08 },
      movement: {
        offenseDirection: 'declining',
        passEnvironmentDirection: 'more_pass_heavy',
        paceDirection: 'stable',
        pressureDirection: 'worsening',
        volatilityDirection: 'more_volatile',
        verdict: 'offensive_environment_declining_pressure_worsening',
      },
      warnings: ['fixture/synthetic Teamstate movement artifact; do not treat as governed production truth'],
    },
  ],
};

describe('TeamEnvironmentMovementService', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'team-env-movement-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function serviceFor(artifactPath: string) {
    return new TeamEnvironmentMovementService(new TeamEnvironmentMovementClient(artifactPath));
  }

  it('reads the Teamstate-shaped movement artifact and preserves provenance and coverage', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_movement_v0.json');
    await writeFile(artifactPath, JSON.stringify(validArtifact));

    const result = await serviceFor(artifactPath).getMovement();

    expect(result.artifactAvailable).toBe(true);
    expect(result.provenanceStatus).toBe('fixture_scaffold');
    expect(result.inputSources).toEqual(['team_week_raw_v0.tampa_bay_temporal.sample.json']);
    expect(result.coverage).toEqual(expect.objectContaining({ teamCount: 1, latestWeek: 8, isFullLeague: false, teams: ['TB'] }));
    expect(result.teams[0]).toEqual(expect.objectContaining({
      team: 'TB',
      teamId: 'nfl-tb',
      teamAbbr: 'TB',
      weeksCovered: [1, 2, 3, 4, 5, 6, 7, 8],
      offenseDirection: 'declining',
      pressureDirection: 'worsening',
      passEnvironmentDirection: 'more_pass_heavy',
      paceDirection: 'stable',
      volatilityDirection: 'more_volatile',
      verdict: 'offensive_environment_declining_pressure_worsening',
    }));
    expect(result.teams[0].raw).toEqual(validArtifact.teams[0]);
    expect(result.warnings).toContain('fixture/synthetic Teamstate movement artifact; do not treat as governed production truth');
  });

  it('returns explicit unavailable state for a missing artifact', async () => {
    const result = await serviceFor(path.join(tmpDir, 'missing.json')).getMovement();

    expect(result.artifactAvailable).toBe(false);
    expect(result.state).toBe('unavailable');
    expect(result.errors[0].code).toBe('TEAM_ENVIRONMENT_MOVEMENT_NOT_FOUND');
    expect(result.teams).toEqual([]);
  });

  it('fails closed for a wrong artifact literal', async () => {
    const artifactPath = path.join(tmpDir, 'wrong.json');
    await writeFile(artifactPath, JSON.stringify({ ...validArtifact, artifact: 'team_environment_profiles_v0' }));

    const result = await serviceFor(artifactPath).getMovement();

    expect(result.artifactAvailable).toBe(false);
    expect(result.state).toBe('error');
    expect(result.errors[0].code).toBe('invalid_payload');
    expect(result.teams).toEqual([]);
  });

  it('fails closed for malformed movement entries', async () => {
    const artifactPath = path.join(tmpDir, 'malformed.json');
    await writeFile(artifactPath, JSON.stringify({ ...validArtifact, teams: [{ movement: { offenseDirection: 'declining' } }] }));

    const result = await serviceFor(artifactPath).getMovement();

    expect(result.artifactAvailable).toBe(false);
    expect(result.state).toBe('error');
    expect(result.errors[0].code).toBe('invalid_payload');
  });

  it('looks up a Teamstate-shaped TB movement entry by abbreviation', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_movement_v0.json');
    await writeFile(artifactPath, JSON.stringify(validArtifact));

    const result = await serviceFor(artifactPath).getMovement('tb');

    expect(result.artifactAvailable).toBe(true);
    expect(result.provenanceStatus).toBe('fixture_scaffold');
    expect(result.coverage?.teams).toEqual(['TB']);
    expect(result.selectedTeam).toEqual(expect.objectContaining({
      team: 'TB',
      offenseDirection: 'declining',
      pressureDirection: 'worsening',
      verdict: 'offensive_environment_declining_pressure_worsening',
    }));
    expect(result.teams).toEqual([]);
  });
});

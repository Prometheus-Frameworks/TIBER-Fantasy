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

// team_environment_movement_v1: team-state-only successor. Note it carries NO fantasyPointsFor*
// fields in either window averages or deltas — the consumer must not require them.
const validArtifactV1 = {
  artifact: 'team_environment_movement_v1',
  generatedAt: '2026-06-16T00:32:37.853Z',
  metadata: {
    provenanceStatus: 'fixture_scaffold',
    inputSources: ['team_week_raw_v0.movement_demo.sample.json'],
    coverage: {
      teamCount: 1,
      teams: ['DET'],
      seasons: [2025],
      weeks: [1, 2, 3, 4, 5, 6],
      latestWeek: 6,
      isFullLeague: false,
    },
  },
  teams: [
    {
      teamId: 'DET',
      teamAbbr: 'DET',
      season: 2025,
      weeksCovered: [1, 2, 3, 4, 5, 6],
      earlyWindow: {
        weeks: [1, 2, 3],
        games: 3,
        averages: {
          pointsPerDrive: 2,
          epaPerPlay: 0.05,
          successRate: 0.44,
          explosivePlayRate: 0.0967,
          pressureRateAllowed: 0.28,
          secondsPerPlay: 27.2,
          neutralPassRate: 0.5567,
          volatilityScore: 43.67,
        },
      },
      lateWindow: {
        weeks: [4, 5, 6],
        games: 3,
        averages: {
          pointsPerDrive: 2.767,
          epaPerPlay: 0.1567,
          successRate: 0.5,
          explosivePlayRate: 0.14,
          pressureRateAllowed: 0.22,
          secondsPerPlay: 26.033,
          neutralPassRate: 0.59,
          volatilityScore: 36.69,
        },
      },
      deltas: {
        pointsPerDrive: 0.767,
        epaPerPlay: 0.1067,
        successRate: 0.06,
        explosivePlayRate: 0.0433,
        pressureRateAllowed: -0.06,
        secondsPerPlay: -1.167,
        neutralPassRate: 0.0333,
      },
      movement: {
        offenseDirection: 'improving',
        passEnvironmentDirection: 'more_pass_heavy',
        paceDirection: 'faster',
        pressureDirection: 'improving',
        volatilityDirection: 'falling',
        verdict: 'offensive_environment_improving',
      },
      warnings: [],
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

  it('accepts the team-state-only v1 artifact and echoes the v1 literal', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_movement_v1.json');
    await writeFile(artifactPath, JSON.stringify(validArtifactV1));

    const result = await serviceFor(artifactPath).getMovement();

    expect(result.artifact).toBe('team_environment_movement_v1');
    expect(result.artifactAvailable).toBe(true);
    expect(result.state).toBe('ready');
    expect(result.provenanceStatus).toBe('fixture_scaffold');
    expect(result.coverage).toEqual(expect.objectContaining({ latestWeek: 6, teams: ['DET'] }));
    expect(result.teams[0]).toEqual(expect.objectContaining({
      team: 'DET',
      teamId: 'DET',
      offenseDirection: 'improving',
      pressureDirection: 'improving',
      passEnvironmentDirection: 'more_pass_heavy',
      paceDirection: 'faster',
      volatilityDirection: 'falling',
      verdict: 'offensive_environment_improving',
    }));
  });

  it('does not require the removed fantasy-point fields when reading v1', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_movement_v1.json');
    await writeFile(artifactPath, JSON.stringify(validArtifactV1));

    const result = await serviceFor(artifactPath).getMovement();

    expect(result.state).toBe('ready');
    // The v1 fixture intentionally carries no fantasyPointsFor* keys; the consumer must still read it.
    const serialized = JSON.stringify(result.teams[0]);
    expect(serialized).not.toContain('fantasyPointsForQB');
    expect(serialized).not.toContain('fantasyPointsForRB');
    expect(serialized).not.toContain('fantasyPointsForWR');
    expect(serialized).not.toContain('fantasyPointsForTE');
    // Team-state window/delta fields still flow through as opaque pass-through context.
    expect(result.teams[0].earlyWindow).toEqual(expect.objectContaining({ averages: expect.any(Object) }));
    expect(result.teams[0].deltas).toEqual(expect.objectContaining({ pointsPerDrive: expect.any(Number) }));
  });

  it('looks up a v1 movement entry by abbreviation', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_movement_v1.json');
    await writeFile(artifactPath, JSON.stringify(validArtifactV1));

    const result = await serviceFor(artifactPath).getMovement('det');

    expect(result.artifact).toBe('team_environment_movement_v1');
    expect(result.selectedTeam).toEqual(expect.objectContaining({ team: 'DET', offenseDirection: 'improving' }));
    expect(result.teams).toEqual([]);
  });

  it('fails closed for an unrecognized artifact literal', async () => {
    const artifactPath = path.join(tmpDir, 'future.json');
    await writeFile(artifactPath, JSON.stringify({ ...validArtifactV1, artifact: 'team_environment_movement_v2' }));

    const result = await serviceFor(artifactPath).getMovement();

    expect(result.artifactAvailable).toBe(false);
    expect(result.state).toBe('error');
    expect(result.errors[0].code).toBe('invalid_payload');
    expect(result.teams).toEqual([]);
  });

  it('remains read-only regardless of artifact version', async () => {
    const artifactPath = path.join(tmpDir, 'team_environment_movement_v1.json');
    await writeFile(artifactPath, JSON.stringify(validArtifactV1));

    const result = await serviceFor(artifactPath).getMovement();

    expect(result.source).toEqual(expect.objectContaining({
      provider: 'tiber-teamstate',
      mode: 'artifact',
      readOnly: true,
    }));
  });
});

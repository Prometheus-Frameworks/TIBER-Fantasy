import {
  getTeamEnvironmentMovementReadinessDetails,
  hasUsableTeamEnvironmentMovementContext,
  type TeamEnvironmentMovementResponse,
} from '@/lib/teamEnvironmentMovement';

function buildResponse(overrides: Partial<TeamEnvironmentMovementResponse> = {}): TeamEnvironmentMovementResponse {
  return {
    ok: true,
    artifact: 'team_environment_movement_v0',
    artifactAvailable: true,
    provenanceStatus: 'fixture_scaffold',
    inputSources: [],
    coverage: { teams: ['TB'], seasons: [2025], weeks: [1], latestWeek: 1, isFullLeague: false },
    teams: [{
      team: 'TB',
      teamId: null,
      teamAbbr: 'TB',
      season: 2025,
      weeksCovered: [1],
      earlyWindow: {},
      lateWindow: {},
      deltas: {},
      offenseDirection: 'declining',
      pressureDirection: null,
      passEnvironmentDirection: null,
      paceDirection: null,
      volatilityDirection: null,
      verdict: null,
      warnings: [],
      raw: {},
    }],
    selectedTeam: null,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe('team environment movement management readiness', () => {
  it('reports ready only when the artifact and usable movement context are present', () => {
    expect(hasUsableTeamEnvironmentMovementContext(buildResponse())).toBe(true);
    expect(hasUsableTeamEnvironmentMovementContext(buildResponse({ artifactAvailable: false, teams: [] }))).toBe(false);
    expect(hasUsableTeamEnvironmentMovementContext(buildResponse({ ok: false, teams: [] }))).toBe(false);
    expect(hasUsableTeamEnvironmentMovementContext(buildResponse({ teams: [] }))).toBe(false);
  });

  it('treats the team-state-only v1 artifact as usable read-only context', () => {
    const v1Response = buildResponse({ artifact: 'team_environment_movement_v1' });
    expect(v1Response.artifact).toBe('team_environment_movement_v1');
    expect(hasUsableTeamEnvironmentMovementContext(v1Response)).toBe(true);
    expect(getTeamEnvironmentMovementReadinessDetails(v1Response)).toEqual(expect.arrayContaining([
      'Provenance status: fixture_scaffold.',
    ]));
  });

  it('surfaces provenance, warnings, errors, and present-but-empty artifact state', () => {
    expect(getTeamEnvironmentMovementReadinessDetails(buildResponse({
      ok: false,
      teams: [],
      warnings: ['No governed movement rows were exported.'],
      errors: [{ code: 'TEAMSTATE_EMPTY', message: 'Movement artifact has no team entries.' }],
    }))).toEqual(expect.arrayContaining([
      'Provenance status: fixture_scaffold.',
      'fixture/synthetic Teamstate movement artifact; do not treat as governed production truth',
      'No governed movement rows were exported.',
      'Movement artifact has no team entries.',
      'Teamstate artifact is present, but no usable movement rows are available.',
    ]));
  });
});

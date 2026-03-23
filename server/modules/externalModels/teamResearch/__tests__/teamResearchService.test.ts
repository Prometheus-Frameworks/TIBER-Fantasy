import { TeamResearchService } from '../teamResearchService';

function buildService(overrides: Partial<ConstructorParameters<typeof TeamResearchService>[0]> = {}) {
  return new TeamResearchService({
    signalValidation: {
      getWrBreakoutLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025, 2024],
        rows: [
          {
            candidateRank: 3,
            finalSignalScore: 91.4,
            playerName: 'Justin Jefferson',
            playerId: '00-0036322',
            team: 'MIN',
            season: 2025,
            bestRecipeName: 'Elite alpha runway',
            breakoutLabelDefault: 'Priority breakout',
            breakoutContext: 'Fixture breakout context',
            components: { usage: 94, efficiency: 95, development: 91, stability: 89, cohort: 90, role: 93, penalty: 0 },
            rawFields: {},
          },
        ],
        bestRecipeSummary: {
          bestRecipeName: 'Elite alpha runway',
          season: 2025,
          validationScore: 0.71,
          winRate: 0.67,
          hitRate: 0.59,
          candidateCount: 24,
          summary: 'Fixture recipe',
          generatedAt: '2026-03-23T00:00:00.000Z',
          modelVersion: 'svm-v1',
        },
        source: { provider: 'signal-validation-model', exportDirectory: '/exports/signal-validation' },
      }),
    },
    roleOpportunity: {
      getRoleOpportunityLab: jest.fn().mockResolvedValue({
        season: 2025,
        week: null,
        seasonScopeMarker: 'season',
        availableSeasons: [2025, 2024],
        rows: [
          {
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            team: 'MIN',
            position: 'WR',
            season: 2025,
            week: null,
            seasonScopeMarker: 'season',
            primaryRole: 'alpha_x',
            roleTags: ['boundary'],
            usage: { routeParticipation: 0.95, targetShare: 0.31, airYardShare: 0.42, snapShare: 0.92, usageRate: 0.28 },
            confidence: { score: 0.94, tier: 'featured' },
            source: { sourceName: 'tiber-data', sourceType: 'compatibility-view', modelVersion: 'role-v1', generatedAt: '2026-03-23T00:00:00.000Z' },
            insights: ['Target leader'],
            rawFields: {},
          },
          {
            playerId: '00-0034857',
            playerName: 'T.J. Hockenson',
            team: 'MIN',
            position: 'TE',
            season: 2025,
            week: null,
            seasonScopeMarker: 'season',
            primaryRole: 'move_te',
            roleTags: ['middle'],
            usage: { routeParticipation: 0.82, targetShare: 0.21, airYardShare: 0.16, snapShare: 0.81, usageRate: 0.2 },
            confidence: { score: 0.87, tier: 'core' },
            source: { sourceName: 'tiber-data', sourceType: 'compatibility-view', modelVersion: 'role-v1', generatedAt: '2026-03-23T00:00:00.000Z' },
            insights: ['Middle-field hub'],
            rawFields: {},
          },
        ],
        source: { provider: 'role-and-opportunity-model', location: 'https://example.test/role', mode: 'api' },
      }),
    },
    ageCurves: {
      getAgeCurveLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025, 2024],
        rows: [
          {
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            team: 'MIN',
            position: 'WR',
            season: 2025,
            age: 26,
            careerYear: 6,
            peerBucket: 'Prime WR',
            expectedPpg: 18.1,
            actualPpg: 19.4,
            ppgDelta: 1.3,
            trajectoryLabel: 'Prime hold',
            ageCurveScore: 90.2,
            provenance: { provider: 'arc-model', sourceName: 'arc-export', sourceType: 'artifact', modelVersion: 'arc-v1', generatedAt: '2026-03-23T00:00:00.000Z', notes: [] },
            rawFields: {},
          },
        ],
        source: { provider: 'arc-model', location: '/exports/arc', mode: 'artifact' },
      }),
    },
    pointScenarios: {
      getPointScenarioLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025, 2024],
        rows: [
          {
            scenarioId: 'min-1',
            scenarioName: 'Target spike if WR2 sits',
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            team: 'MIN',
            position: 'WR',
            season: 2025,
            week: null,
            baselineProjection: 18.5,
            adjustedProjection: 21.4,
            delta: 2.9,
            confidence: { band: 'mid', label: 'actionable' },
            scenarioType: 'usage',
            eventType: 'injury',
            notes: ['Fixture note'],
            explanation: 'Fixture explanation',
            provenance: { provider: 'point-prediction-model', sourceName: 'scenario-export', sourceType: 'artifact', modelVersion: 'ppm-v1', generatedAt: '2026-03-23T00:00:00.000Z', sourceMetadata: {} },
            rawFields: {},
          },
        ],
        source: { provider: 'point-prediction-model', location: '/exports/scenarios', mode: 'artifact' },
      }),
    },
    ...overrides,
  });
}

describe('TeamResearchService', () => {
  it('aggregates promoted team summaries without recomputing underlying models', async () => {
    const service = buildService();

    const workspace = await service.getTeamResearchWorkspace({ season: 2025, team: 'MIN' });

    expect(workspace.state).toBe('ready');
    expect(workspace.selectedTeam?.teamName).toBe('Minnesota Vikings');
    expect(workspace.keyPlayers.map((player) => player.playerName)).toEqual(['Justin Jefferson', 'T.J. Hockenson']);
    expect(workspace.sections.offensiveContext.summary?.promotedPlayerCount).toBe(2);
    expect(workspace.sections.roleOpportunity.summary?.playerCount).toBe(2);
    expect(workspace.sections.breakoutSignals.summary?.candidateCount).toBe(1);
    expect(workspace.sections.pointScenarios.summary?.totalScenarioCount).toBe(1);
    expect(workspace.sections.ageCurves.summary?.playerCount).toBe(1);
    expect(workspace.keyPlayers[0].playerResearchHref).toBe('/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson');
  });

  it('keeps partial-data behavior when some promoted sections are missing', async () => {
    const service = buildService({
      ageCurves: {
        getAgeCurveLab: jest.fn().mockResolvedValue({
          season: 2025,
          availableSeasons: [2025],
          rows: [],
          source: { provider: 'arc-model', location: '/exports/arc', mode: 'artifact' },
        }),
      },
      pointScenarios: {
        getPointScenarioLab: jest.fn().mockRejectedValue(new Error('boom')),
      } as any,
    });

    const workspace = await service.getTeamResearchWorkspace({ season: 2025, team: 'MIN' });

    expect(workspace.state).toBe('partial');
    expect(workspace.sections.ageCurves.state).toBe('not_available');
    expect(workspace.sections.pointScenarios.state).toBe('error');
    expect(workspace.warnings.some((warning) => warning.includes('Point Scenarios unavailable'))).toBe(true);
  });

  it('returns an empty workspace when the requested team does not match promoted coverage', async () => {
    const service = buildService();

    const workspace = await service.getTeamResearchWorkspace({ season: 2025, team: 'SEA' });

    expect(workspace.state).toBe('empty');
    expect(workspace.selectedTeam?.team).toBe('SEA');
    expect(workspace.header.teamName).toBe('Seattle Seahawks');
  });
});

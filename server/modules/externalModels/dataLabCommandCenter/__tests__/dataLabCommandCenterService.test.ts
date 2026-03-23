import { DataLabCommandCenterService } from '../service';
import { RoleOpportunityIntegrationError } from '../../roleOpportunity/types';

function buildService(overrides: Partial<ConstructorParameters<typeof DataLabCommandCenterService>[0]> = {}) {
  return new DataLabCommandCenterService({
    signalValidation: {
      getWrBreakoutLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025, 2024],
        rows: [
          {
            candidateRank: 1,
            finalSignalScore: 95.2,
            playerName: 'Malik Nabers',
            playerId: '00-0042051',
            team: 'NYG',
            season: 2025,
            bestRecipeName: 'Alpha leap',
            breakoutLabelDefault: 'Priority breakout',
            breakoutContext: 'Fixture breakout context',
            components: { usage: 94, efficiency: 91, development: 92, stability: 88, cohort: 87, role: 95, penalty: 0 },
            rawFields: {},
          },
        ],
        bestRecipeSummary: { bestRecipeName: 'Alpha leap', season: 2025, validationScore: 0.72, winRate: 0.68, hitRate: 0.61, candidateCount: 20, summary: 'Fixture', generatedAt: '2026-03-23T00:00:00.000Z', modelVersion: 'svm-v1' },
        source: { provider: 'signal-validation-model', exportDirectory: '/exports/breakout' },
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
            playerId: '00-0042051',
            playerName: 'Malik Nabers',
            team: 'NYG',
            position: 'WR',
            season: 2025,
            week: null,
            seasonScopeMarker: 'season',
            primaryRole: 'alpha_x',
            roleTags: ['boundary'],
            usage: { routeParticipation: 0.94, targetShare: 0.33, airYardShare: 0.41, snapShare: 0.91, usageRate: 0.29 },
            confidence: { score: 0.93, tier: 'featured' },
            source: { sourceName: 'tiber-data', sourceType: 'compatibility', modelVersion: 'role-v1', generatedAt: '2026-03-23T00:00:00.000Z' },
            insights: ['Target leader'],
            rawFields: {},
          },
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
            usage: { routeParticipation: 0.95, targetShare: 0.31, airYardShare: 0.42, snapShare: 0.93, usageRate: 0.28 },
            confidence: { score: 0.92, tier: 'featured' },
            source: { sourceName: 'tiber-data', sourceType: 'compatibility', modelVersion: 'role-v1', generatedAt: '2026-03-23T00:00:00.000Z' },
            insights: ['Target leader'],
            rawFields: {},
          },
        ],
        source: { provider: 'role-and-opportunity-model', location: '/exports/role', mode: 'artifact' },
      }),
    },
    ageCurves: {
      getAgeCurveLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025, 2024],
        rows: [
          {
            playerId: '00-0042051',
            playerName: 'Malik Nabers',
            team: 'NYG',
            position: 'WR',
            season: 2025,
            age: 22,
            careerYear: 2,
            peerBucket: 'young breakout',
            expectedPpg: 14.1,
            actualPpg: 17.8,
            ppgDelta: 3.7,
            trajectoryLabel: 'ascending',
            ageCurveScore: 92,
            provenance: { provider: 'arc-model', sourceName: 'arc', sourceType: 'artifact', modelVersion: 'arc-v1', generatedAt: '2026-03-23T00:00:00.000Z', notes: [] },
            rawFields: {},
          },
          {
            playerId: '00-0033900',
            playerName: 'Cooper Kupp',
            team: 'LAR',
            position: 'WR',
            season: 2025,
            age: 32,
            careerYear: 9,
            peerBucket: 'veteran',
            expectedPpg: 15.2,
            actualPpg: 11.3,
            ppgDelta: -3.9,
            trajectoryLabel: 'decline-risk',
            ageCurveScore: 48,
            provenance: { provider: 'arc-model', sourceName: 'arc', sourceType: 'artifact', modelVersion: 'arc-v1', generatedAt: '2026-03-23T00:00:00.000Z', notes: [] },
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
            adjustedProjection: 21.7,
            delta: 3.2,
            confidence: { band: 'mid', label: 'actionable' },
            scenarioType: 'usage',
            eventType: 'injury',
            notes: ['Fixture'],
            explanation: 'Fixture',
            provenance: { provider: 'point-prediction-model', sourceName: 'scenario', sourceType: 'artifact', modelVersion: 'ppm-v1', generatedAt: '2026-03-23T00:00:00.000Z', sourceMetadata: {} },
            rawFields: {},
          },
        ],
        source: { provider: 'point-prediction-model', location: '/exports/scenario', mode: 'artifact' },
      }),
    },
    ...overrides,
  });
}

describe('DataLabCommandCenterService', () => {
  it('orchestrates summary sections and generates quick links without recomputing model logic', async () => {
    const service = buildService();

    const workspace = await service.getCommandCenter({ season: 2025 });

    expect(workspace.state).toBe('ready');
    expect(workspace.sections.breakoutCandidates.items[0]).toEqual(
      expect.objectContaining({
        playerName: 'Malik Nabers',
      }),
    );
    expect(workspace.sections.roleOpportunity.items[0].links.playerResearchHref).toBe(
      '/tiber-data-lab/player-research?season=2025&playerId=00-0042051&playerName=Malik+Nabers',
    );
    expect(workspace.sections.teamEnvironments.items[0].links.teamResearchHref).toMatch('/tiber-data-lab/team-research?season=2025');
    expect(workspace.priorities.some((item) => item.primaryAction.label === 'Open in Player Research')).toBe(true);
    expect(workspace.moduleStatuses.map((status) => status.state)).toEqual(['ready', 'ready', 'ready', 'ready']);
  });

  it('renders mixed ready/empty/unavailable states when promoted modules are only partially available', async () => {
    const service = buildService({
      roleOpportunity: {
        getRoleOpportunityLab: jest.fn().mockRejectedValue(new RoleOpportunityIntegrationError('upstream_unavailable', 'Role feed offline', 503)),
      },
      ageCurves: {
        getAgeCurveLab: jest.fn().mockResolvedValue({
          season: 2025,
          availableSeasons: [2025],
          rows: [],
          source: { provider: 'arc-model', location: '/exports/arc', mode: 'artifact' },
        }),
      },
    });

    const workspace = await service.getCommandCenter({ season: 2025 });

    expect(workspace.state).toBe('partial');
    expect(workspace.sections.roleOpportunity.state).toBe('unavailable');
    expect(workspace.sections.ageCurves.state).toBe('empty');
    expect(workspace.sections.breakoutCandidates.state).toBe('ready');
    expect(workspace.warnings).toContain('Role & Opportunity Lab unavailable: Role feed offline');
  });

  it('returns an error workspace when every promoted module is unavailable', async () => {
    const failureService = new DataLabCommandCenterService({
      signalValidation: { getWrBreakoutLab: jest.fn().mockRejectedValue(new Error('boom')) } as any,
      roleOpportunity: { getRoleOpportunityLab: jest.fn().mockRejectedValue(new Error('boom')) } as any,
      ageCurves: { getAgeCurveLab: jest.fn().mockRejectedValue(new Error('boom')) } as any,
      pointScenarios: { getPointScenarioLab: jest.fn().mockRejectedValue(new Error('boom')) } as any,
    });

    const workspace = await failureService.getCommandCenter({ season: 2025 });

    expect(workspace.state).toBe('error');
    expect(workspace.sections.breakoutCandidates.state).toBe('unavailable');
    expect(workspace.moduleStatuses.every((status) => status.state === 'unavailable')).toBe(true);
  });
});

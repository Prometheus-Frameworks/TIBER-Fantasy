import { PlayerResearchService } from '../playerResearchService';
import { AgeCurveIntegrationError } from '../../ageCurves/types';

function buildService(overrides: Partial<any> = {}) {
  return new PlayerResearchService({
    signalValidation: {
      getWrBreakoutLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025, 2024],
        rows: [
          {
            candidateRank: 4,
            finalSignalScore: 92.1,
            playerName: 'Justin Jefferson',
            playerId: '00-0036322',
            team: 'MIN',
            season: 2025,
            bestRecipeName: 'Elite rookie command',
            breakoutLabelDefault: 'Priority breakout',
            breakoutContext: 'Already elite route earner with more TD ceiling left.',
            components: {
              usage: 96,
              efficiency: 92,
              development: 89,
              stability: 85,
              cohort: 88,
              role: 94,
              penalty: 0,
            },
            rawFields: {},
          },
        ],
        bestRecipeSummary: {
          bestRecipeName: 'Elite rookie command',
          season: 2025,
          validationScore: 0.74,
          winRate: 0.69,
          hitRate: 0.66,
          candidateCount: 24,
          summary: 'Fixture',
          generatedAt: '2026-03-23T00:00:00.000Z',
          modelVersion: 'svm-v1',
        },
        source: {
          provider: 'signal-validation-model',
          exportDirectory: '/exports/signal-validation',
        },
      }),
    },
    roleOpportunity: {
      getRoleOpportunityLab: jest.fn().mockResolvedValue({
        season: 2025,
        week: 17,
        seasonScopeMarker: null,
        availableSeasons: [2025, 2024],
        rows: [
          {
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            team: 'MIN',
            position: 'WR',
            season: 2025,
            week: 17,
            seasonScopeMarker: null,
            primaryRole: 'alpha_x',
            roleTags: ['boundary'],
            usage: {
              routeParticipation: 0.96,
              targetShare: 0.31,
              airYardShare: 0.42,
              snapShare: 0.93,
              usageRate: 0.28,
            },
            confidence: { score: 0.91, tier: 'featured' },
            source: {
              sourceName: 'tiber-data',
              sourceType: 'compatibility-view',
              modelVersion: 'role-opportunity-v1',
              generatedAt: '2026-03-23T00:00:00.000Z',
            },
            insights: ['Target leader'],
            rawFields: {},
          },
        ],
        source: {
          provider: 'role-and-opportunity-model',
          location: '/exports/role-opportunity.json',
          mode: 'artifact',
        },
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
            careerYear: 5,
            peerBucket: 'prime-elite',
            expectedPpg: 18.1,
            actualPpg: 20.3,
            ppgDelta: 2.2,
            trajectoryLabel: 'ascending-prime',
            ageCurveScore: 91,
            provenance: {
              provider: 'arc-model',
              sourceName: 'arc-export',
              sourceType: 'artifact',
              modelVersion: 'arc-v1',
              generatedAt: '2026-03-23T00:00:00.000Z',
              notes: ['Fixture'],
            },
            rawFields: {},
          },
        ],
        source: {
          provider: 'arc-model',
          location: '/exports/age-curves.json',
          mode: 'artifact',
        },
      }),
    },
    pointScenarios: {
      getPointScenarioLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025, 2024],
        rows: [
          {
            scenarioId: 'injury-bump',
            scenarioName: 'Target spike if WR2 sits',
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            team: 'MIN',
            position: 'WR',
            season: 2025,
            week: 17,
            baselineProjection: 18.4,
            adjustedProjection: 21.1,
            delta: 2.7,
            confidence: { band: 'mid', label: 'actionable' },
            scenarioType: 'usage_shock',
            eventType: 'injury',
            notes: ['Promoted export'],
            explanation: 'Fixture',
            provenance: {
              provider: 'point-prediction-model',
              sourceName: 'scenario-export',
              sourceType: 'artifact',
              modelVersion: 'ppm-v1',
              generatedAt: '2026-03-23T00:00:00.000Z',
              sourceMetadata: {},
            },
            rawFields: {},
          },
        ],
        source: {
          provider: 'point-prediction-model',
          location: '/exports/point-scenarios.json',
          mode: 'artifact',
        },
      }),
    },
    playerOwnership: {
      getPlayerOwnershipInsight: jest.fn().mockImplementation(async ({ playerId, query }: { playerId?: string | null; query?: string | null }) => {
        const isJustin = playerId === '00-0036322' || query === 'Justin Jefferson';

        if (!isJustin) {
          return {
            available: true,
            matched: false,
            matchType: 'none',
            playerId: null,
            playerName: null,
            position: null,
            footballLevel: null,
            currentTeamId: null,
            currentTeamAbbr: null,
            currentTeamName: null,
            ownershipStatus: null,
            validFrom: null,
            validTo: null,
            lastVerifiedAt: null,
            confidence: null,
            sourceRefs: [],
            recentEvents: [],
            warnings: ['No player ownership match found.'],
          };
        }

        return {
          available: true,
          matched: true,
          matchType: playerId ? 'player_id' : 'exact_name',
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          position: 'WR',
          footballLevel: 'NFL',
          currentTeamId: 'nfl-min',
          currentTeamAbbr: 'MIN',
          currentTeamName: 'Minnesota Vikings',
          ownershipStatus: 'active_roster',
          validFrom: '2025-03-01T00:00:00.000Z',
          validTo: null,
          lastVerifiedAt: '2026-05-23T13:00:00.000Z',
          confidence: 'source_verified',
          sourceRefs: [],
          recentEvents: [],
          warnings: [],
        };
      }),
    },
    ...overrides,
  });
}

describe('PlayerResearchService', () => {
  it('aggregates all promoted module summaries for a matched player without rescoring', async () => {
    const service = buildService();

    const workspace = await service.getPlayerResearchWorkspace({ season: 2025, playerId: '00-0036322' });

    expect(workspace.state).toBe('ready');
    expect(workspace.selectedPlayer).toEqual(
      expect.objectContaining({
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        matchStrategy: 'player_id',
      }),
    );
    expect(workspace.sections.breakoutSignals.summary).toEqual(
      expect.objectContaining({
        candidateRank: 4,
        finalSignalScore: 92.1,
      }),
    );
    expect(workspace.sections.roleOpportunity.summary).toEqual(
      expect.objectContaining({
        primaryRole: 'alpha_x',
        targetShare: 0.31,
      }),
    );
    expect(workspace.sections.ageCurves.summary).toEqual(
      expect.objectContaining({
        age: 26,
        trajectoryLabel: 'ascending-prime',
      }),
    );
    expect(workspace.sections.pointScenarios.summary).toEqual(
      expect.objectContaining({
        baselineProjection: 18.4,
        scenarioCount: 1,
      }),
    );
    expect(workspace.ownershipTruth).toEqual(
      expect.objectContaining({
        available: true,
        matched: true,
        currentTeamAbbr: 'MIN',
      }),
    );
    expect(workspace.framing.provenanceNote).toContain('not recomputing');
  });

  it('keeps partial-data behavior when one promoted module is missing or unavailable', async () => {
    const service = buildService({
      ageCurves: {
        getAgeCurveLab: jest.fn().mockRejectedValue(new AgeCurveIntegrationError('not_found', 'ARC export missing', 404)),
      },
    });

    const workspace = await service.getPlayerResearchWorkspace({ season: 2025, playerName: 'Justin Jefferson' });

    expect(workspace.state).toBe('partial');
    expect(workspace.selectedPlayer?.matchStrategy).toBe('exact_name');
    expect(workspace.sections.ageCurves.state).toBe('error');
    expect(workspace.sections.ageCurves.error).toEqual({ code: 'not_found', message: 'ARC export missing' });
    expect(workspace.sections.roleOpportunity.state).toBe('ready');
    expect(workspace.searchIndex[0]).toEqual(
      expect.objectContaining({
        playerName: 'Justin Jefferson',
      }),
    );
  });

  it('returns an empty workspace state when the requested player is not present in promoted outputs', async () => {
    const service = buildService();

    const workspace = await service.getPlayerResearchWorkspace({ season: 2025, playerName: 'No Such Player' });

    expect(workspace.state).toBe('empty');
    expect(workspace.selectedPlayer).toBeNull();
    expect(workspace.sections.breakoutSignals.state).toBe('idle');
    expect(workspace.searchIndex).toHaveLength(1);
  });
});

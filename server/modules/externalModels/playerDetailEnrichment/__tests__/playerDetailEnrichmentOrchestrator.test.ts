import { orchestratePlayerDetailEnrichment } from '../playerDetailEnrichmentOrchestrator';

describe('orchestratePlayerDetailEnrichment', () => {
  it('returns an empty result when no enrichments are requested', async () => {
    const buildRoleOpportunityInsightStatus = jest.fn();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
      },
      {
        buildRoleOpportunityInsightStatus,
      },
    );

    expect(result).toEqual({});
    expect(buildRoleOpportunityInsightStatus).not.toHaveBeenCalled();
  });

  it('returns roleOpportunityInsight when requested with valid params', async () => {
    const buildRoleOpportunityInsightStatus = jest.fn().mockResolvedValue({
      available: true,
      fetchedAt: '2026-03-20T00:00:00.000Z',
      data: {
        playerId: '00-0036322',
        season: 2025,
        week: 17,
        position: 'WR',
        team: 'MIN',
        primaryRole: 'alpha_x',
        roleTags: ['boundary'],
        usage: {
          snapShare: 0.93,
          routeShare: 0.96,
          targetShare: 0.31,
          usageRate: 0.28,
        },
        opportunity: {
          tier: 'featured',
          weightedOpportunityIndex: 0.88,
          insights: ['High route participation'],
        },
        confidence: 0.91,
        source: {
          provider: 'role-and-opportunity-model',
          modelVersion: 'role-opportunity-v1',
          generatedAt: '2026-03-20T00:00:00.000Z',
        },
      },
    });

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        season: 2025,
        week: 17,
        includeRoleOpportunity: true,
      },
      {
        buildRoleOpportunityInsightStatus,
      },
    );

    expect(result.roleOpportunityInsight).toMatchObject({
      available: true,
      data: {
        primaryRole: 'alpha_x',
      },
    });
    expect(buildRoleOpportunityInsightStatus).toHaveBeenCalledWith({
      playerId: '00-0036322',
      season: 2025,
      week: 17,
    });
  });

  it('preserves failure-tolerant unavailable results from role opportunity enrichment', async () => {
    const buildRoleOpportunityInsightStatus = jest.fn().mockResolvedValue({
      available: false,
      fetchedAt: '2026-03-20T00:00:00.000Z',
      error: {
        category: 'upstream_unavailable',
        message: 'Role opportunity service is temporarily unavailable.',
      },
    });

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        season: 2025,
        week: 17,
        includeRoleOpportunity: true,
      },
      {
        buildRoleOpportunityInsightStatus,
      },
    );

    expect(result).toEqual({
      roleOpportunityInsight: {
        available: false,
        fetchedAt: '2026-03-20T00:00:00.000Z',
        error: {
          category: 'upstream_unavailable',
          message: 'Role opportunity service is temporarily unavailable.',
        },
      },
    });
  });

  it('returns a stable unavailable status when role opportunity params are missing', async () => {
    const buildRoleOpportunityInsightStatus = jest.fn();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        includeRoleOpportunity: true,
        season: 2025,
      },
      {
        buildRoleOpportunityInsightStatus,
      },
    );

    expect(result.roleOpportunityInsight).toMatchObject({
      available: false,
      error: {
        category: 'ambiguous',
        message: 'season and week are required when includeRoleOpportunity=true',
      },
    });
    expect(buildRoleOpportunityInsightStatus).not.toHaveBeenCalled();
  });
});

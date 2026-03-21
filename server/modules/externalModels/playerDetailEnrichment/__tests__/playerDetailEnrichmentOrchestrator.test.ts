import { orchestratePlayerDetailEnrichment } from '../playerDetailEnrichmentOrchestrator';

describe('orchestratePlayerDetailEnrichment', () => {
  it('returns an empty result when no enrichments are requested', async () => {
    const buildRoleOpportunityInsightStatus = jest.fn();
    const buildExternalForgeInsightStatus = jest.fn();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
      },
      {
        buildRoleOpportunityInsightStatus,
        buildExternalForgeInsightStatus,
      },
    );

    expect(result).toEqual({});
    expect(buildRoleOpportunityInsightStatus).not.toHaveBeenCalled();
    expect(buildExternalForgeInsightStatus).not.toHaveBeenCalled();
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
    const buildExternalForgeInsightStatus = jest.fn();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        season: 2025,
        week: 17,
        includeRoleOpportunity: true,
      },
      {
        buildRoleOpportunityInsightStatus,
        buildExternalForgeInsightStatus,
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
    expect(buildExternalForgeInsightStatus).not.toHaveBeenCalled();
  });

  it('returns externalForgeInsight when requested with valid params', async () => {
    const buildRoleOpportunityInsightStatus = jest.fn();
    const buildExternalForgeInsightStatus = jest.fn().mockResolvedValue({
      available: true,
      fetchedAt: '2026-03-21T00:00:00.000Z',
      data: {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        position: 'WR',
        team: 'MIN',
        season: 2025,
        week: 'season',
        mode: 'redraft',
        score: {
          alpha: 81.5,
          tier: 'T2',
          tierRank: 2,
        },
        components: {
          volume: 84,
          efficiency: 78,
          teamContext: 72,
          stability: 80,
        },
        confidence: 0.82,
        metadata: {
          gamesSampled: 15,
          positionRank: 2,
          status: 'ok',
          issues: [],
        },
        source: {
          provider: 'external-forge',
          modelVersion: '2026.03.0',
          generatedAt: '2026-03-21T00:00:00.000Z',
        },
      },
    });

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        season: 2025,
        includeExternalForge: true,
      },
      {
        buildRoleOpportunityInsightStatus,
        buildExternalForgeInsightStatus,
      },
    );

    expect(result.externalForgeInsight).toMatchObject({
      available: true,
      data: {
        score: {
          alpha: 81.5,
        },
        confidence: 0.82,
      },
    });
    expect(buildExternalForgeInsightStatus).toHaveBeenCalledWith({
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
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
    const buildExternalForgeInsightStatus = jest.fn();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        season: 2025,
        week: 17,
        includeRoleOpportunity: true,
      },
      {
        buildRoleOpportunityInsightStatus,
        buildExternalForgeInsightStatus,
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
    const buildExternalForgeInsightStatus = jest.fn();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        includeRoleOpportunity: true,
        season: 2025,
      },
      {
        buildRoleOpportunityInsightStatus,
        buildExternalForgeInsightStatus,
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

  it('returns a stable unavailable status when external FORGE preview request params are ambiguous', async () => {
    const buildRoleOpportunityInsightStatus = jest.fn();
    const buildExternalForgeInsightStatus = jest.fn();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        includeExternalForge: true,
      },
      {
        buildRoleOpportunityInsightStatus,
        buildExternalForgeInsightStatus,
      },
    );

    expect(result.externalForgeInsight).toMatchObject({
      available: false,
      error: {
        category: 'ambiguous',
        message: 'season is required when includeExternalForge=true',
      },
    });
    expect(buildExternalForgeInsightStatus).not.toHaveBeenCalled();
  });
});

import { orchestratePlayerDetailEnrichment } from '../playerDetailEnrichmentOrchestrator';

function createDependencies() {
  return {
    buildRoleOpportunityInsightStatus: jest.fn(),
    buildExternalForgeInsightStatus: jest.fn(),
    buildSelectedForgeInsightStatus: jest.fn(),
    buildForgeComparisonInsightStatus: jest.fn(),
  };
}

describe('orchestratePlayerDetailEnrichment', () => {
  it('returns an empty result when no enrichments are requested', async () => {
    const dependencies = createDependencies();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
      },
      dependencies,
    );

    expect(result).toEqual({});
    expect(dependencies.buildRoleOpportunityInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildExternalForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildSelectedForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });

  it('returns roleOpportunityInsight when requested with valid params', async () => {
    const dependencies = createDependencies();
    dependencies.buildRoleOpportunityInsightStatus.mockResolvedValue({
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
      dependencies,
    );

    expect(result.roleOpportunityInsight).toMatchObject({
      available: true,
      data: {
        primaryRole: 'alpha_x',
      },
    });
    expect(dependencies.buildRoleOpportunityInsightStatus).toHaveBeenCalledWith({
      playerId: '00-0036322',
      season: 2025,
      week: 17,
    });
    expect(dependencies.buildExternalForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildSelectedForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });

  it('returns externalForgeInsight when requested with valid params', async () => {
    const dependencies = createDependencies();
    dependencies.buildExternalForgeInsightStatus.mockResolvedValue({
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
      dependencies,
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
    expect(dependencies.buildExternalForgeInsightStatus).toHaveBeenCalledWith({
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    });
    expect(dependencies.buildSelectedForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });

  it('returns selectedForgeInsight when requested with valid params', async () => {
    const dependencies = createDependencies();
    dependencies.buildSelectedForgeInsightStatus.mockResolvedValue({
      available: true,
      fetchedAt: '2026-03-21T00:00:00.000Z',
      selection: {
        requestedMode: 'auto_with_legacy_fallback',
        selectedSource: 'legacy',
        fallbackOccurred: true,
        fallbackReason: 'upstream_timeout',
      },
      data: {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        position: 'WR',
        team: 'MIN',
        season: 2025,
        week: 'season',
        mode: 'redraft',
        score: {
          alpha: 80,
          tier: 'T2',
          tierRank: 2,
        },
        components: {
          volume: 82,
          efficiency: 77,
          teamContext: 70,
          stability: 79,
        },
        confidence: 0.8,
        metadata: {
          gamesSampled: 15,
          positionRank: 2,
          status: 'ok',
          issues: [],
        },
        source: {
          provider: 'legacy-forge',
          modelVersion: 'legacy-eg-v2',
          generatedAt: '2026-03-21T00:00:00.000Z',
        },
      },
    });

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        season: 2025,
        includeSelectedForge: true,
        forgeSourceMode: 'auto_with_legacy_fallback',
      },
      dependencies,
    );

    expect(result.selectedForgeInsight).toMatchObject({
      available: true,
      selection: {
        requestedMode: 'auto_with_legacy_fallback',
        selectedSource: 'legacy',
        fallbackOccurred: true,
        fallbackReason: 'upstream_timeout',
      },
      data: {
        score: {
          alpha: 80,
        },
      },
    });
    expect(dependencies.buildSelectedForgeInsightStatus).toHaveBeenCalledWith(
      {
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 'season',
        mode: 'redraft',
        includeSourceMeta: true,
        includeRawCanonical: false,
      },
      'auto_with_legacy_fallback',
    );
    expect(dependencies.buildExternalForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });

  it('returns forgeComparison when requested with valid params', async () => {
    const dependencies = createDependencies();
    dependencies.buildForgeComparisonInsightStatus.mockResolvedValue({
      available: true,
      fetchedAt: '2026-03-21T00:00:00.000Z',
      legacy: {
        available: true,
        data: {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          position: 'WR',
          team: 'MIN',
          season: 2025,
          week: 'season',
          mode: 'redraft',
          score: {
            alpha: 80,
            tier: 'T2',
            tierRank: 2,
          },
          components: {
            volume: 82,
            efficiency: 77,
            teamContext: 70,
            stability: 79,
          },
          confidence: 0.8,
          metadata: {
            gamesSampled: 15,
            positionRank: 2,
            status: 'ok',
            issues: [],
          },
          source: {
            provider: 'legacy-forge',
            modelVersion: 'legacy-eg-v2',
            generatedAt: '2026-03-21T00:00:00.000Z',
          },
        },
      },
      external: {
        available: true,
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
      },
      comparison: {
        scoreDelta: 1.5,
        componentDeltas: {
          volume: 2,
          efficiency: 1,
          teamContext: 2,
          stability: 1,
        },
        confidenceDelta: 0.02,
        notes: ['Alpha delta stayed within migration tolerance at 1.5 points.'],
        parityStatus: 'close',
      },
    });

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        season: 2025,
        includeForgeComparison: true,
      },
      dependencies,
    );

    expect(result.forgeComparison).toMatchObject({
      available: true,
      legacy: {
        available: true,
        data: {
          score: {
            alpha: 80,
          },
        },
      },
      external: {
        available: true,
        data: {
          score: {
            alpha: 81.5,
          },
        },
      },
      comparison: {
        scoreDelta: 1.5,
        parityStatus: 'close',
      },
    });
    expect(dependencies.buildForgeComparisonInsightStatus).toHaveBeenCalledWith({
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    });
    expect(dependencies.buildSelectedForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildExternalForgeInsightStatus).not.toHaveBeenCalled();
  });

  it('preserves failure-tolerant unavailable results from role opportunity enrichment', async () => {
    const dependencies = createDependencies();
    dependencies.buildRoleOpportunityInsightStatus.mockResolvedValue({
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
      dependencies,
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
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });

  it('returns a stable unavailable status when role opportunity params are missing', async () => {
    const dependencies = createDependencies();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        includeRoleOpportunity: true,
        season: 2025,
      },
      dependencies,
    );

    expect(result.roleOpportunityInsight).toMatchObject({
      available: false,
      error: {
        category: 'ambiguous',
        message: 'season and week are required when includeRoleOpportunity=true',
      },
    });
    expect(dependencies.buildRoleOpportunityInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });

  it('returns a stable unavailable status when external FORGE preview request params are ambiguous', async () => {
    const dependencies = createDependencies();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        includeExternalForge: true,
      },
      dependencies,
    );

    expect(result.externalForgeInsight).toMatchObject({
      available: false,
      error: {
        category: 'ambiguous',
        message: 'season is required when requesting external FORGE preview or comparison',
      },
    });
    expect(dependencies.buildExternalForgeInsightStatus).not.toHaveBeenCalled();
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });

  it('returns a stable unavailable selectedForgeInsight status when request params are ambiguous', async () => {
    const dependencies = createDependencies();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        includeSelectedForge: true,
      },
      dependencies,
    );

    expect(result.selectedForgeInsight).toMatchObject({
      available: false,
      selection: {
        requestedMode: 'auto_with_legacy_fallback',
        selectedSource: 'external_preview',
        fallbackOccurred: false,
      },
      error: {
        category: 'ambiguous',
        message: 'season is required when requesting external FORGE preview or comparison',
      },
    });
    expect(dependencies.buildSelectedForgeInsightStatus).not.toHaveBeenCalled();
  });

  it('returns a stable unavailable selectedForgeInsight status when forgeSourceMode is invalid', async () => {
    const dependencies = createDependencies();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        season: 2025,
        includeSelectedForge: true,
        forgeSourceMode: 'ship_it',
      },
      dependencies,
    );

    expect(result.selectedForgeInsight).toMatchObject({
      available: false,
      selection: {
        requestedMode: 'auto_with_legacy_fallback',
        selectedSource: 'external_preview',
        fallbackOccurred: false,
      },
      error: {
        category: 'ambiguous',
        message:
          'forgeSourceMode must be one of legacy, external_preview, or auto_with_legacy_fallback when requesting selected FORGE preview',
      },
    });
    expect(dependencies.buildSelectedForgeInsightStatus).not.toHaveBeenCalled();
  });

  it('returns a stable unavailable forgeComparison status when comparison request params are ambiguous', async () => {
    const dependencies = createDependencies();

    const result = await orchestratePlayerDetailEnrichment(
      {
        playerId: '00-0036322',
        playerPosition: 'WR',
        includeForgeComparison: true,
      },
      dependencies,
    );

    expect(result.forgeComparison).toMatchObject({
      available: false,
      legacy: {
        available: false,
        error: {
          category: 'ambiguous',
          message: 'season is required when requesting external FORGE preview or comparison',
        },
      },
      external: {
        available: false,
        error: {
          category: 'ambiguous',
          message: 'season is required when requesting external FORGE preview or comparison',
        },
      },
      error: {
        category: 'ambiguous',
        message: 'season is required when requesting external FORGE preview or comparison',
      },
    });
    expect(dependencies.buildForgeComparisonInsightStatus).not.toHaveBeenCalled();
  });
});

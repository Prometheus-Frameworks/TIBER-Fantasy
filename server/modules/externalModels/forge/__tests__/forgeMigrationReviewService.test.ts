import {
  ForgeMigrationReviewFilters,
  ForgeMigrationReviewReport,
  ForgeMigrationReviewSamplePlayer,
  ForgeMigrationReviewService,
  summarizeForgeMigrationReviewResults,
} from '../forgeMigrationReviewService';

const filters: ForgeMigrationReviewFilters = {
  position: 'WR',
  season: 2025,
  week: 17,
  limit: 3,
  mode: 'redraft',
  includeSourceMeta: true,
  includeRawCanonical: false,
};

const sampledPlayers: ForgeMigrationReviewSamplePlayer[] = [
  { playerId: '00-0036322', playerName: 'Justin Jefferson', team: 'MIN', position: 'WR' },
  { playerId: '00-0033280', playerName: 'Ja\'Marr Chase', team: 'CIN', position: 'WR' },
  { playerId: '00-0037834', playerName: 'Puka Nacua', team: 'LAR', position: 'WR' },
];

function buildReviewResult(overrides: Partial<any> = {}) {
  return {
    request: {
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 17,
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
    legacy: {
      available: true,
      data: {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        position: 'WR',
        team: 'MIN',
        season: 2025,
        week: 17,
        mode: 'redraft',
        score: { alpha: 80, tier: 'T2', tierRank: 2, confidence: 0.8 },
        components: { volume: 82, efficiency: 77, teamContext: 70, stability: 79 },
        metadata: { gamesSampled: 15, positionRank: 2, status: 'ok', issues: [] },
        source: { provider: 'legacy-forge', modelVersion: 'legacy-eg-v2', generatedAt: '2026-03-21T00:00:00.000Z' },
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
        week: 17,
        mode: 'redraft',
        score: { alpha: 81.5, tier: 'T2', tierRank: 2, confidence: 0.82 },
        components: { volume: 84, efficiency: 78, teamContext: 72, stability: 80 },
        metadata: { gamesSampled: 15, positionRank: 2, status: 'ok', issues: [] },
        source: {
          provider: 'external-forge',
          modelVersion: '2026.03.0',
          contractVersion: '1.0.0',
          calibrationVersion: 'alpha-redraft-2025-v1',
          generatedAt: '2026-03-21T00:00:00.000Z',
        },
      },
    },
    comparison: {
      scoreDelta: 1.5,
      componentDeltas: { volume: 2, efficiency: 1, teamContext: 2, stability: 1 },
      confidenceDelta: 0.02,
      notes: ['Alpha delta stayed within migration tolerance at 1.5 points.'],
      parityStatus: 'close',
    },
    ...overrides,
  };
}

describe('ForgeMigrationReviewService', () => {
  it('returns a stable migration review shape with aggregated summary metrics', async () => {
    const compare = jest
      .fn()
      .mockResolvedValueOnce(buildReviewResult())
      .mockResolvedValueOnce(
        buildReviewResult({
          request: { ...buildReviewResult().request, playerId: '00-0033280' },
          legacy: {
            ...buildReviewResult().legacy,
            data: { ...buildReviewResult().legacy.data, playerId: '00-0033280', playerName: 'Ja\'Marr Chase', team: 'CIN' },
          },
          external: {
            ...buildReviewResult().external,
            data: {
              ...buildReviewResult().external.data,
              playerId: '00-0033280',
              playerName: 'Ja\'Marr Chase',
              team: 'CIN',
              score: { alpha: 89, tier: 'T1', tierRank: 1, confidence: 0.91 },
              components: { volume: 93, efficiency: 86, teamContext: 77, stability: 88 },
            },
          },
          comparison: {
            scoreDelta: 9,
            componentDeltas: { volume: 11, efficiency: 9, teamContext: 7, stability: 9 },
            confidenceDelta: 0.11,
            notes: ['Tier changed from T2 to T1.', 'Alpha drift is 9 points.'],
            parityStatus: 'drift',
          },
        }),
      )
      .mockResolvedValueOnce(
        buildReviewResult({
          request: { ...buildReviewResult().request, playerId: '00-0037834' },
          legacy: {
            ...buildReviewResult().legacy,
            data: { ...buildReviewResult().legacy.data, playerId: '00-0037834', playerName: 'Puka Nacua', team: 'LAR' },
          },
          external: {
            available: false,
            error: { category: 'upstream_timeout', message: 'External FORGE timed out after 5000ms.' },
          },
          comparison: {
            parityStatus: 'unavailable',
            notes: ['Only one FORGE implementation returned data for this request.'],
          },
        }),
      );

    const review = await new ForgeMigrationReviewService(
      { compare } as any,
      {
        getStatus: jest.fn().mockReturnValue({
          enabled: true,
          configured: true,
          endpointPath: '/v1/forge/evaluations',
          timeoutMs: 5000,
          readiness: 'ready',
          startupConfigLogged: true,
        }),
      } as any,
      jest.fn().mockResolvedValue(sampledPlayers),
    ).generateReview(filters);

    expect(review).toMatchObject({
      generatedAt: expect.any(String),
      filters,
      integration: {
        enabled: true,
        baseUrlConfigured: true,
        readiness: 'ready',
        reviewRan: true,
        skippedReason: null,
      },
      sampledPlayers,
      summary: {
        totalPlayers: 3,
        comparableCount: 2,
        closeCount: 1,
        driftCount: 1,
        unavailableCount: 1,
        notComparableCount: 0,
        averageAbsoluteScoreDelta: 5.25,
        worstScoreDelta: {
          playerId: '00-0033280',
          playerName: 'Ja\'Marr Chase',
          delta: 9,
          absoluteDelta: 9,
        },
      },
    });
    expect(review.results).toHaveLength(3);
    expect(review.results[2]).toMatchObject({
      playerId: '00-0037834',
      comparison: { parityStatus: 'unavailable' },
      external: { available: false, error: { category: 'upstream_timeout' } },
    });
  });

  it('contains per-player compare failures instead of aborting the whole review', async () => {
    const compare = jest
      .fn()
      .mockResolvedValueOnce(buildReviewResult())
      .mockRejectedValueOnce(new Error('boom'));

    const review = await new ForgeMigrationReviewService(
      { compare } as any,
      {
        getStatus: jest.fn().mockReturnValue({
          enabled: true,
          configured: true,
          endpointPath: '/v1/forge/evaluations',
          timeoutMs: 5000,
          readiness: 'ready',
          startupConfigLogged: true,
        }),
      } as any,
      jest.fn().mockResolvedValue(sampledPlayers.slice(0, 2)),
    ).generateReview({ ...filters, limit: 2 });

    expect(review.summary).toMatchObject({
      totalPlayers: 2,
      closeCount: 1,
      unavailableCount: 1,
    });
    expect(review.results[1]).toMatchObject({
      playerId: '00-0033280',
      comparison: {
        parityStatus: 'unavailable',
        notes: ['Review comparison failed for sampled player 00-0033280: boom'],
      },
      external: {
        available: false,
        error: { category: 'upstream_unavailable', message: 'boom' },
      },
    });
  });

  it('returns deterministic unavailable review output when external FORGE is disabled', async () => {
    const compare = jest.fn();

    const review = await new ForgeMigrationReviewService(
      { compare } as any,
      {
        getStatus: jest.fn().mockReturnValue({
          enabled: false,
          configured: false,
          endpointPath: '/v1/forge/evaluations',
          timeoutMs: 5000,
          readiness: 'not_ready',
          startupConfigLogged: true,
        }),
      } as any,
      jest.fn().mockResolvedValue(sampledPlayers.slice(0, 2)),
    ).generateReview({ ...filters, limit: 2 });

    expect(compare).not.toHaveBeenCalled();
    expect(review.integration).toMatchObject({
      enabled: false,
      baseUrlConfigured: false,
      reviewRan: false,
      skippedReason: 'integration_disabled',
    });
    expect(review.summary).toMatchObject({
      totalPlayers: 2,
      comparableCount: 0,
      unavailableCount: 2,
      averageAbsoluteScoreDelta: null,
      worstScoreDelta: null,
    });
    expect(review.results).toEqual([
      expect.objectContaining({
        playerId: '00-0036322',
        comparison: {
          parityStatus: 'unavailable',
          notes: expect.arrayContaining(['External FORGE review ran in unavailable mode because the integration is disabled.']),
        },
        external: {
          available: false,
          error: { category: 'config_error', message: 'External FORGE integration is disabled.' },
        },
      }),
      expect.objectContaining({ playerId: '00-0033280' }),
    ]);
  });
});

describe('summarizeForgeMigrationReviewResults', () => {
  it('returns null delta metrics when no comparable players exist', () => {
    const summary = summarizeForgeMigrationReviewResults([
      {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        team: 'MIN',
        position: 'WR',
        legacy: { available: true },
        external: { available: false, error: { category: 'upstream_unavailable', message: 'down' } },
        comparison: { parityStatus: 'unavailable', notes: ['Only one side returned data.'] },
      },
    ]);

    expect(summary).toEqual({
      totalPlayers: 1,
      comparableCount: 0,
      closeCount: 0,
      driftCount: 0,
      unavailableCount: 1,
      notComparableCount: 0,
      averageAbsoluteScoreDelta: null,
      worstScoreDelta: null,
    });
  });
});

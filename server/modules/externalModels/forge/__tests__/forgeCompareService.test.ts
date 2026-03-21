import { ForgeCompareService, buildComparisonMetadata } from '../forgeCompareService';
import { ForgeIntegrationError, TiberForgeEvaluation } from '../types';

const baseLegacy: TiberForgeEvaluation = {
  playerId: '00-0036322',
  playerName: 'Justin Jefferson',
  position: 'WR',
  team: 'MIN',
  season: 2025,
  week: 17,
  mode: 'redraft',
  score: {
    alpha: 80,
    tier: 'T2',
    tierRank: 2,
    confidence: 0.8,
  },
  components: {
    volume: 82,
    efficiency: 77,
    teamContext: 70,
    stability: 79,
  },
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
};

const baseExternal: TiberForgeEvaluation = {
  ...baseLegacy,
  source: {
    provider: 'external-forge',
    contractVersion: '1.0.0',
    modelVersion: '2026.03.0',
    calibrationVersion: 'alpha-redraft-2025-v1',
    generatedAt: '2026-03-21T00:00:00.000Z',
  },
};

describe('ForgeCompareService', () => {
  it('computes close parity metadata when scores stay within tolerance', () => {
    const comparison = buildComparisonMetadata(baseLegacy, {
      ...baseExternal,
      score: { ...baseExternal.score, alpha: 81.5, confidence: 0.82 },
      components: {
        volume: 84,
        efficiency: 78,
        teamContext: 72,
        stability: 80,
      },
    });

    expect(comparison.parityStatus).toBe('close');
    expect(comparison.scoreDelta).toBe(1.5);
    expect(comparison.componentDeltas).toEqual({
      volume: 2,
      efficiency: 1,
      teamContext: 2,
      stability: 1,
    });
  });

  it('returns useful partial compare output when the external side fails', async () => {
    const service = new ForgeCompareService(
      {
        evaluatePlayer: jest.fn().mockRejectedValue(
          new ForgeIntegrationError('upstream_unavailable', 'External FORGE is currently unavailable.', 503),
        ),
      } as any,
      jest.fn().mockResolvedValue(baseLegacy),
    );

    const result = await service.compare({
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 17,
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    });

    expect(result.legacy.available).toBe(true);
    expect(result.external.available).toBe(false);
    expect(result.external.error).toMatchObject({
      category: 'upstream_unavailable',
    });
    expect(result.comparison.parityStatus).toBe('unavailable');
  });

  it('flags drift when deltas exceed tolerance', () => {
    const comparison = buildComparisonMetadata(baseLegacy, {
      ...baseExternal,
      score: { ...baseExternal.score, alpha: 88, tier: 'T1', confidence: 0.92 },
      components: {
        volume: 92,
        efficiency: 83,
        teamContext: 79,
        stability: 87,
      },
      metadata: {
        ...baseExternal.metadata,
        issues: [{ code: 'TD_OVER_INDEX', severity: 'warn', message: 'Touchdown rate is materially above baseline' }],
      },
    });

    expect(comparison.parityStatus).toBe('drift');
    expect(comparison.notes).toEqual(expect.arrayContaining([
      'Tier changed from T2 to T1.',
      'Alpha drift is 8 points.',
    ]));
  });
});

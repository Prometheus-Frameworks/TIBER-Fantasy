import { ForgeSourceSelector } from '../forgeSourceSelector';
import { ForgeIntegrationError } from '../types';

const request = {
  playerId: '00-0036322',
  position: 'WR',
  season: 2025,
  week: 'season' as const,
  mode: 'redraft' as const,
  includeSourceMeta: true,
  includeRawCanonical: false,
};

const legacyEvaluation = {
  playerId: '00-0036322',
  playerName: 'Justin Jefferson',
  position: 'WR' as const,
  team: 'MIN',
  season: 2025,
  week: 'season' as const,
  mode: 'redraft' as const,
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
    status: 'ok' as const,
    issues: [],
  },
  source: {
    provider: 'legacy-forge' as const,
    modelVersion: 'legacy-eg-v2',
    generatedAt: '2026-03-21T00:00:00.000Z',
  },
};

const externalEvaluation = {
  ...legacyEvaluation,
  score: {
    alpha: 81.5,
    tier: 'T2',
    tierRank: 2,
    confidence: 0.82,
  },
  components: {
    volume: 84,
    efficiency: 78,
    teamContext: 72,
    stability: 80,
  },
  source: {
    provider: 'external-forge' as const,
    modelVersion: '2026.03.0',
    generatedAt: '2026-03-21T00:00:00.000Z',
  },
};

describe('ForgeSourceSelector', () => {
  it('uses legacy only in legacy mode', async () => {
    const externalForge = { evaluatePlayer: jest.fn() };
    const legacyEvaluator = jest.fn().mockResolvedValue(legacyEvaluation);
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: true,
    });

    const result = await selector.select(request, 'legacy');

    expect(result).toEqual({
      available: true,
      requestedMode: 'legacy',
      selectedSource: 'legacy',
      fallbackOccurred: false,
      data: legacyEvaluation,
    });
    expect(legacyEvaluator).toHaveBeenCalledWith(request);
    expect(externalForge.evaluatePlayer).not.toHaveBeenCalled();
  });

  it('uses external only in external_preview mode', async () => {
    const externalForge = { evaluatePlayer: jest.fn().mockResolvedValue(externalEvaluation) };
    const legacyEvaluator = jest.fn();
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: true,
    });

    const result = await selector.select(request, 'external_preview');

    expect(result).toEqual({
      available: true,
      requestedMode: 'external_preview',
      selectedSource: 'external_preview',
      fallbackOccurred: false,
      data: externalEvaluation,
    });
    expect(externalForge.evaluatePlayer).toHaveBeenCalledWith(request, { includeRawCanonical: false });
    expect(legacyEvaluator).not.toHaveBeenCalled();
  });

  it('uses external in auto_with_legacy_fallback when external is available', async () => {
    const externalForge = { evaluatePlayer: jest.fn().mockResolvedValue(externalEvaluation) };
    const legacyEvaluator = jest.fn();
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: true,
    });

    const result = await selector.select(request, 'auto_with_legacy_fallback');

    expect(result).toEqual({
      available: true,
      requestedMode: 'auto_with_legacy_fallback',
      selectedSource: 'external_preview',
      fallbackOccurred: false,
      data: externalEvaluation,
    });
    expect(legacyEvaluator).not.toHaveBeenCalled();
  });

  it('falls back cleanly to legacy when preview mode is disabled in auto mode', async () => {
    const externalForge = { evaluatePlayer: jest.fn() };
    const legacyEvaluator = jest.fn().mockResolvedValue(legacyEvaluation);
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: false,
    });

    const result = await selector.select(request, 'auto_with_legacy_fallback');

    expect(result).toEqual({
      available: true,
      requestedMode: 'auto_with_legacy_fallback',
      selectedSource: 'legacy',
      fallbackOccurred: true,
      fallbackReason: 'preview_feature_disabled',
      data: legacyEvaluation,
    });
    expect(externalForge.evaluatePlayer).not.toHaveBeenCalled();
    expect(legacyEvaluator).toHaveBeenCalledWith(request);
  });

  it('falls back cleanly to legacy when external is unavailable in auto mode', async () => {
    const externalForge = {
      evaluatePlayer: jest.fn().mockRejectedValue(
        new ForgeIntegrationError('upstream_timeout', 'External FORGE timed out.', 504),
      ),
    };
    const legacyEvaluator = jest.fn().mockResolvedValue(legacyEvaluation);
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: true,
    });

    const result = await selector.select(request, 'auto_with_legacy_fallback');

    expect(result).toEqual({
      available: true,
      requestedMode: 'auto_with_legacy_fallback',
      selectedSource: 'legacy',
      fallbackOccurred: true,
      fallbackReason: 'upstream_timeout',
      data: legacyEvaluation,
    });
    expect(externalForge.evaluatePlayer).toHaveBeenCalledTimes(1);
    expect(legacyEvaluator).toHaveBeenCalledTimes(1);
  });

  it('falls back cleanly to legacy when external returns invalid data in auto mode', async () => {
    const externalForge = {
      evaluatePlayer: jest.fn().mockRejectedValue(
        new ForgeIntegrationError(
          'invalid_payload',
          'External FORGE returned a payload that does not match the canonical contract.',
          502,
        ),
      ),
    };
    const legacyEvaluator = jest.fn().mockResolvedValue(legacyEvaluation);
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: true,
    });

    const result = await selector.select(request, 'auto_with_legacy_fallback');

    expect(result).toEqual({
      available: true,
      requestedMode: 'auto_with_legacy_fallback',
      selectedSource: 'legacy',
      fallbackOccurred: true,
      fallbackReason: 'invalid_payload',
      data: legacyEvaluation,
    });
  });

  it('returns unavailable in external_preview mode when the preview flag is disabled', async () => {
    const externalForge = { evaluatePlayer: jest.fn() };
    const legacyEvaluator = jest.fn();
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: false,
    });

    const result = await selector.select(request, 'external_preview');

    expect(result).toEqual({
      available: false,
      requestedMode: 'external_preview',
      selectedSource: 'external_preview',
      fallbackOccurred: false,
      error: {
        category: 'config_error',
        message: 'FORGE source selector preview mode is disabled by configuration.',
      },
    });
    expect(legacyEvaluator).not.toHaveBeenCalled();
  });

  it('returns stable fallback metadata when legacy fallback also fails', async () => {
    const externalForge = {
      evaluatePlayer: jest.fn().mockRejectedValue(
        new ForgeIntegrationError('upstream_unavailable', 'External FORGE is currently unavailable.', 503),
      ),
    };
    const legacyEvaluator = jest.fn().mockRejectedValue(new Error('Legacy FORGE cache miss.'));
    const selector = new ForgeSourceSelector(externalForge as any, legacyEvaluator, {
      externalPreviewEnabled: true,
    });

    const result = await selector.select(request, 'auto_with_legacy_fallback');

    expect(result).toEqual({
      available: false,
      requestedMode: 'auto_with_legacy_fallback',
      selectedSource: 'legacy',
      fallbackOccurred: true,
      fallbackReason: 'upstream_unavailable',
      error: {
        category: 'legacy_error',
        message: 'Legacy FORGE cache miss.',
      },
    });
  });
});

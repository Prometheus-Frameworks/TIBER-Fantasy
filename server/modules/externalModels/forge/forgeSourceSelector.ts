import { evaluateLegacyForge, LegacyForgeEvaluator } from './forgeCompareService';
import { ForgeService, forgeService } from './forgeService';
import {
  ForgeIntegrationError,
  ForgeIntegrationErrorCode,
  TiberForgeComparisonRequest,
  TiberForgeEvaluation,
} from './types';

export type ForgeSourceSelectionMode = 'legacy' | 'external_preview' | 'auto_with_legacy_fallback';
export type ForgeSourceSelectionResultSource = 'legacy' | 'external_preview';
export type ForgeSourceSelectionFallbackReason =
  | 'preview_feature_disabled'
  | ForgeIntegrationErrorCode
  | 'legacy_error'
  | 'unexpected_error';

export interface ForgeSourceSelectorConfig {
  externalPreviewEnabled?: boolean;
}

export interface ForgeSourceSelectionSuccess {
  available: true;
  requestedMode: ForgeSourceSelectionMode;
  selectedSource: ForgeSourceSelectionResultSource;
  fallbackOccurred: boolean;
  fallbackReason?: ForgeSourceSelectionFallbackReason;
  data: TiberForgeEvaluation;
}

export interface ForgeSourceSelectionFailure {
  available: false;
  requestedMode: ForgeSourceSelectionMode;
  selectedSource: ForgeSourceSelectionResultSource;
  fallbackOccurred: boolean;
  fallbackReason?: ForgeSourceSelectionFallbackReason;
  error: {
    category: ForgeIntegrationErrorCode | 'legacy_error' | 'unexpected_error';
    message: string;
  };
}

export type ForgeSourceSelectionResult = ForgeSourceSelectionSuccess | ForgeSourceSelectionFailure;

function toLegacyFailure(
  requestedMode: ForgeSourceSelectionMode,
  selectedSource: ForgeSourceSelectionResultSource,
  fallbackOccurred: boolean,
  fallbackReason: ForgeSourceSelectionFallbackReason | undefined,
  error: unknown,
): ForgeSourceSelectionFailure {
  return {
    available: false,
    requestedMode,
    selectedSource,
    fallbackOccurred,
    fallbackReason,
    error: {
      category: 'legacy_error',
      message: error instanceof Error ? error.message : 'Legacy FORGE failed unexpectedly.',
    },
  };
}

function toExternalFailure(
  requestedMode: ForgeSourceSelectionMode,
  fallbackOccurred: boolean,
  fallbackReason: ForgeSourceSelectionFallbackReason | undefined,
  error: unknown,
): ForgeSourceSelectionFailure {
  if (error instanceof ForgeIntegrationError) {
    return {
      available: false,
      requestedMode,
      selectedSource: 'external_preview',
      fallbackOccurred,
      fallbackReason,
      error: {
        category: error.code,
        message: error.message,
      },
    };
  }

  return {
    available: false,
    requestedMode,
    selectedSource: 'external_preview',
    fallbackOccurred,
    fallbackReason,
    error: {
      category: 'unexpected_error',
      message: error instanceof Error ? error.message : 'External FORGE failed unexpectedly.',
    },
  };
}

function toPreviewDisabledFailure(requestedMode: ForgeSourceSelectionMode): ForgeSourceSelectionFailure {
  return {
    available: false,
    requestedMode,
    selectedSource: 'external_preview',
    fallbackOccurred: false,
    error: {
      category: 'config_error',
      message: 'FORGE source selector preview mode is disabled by configuration.',
    },
  };
}

export class ForgeSourceSelector {
  private readonly externalPreviewEnabled: boolean;

  constructor(
    private readonly externalForge: Pick<ForgeService, 'evaluatePlayer'> = forgeService,
    private readonly legacyEvaluator: LegacyForgeEvaluator = evaluateLegacyForge,
    config: ForgeSourceSelectorConfig = {},
  ) {
    this.externalPreviewEnabled = config.externalPreviewEnabled ?? process.env.FORGE_SOURCE_SELECTOR_PREVIEW_ENABLED === '1';
  }

  async select(
    request: TiberForgeComparisonRequest,
    mode: ForgeSourceSelectionMode,
  ): Promise<ForgeSourceSelectionResult> {
    if (mode === 'legacy') {
      try {
        const data = await this.legacyEvaluator(request);
        return {
          available: true,
          requestedMode: mode,
          selectedSource: 'legacy',
          fallbackOccurred: false,
          data,
        };
      } catch (error) {
        return toLegacyFailure(mode, 'legacy', false, undefined, error);
      }
    }

    if (!this.externalPreviewEnabled) {
      if (mode === 'external_preview') {
        return toPreviewDisabledFailure(mode);
      }

      try {
        const data = await this.legacyEvaluator(request);
        return {
          available: true,
          requestedMode: mode,
          selectedSource: 'legacy',
          fallbackOccurred: true,
          fallbackReason: 'preview_feature_disabled',
          data,
        };
      } catch (error) {
        return toLegacyFailure(mode, 'legacy', true, 'preview_feature_disabled', error);
      }
    }

    try {
      const data = await this.externalForge.evaluatePlayer(request, {
        includeRawCanonical: request.includeRawCanonical,
      });

      return {
        available: true,
        requestedMode: mode,
        selectedSource: 'external_preview',
        fallbackOccurred: false,
        data,
      };
    } catch (error) {
      const externalFailure = toExternalFailure(mode, false, undefined, error);

      if (mode === 'external_preview') {
        return externalFailure;
      }

      try {
        const data = await this.legacyEvaluator(request);
        return {
          available: true,
          requestedMode: mode,
          selectedSource: 'legacy',
          fallbackOccurred: true,
          fallbackReason: externalFailure.error.category,
          data,
        };
      } catch (legacyError) {
        return toLegacyFailure(mode, 'legacy', true, externalFailure.error.category, legacyError);
      }
    }
  }
}

export const forgeSourceSelector = new ForgeSourceSelector();

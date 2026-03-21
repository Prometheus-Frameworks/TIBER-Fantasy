import {
  CanonicalForgeEvaluationResponse,
  ForgeClientConfig,
  ForgeIntegrationError,
  TiberForgeComparisonRequest,
} from './types';

const DEFAULT_ENDPOINT_PATH = '/v1/forge/evaluations';
const DEFAULT_TIMEOUT_MS = 5000;

function mapModeToCanonical(mode: TiberForgeComparisonRequest['mode']) {
  return mode === 'bestball' ? 'best_ball' : mode;
}

export class ForgeClient {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;
  private readonly endpointPath: string;
  private readonly enabled: boolean;

  constructor(config: ForgeClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.FORGE_SERVICE_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? Number(process.env.FORGE_SERVICE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.endpointPath = config.endpointPath ?? process.env.FORGE_SERVICE_ENDPOINT_PATH ?? DEFAULT_ENDPOINT_PATH;
    this.enabled = config.enabled ?? process.env.FORGE_SERVICE_ENABLED !== '0';
  }

  getConfig() {
    return {
      enabled: this.enabled,
      configured: Boolean(this.baseUrl),
      baseUrl: this.baseUrl,
      endpointPath: this.endpointPath,
      timeoutMs: this.timeoutMs,
    };
  }

  async fetchEvaluation(request: TiberForgeComparisonRequest): Promise<CanonicalForgeEvaluationResponse> {
    if (!this.enabled) {
      throw new ForgeIntegrationError('config_error', 'External FORGE integration is disabled by configuration.', 503);
    }

    if (!this.baseUrl) {
      throw new ForgeIntegrationError('config_error', 'FORGE_SERVICE_BASE_URL is not configured.', 503);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(new URL(this.endpointPath, this.baseUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          season: request.season,
          week: request.week,
          mode: mapModeToCanonical(request.mode),
          players: [
            {
              player_id: request.playerId,
              position: request.position,
            },
          ],
          options: {
            include_components: true,
            include_source_meta: request.includeSourceMeta,
            include_debug: false,
            include_inputs: false,
          },
        }),
        signal: controller.signal,
      });

      if (response.status === 400) {
        throw new ForgeIntegrationError('invalid_request', 'External FORGE rejected the evaluation request.', 400);
      }

      if (response.status === 404) {
        throw new ForgeIntegrationError('not_found', `External FORGE did not find ${request.playerId}.`, 404);
      }

      if (response.status === 422) {
        throw new ForgeIntegrationError('unsupported', 'External FORGE does not support this request shape.', 422);
      }

      if (response.status >= 500) {
        throw new ForgeIntegrationError('upstream_unavailable', 'External FORGE is currently unavailable.', 503);
      }

      if (!response.ok) {
        throw new ForgeIntegrationError('invalid_payload', `External FORGE returned HTTP ${response.status}.`, 502);
      }

      return (await response.json()) as CanonicalForgeEvaluationResponse;
    } catch (error) {
      if (error instanceof ForgeIntegrationError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ForgeIntegrationError(
          'upstream_timeout',
          `External FORGE timed out after ${this.timeoutMs}ms.`,
          504,
          error,
        );
      }

      throw new ForgeIntegrationError(
        'upstream_unavailable',
        'External FORGE request failed before a valid response was received.',
        503,
        error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

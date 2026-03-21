import { adaptForgeEvaluation } from './forgeAdapter';
import { ForgeClient } from './forgeClient';
import { ForgeIntegrationError, TiberForgeComparisonRequest, TiberForgeEvaluation } from './types';

export class ForgeService {
  private readonly startupConfigLogged: boolean;

  constructor(private readonly client: ForgeClient = new ForgeClient()) {
    const config = this.client.getConfig();
    console.info(
      `[ForgeIntegration] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
        `(configured=${config.configured}, endpoint=${config.endpointPath}, timeoutMs=${config.timeoutMs})`,
    );
    this.startupConfigLogged = true;
  }

  getStatus() {
    const config = this.client.getConfig();
    return {
      ...config,
      readiness: config.enabled && config.configured ? 'ready' : 'not_ready',
      startupConfigLogged: this.startupConfigLogged,
    };
  }

  async evaluatePlayer(
    request: TiberForgeComparisonRequest,
    options: { includeRawCanonical?: boolean } = {},
  ): Promise<TiberForgeEvaluation> {
    try {
      const payload = await this.client.fetchEvaluation(request);
      return adaptForgeEvaluation(payload, options);
    } catch (error) {
      if (error instanceof ForgeIntegrationError) {
        throw error;
      }

      throw new ForgeIntegrationError('upstream_unavailable', 'External FORGE integration failed unexpectedly.', 503, error);
    }
  }
}

export const forgeService = new ForgeService();

import { adaptAgeCurveLab } from './ageCurvesAdapter';
import { AgeCurveClient, AgeCurveLabQuery } from './ageCurvesClient';
import { AgeCurveIntegrationError, TiberAgeCurveLab } from './types';

export class AgeCurvesService {
  private readonly startupConfigLogged: boolean;

  constructor(private readonly client: AgeCurveClient = new AgeCurveClient()) {
    const config = this.client.getConfig();
    console.info(
      `[AgeCurvesIntegration] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
        `(configured=${config.configured}, labEndpoint=${config.labEndpointPath}, exportsPath=${config.exportsPath}, timeoutMs=${config.timeoutMs})`,
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

  async getAgeCurveLab(
    query: AgeCurveLabQuery = {},
    options: { includeRawCanonical?: boolean } = {},
  ): Promise<TiberAgeCurveLab> {
    try {
      const payload = await this.client.fetchAgeCurveLab(query);
      return adaptAgeCurveLab(payload, options);
    } catch (error) {
      if (error instanceof AgeCurveIntegrationError) {
        throw error;
      }

      throw new AgeCurveIntegrationError('upstream_unavailable', 'Age Curve Lab integration failed unexpectedly.', 503, error);
    }
  }
}

export const ageCurvesService = new AgeCurvesService();

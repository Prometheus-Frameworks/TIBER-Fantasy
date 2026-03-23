import { adaptPointScenarioLab } from './pointScenariosAdapter';
import { PointScenarioIntegrationError, TiberPointScenarioLab } from './types';
import { PointScenarioLabQuery, PointScenariosClient } from './pointScenariosClient';

export class PointScenariosService {
  private readonly startupConfigLogged: boolean;

  constructor(private readonly client: PointScenariosClient = new PointScenariosClient()) {
    const config = this.client.getConfig();
    console.info(
      `[PointScenariosIntegration] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
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

  async getPointScenarioLab(
    query: PointScenarioLabQuery = {},
    options: { includeRawCanonical?: boolean } = {},
  ): Promise<TiberPointScenarioLab> {
    try {
      const payload = await this.client.fetchPointScenarioLab(query);
      return adaptPointScenarioLab(payload, options);
    } catch (error) {
      if (error instanceof PointScenarioIntegrationError) {
        throw error;
      }

      throw new PointScenarioIntegrationError('upstream_unavailable', 'Point Scenario Lab integration failed unexpectedly.', 503, error);
    }
  }
}

export const pointScenariosService = new PointScenariosService();

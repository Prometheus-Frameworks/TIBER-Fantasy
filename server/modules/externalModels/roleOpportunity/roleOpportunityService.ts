import { adaptRoleOpportunityInsight, adaptRoleOpportunityLab } from './roleOpportunityAdapter';
import { RoleOpportunityClient, RoleOpportunityLabQuery, RoleOpportunityQuery } from './roleOpportunityClient';
import { RoleOpportunityIntegrationError, TiberRoleOpportunityInsight, TiberRoleOpportunityLab } from './types';

export class RoleOpportunityService {
  private readonly startupConfigLogged: boolean;

  constructor(private readonly client: RoleOpportunityClient = new RoleOpportunityClient()) {
    const config = this.client.getConfig();
    console.info(
      `[RoleOpportunityIntegration] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
        `(configured=${config.configured}, endpoint=${config.endpointPath}, labEndpoint=${config.labEndpointPath}, exportsPath=${config.exportsPath}, timeoutMs=${config.timeoutMs})`,
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

  async getRoleOpportunityInsight(
    query: RoleOpportunityQuery,
    options: { includeRawCanonical?: boolean } = {},
  ): Promise<TiberRoleOpportunityInsight> {
    try {
      const payload = await this.client.fetchRoleOpportunity(query);
      return adaptRoleOpportunityInsight(payload, options);
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        throw error;
      }

      throw new RoleOpportunityIntegrationError(
        'upstream_unavailable',
        'Role opportunity integration failed unexpectedly.',
        503,
        error,
      );
    }
  }

  async getRoleOpportunityLab(
    query: RoleOpportunityLabQuery = {},
    options: { includeRawCanonical?: boolean } = {},
  ): Promise<TiberRoleOpportunityLab> {
    try {
      const payload = await this.client.fetchRoleOpportunityLab(query);
      return adaptRoleOpportunityLab(payload, options);
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        throw error;
      }

      throw new RoleOpportunityIntegrationError(
        'upstream_unavailable',
        'Role Opportunity Lab integration failed unexpectedly.',
        503,
        error,
      );
    }
  }
}

export const roleOpportunityService = new RoleOpportunityService();

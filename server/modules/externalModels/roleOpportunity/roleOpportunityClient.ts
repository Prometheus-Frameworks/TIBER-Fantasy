import {
  CanonicalRoleOpportunityResponse,
  RoleOpportunityClientConfig,
  RoleOpportunityIntegrationError,
} from './types';

const DEFAULT_ENDPOINT_PATH = '/api/role-opportunity';
const DEFAULT_TIMEOUT_MS = 5000;

export interface RoleOpportunityQuery {
  playerId: string;
  season: number;
  week: number;
}

export class RoleOpportunityClient {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;
  private readonly endpointPath: string;
  private readonly enabled: boolean;

  constructor(config: RoleOpportunityClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.ROLE_OPPORTUNITY_MODEL_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? Number(process.env.ROLE_OPPORTUNITY_MODEL_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.endpointPath = config.endpointPath ?? process.env.ROLE_OPPORTUNITY_MODEL_ENDPOINT_PATH ?? DEFAULT_ENDPOINT_PATH;
    this.enabled = config.enabled ?? process.env.ROLE_OPPORTUNITY_MODEL_ENABLED !== '0';
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

  async fetchRoleOpportunity(query: RoleOpportunityQuery): Promise<CanonicalRoleOpportunityResponse> {
    if (!this.enabled) {
      throw new RoleOpportunityIntegrationError(
        'config_error',
        'Role opportunity integration is disabled by configuration.',
        503,
      );
    }

    if (!this.baseUrl) {
      throw new RoleOpportunityIntegrationError(
        'config_error',
        'ROLE_OPPORTUNITY_MODEL_BASE_URL is not configured.',
        503,
      );
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
          player_id: query.playerId,
          season: query.season,
          week: query.week,
        }),
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new RoleOpportunityIntegrationError(
          'not_found',
          `Role opportunity insight was not found for ${query.playerId} (${query.season} week ${query.week}).`,
          404,
        );
      }

      if (response.status === 409) {
        throw new RoleOpportunityIntegrationError(
          'ambiguous',
          `Role opportunity request was ambiguous for ${query.playerId}.`,
          409,
        );
      }

      if (response.status >= 500) {
        throw new RoleOpportunityIntegrationError(
          'upstream_unavailable',
          'Role-and-opportunity-model is currently unavailable.',
          503,
        );
      }

      if (!response.ok) {
        throw new RoleOpportunityIntegrationError(
          'invalid_payload',
          `Role-and-opportunity-model returned HTTP ${response.status}.`,
          502,
        );
      }

      return (await response.json()) as CanonicalRoleOpportunityResponse;
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new RoleOpportunityIntegrationError(
          'upstream_timeout',
          `Role-and-opportunity-model timed out after ${this.timeoutMs}ms.`,
          504,
          error,
        );
      }

      throw new RoleOpportunityIntegrationError(
        'upstream_unavailable',
        'Role-and-opportunity-model request failed before a valid response was received.',
        503,
        error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

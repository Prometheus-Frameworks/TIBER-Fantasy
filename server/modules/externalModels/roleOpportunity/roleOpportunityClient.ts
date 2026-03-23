import { promises as fs } from 'fs';
import path from 'path';
import {
  CanonicalRoleOpportunityLabResponse,
  CanonicalRoleOpportunityResponse,
  RoleOpportunityClientConfig,
  RoleOpportunityIntegrationError,
} from './types';

const DEFAULT_ENDPOINT_PATH = '/api/role-opportunity';
const DEFAULT_LAB_ENDPOINT_PATH = '/api/role-opportunity/lab';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_EXPORTS_PATH = path.join(process.cwd(), 'data', 'role-opportunity', 'role_opportunity_lab.json');

export interface RoleOpportunityQuery {
  playerId: string;
  season: number;
  week: number;
}

export interface RoleOpportunityLabQuery {
  season?: number;
  week?: number;
}

export class RoleOpportunityClient {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;
  private readonly endpointPath: string;
  private readonly labEndpointPath: string;
  private readonly exportsPath: string;
  private readonly enabled: boolean;

  constructor(config: RoleOpportunityClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.ROLE_OPPORTUNITY_MODEL_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? Number(process.env.ROLE_OPPORTUNITY_MODEL_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.endpointPath = config.endpointPath ?? process.env.ROLE_OPPORTUNITY_MODEL_ENDPOINT_PATH ?? DEFAULT_ENDPOINT_PATH;
    this.labEndpointPath = config.labEndpointPath ?? process.env.ROLE_OPPORTUNITY_MODEL_LAB_ENDPOINT_PATH ?? DEFAULT_LAB_ENDPOINT_PATH;
    this.exportsPath = config.exportsPath ?? process.env.ROLE_OPPORTUNITY_EXPORTS_PATH ?? DEFAULT_EXPORTS_PATH;
    this.enabled = config.enabled ?? process.env.ROLE_OPPORTUNITY_MODEL_ENABLED !== '0';
  }

  getConfig() {
    return {
      enabled: this.enabled,
      configured: Boolean(this.baseUrl || this.exportsPath),
      baseUrl: this.baseUrl,
      endpointPath: this.endpointPath,
      labEndpointPath: this.labEndpointPath,
      exportsPath: this.exportsPath,
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

  async fetchRoleOpportunityLab(query: RoleOpportunityLabQuery = {}): Promise<CanonicalRoleOpportunityLabResponse | unknown> {
    if (!this.enabled) {
      throw new RoleOpportunityIntegrationError(
        'config_error',
        'Role opportunity integration is disabled by configuration.',
        503,
      );
    }

    if (this.baseUrl) {
      return this.fetchRoleOpportunityLabFromApi(query);
    }

    return this.readRoleOpportunityArtifact(query);
  }

  private async fetchRoleOpportunityLabFromApi(query: RoleOpportunityLabQuery): Promise<CanonicalRoleOpportunityLabResponse | unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL(this.labEndpointPath, this.baseUrl);
      if (query.season != null) {
        url.searchParams.set('season', String(query.season));
      }
      if (query.week != null) {
        url.searchParams.set('week', String(query.week));
      }

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new RoleOpportunityIntegrationError(
          'not_found',
          'Role Opportunity Lab upstream source returned no dataset.',
          404,
        );
      }

      if (response.status >= 500) {
        throw new RoleOpportunityIntegrationError(
          'upstream_unavailable',
          'Role Opportunity Lab upstream source is currently unavailable.',
          503,
        );
      }

      if (!response.ok) {
        throw new RoleOpportunityIntegrationError(
          'invalid_payload',
          `Role Opportunity Lab upstream source returned HTTP ${response.status}.`,
          502,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new RoleOpportunityIntegrationError(
          'upstream_timeout',
          `Role Opportunity Lab upstream source timed out after ${this.timeoutMs}ms.`,
          504,
          error,
        );
      }

      throw new RoleOpportunityIntegrationError(
        'upstream_unavailable',
        'Role Opportunity Lab upstream request failed before a valid response was received.',
        503,
        error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async readRoleOpportunityArtifact(query: RoleOpportunityLabQuery): Promise<unknown> {
    try {
      const raw = await fs.readFile(this.exportsPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return this.filterArtifact(parsed, query);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError?.code === 'ENOENT') {
        throw new RoleOpportunityIntegrationError(
          'not_found',
          'No Role Opportunity Lab artifact was found for TIBER-Fantasy to promote.',
          404,
          error,
        );
      }

      if (error instanceof SyntaxError) {
        throw new RoleOpportunityIntegrationError(
          'invalid_payload',
          'Role Opportunity Lab artifact is not valid JSON.',
          502,
          error,
        );
      }

      throw new RoleOpportunityIntegrationError(
        'upstream_unavailable',
        'Unable to read the Role Opportunity Lab artifact.',
        503,
        error,
      );
    }
  }

  private filterArtifact(payload: unknown, query: RoleOpportunityLabQuery): unknown {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const record = payload as Record<string, unknown>;
    const rows = this.extractRows(record);

    if (!rows) {
      return payload;
    }

    const filteredRows = rows.filter((row) => {
      if (!row || typeof row !== 'object') {
        return false;
      }

      const typedRow = row as Record<string, unknown>;
      const season = Number(typedRow.season);
      const week = Number(typedRow.week);

      if (query.season != null && season !== query.season) {
        return false;
      }

      if (query.week != null && Number.isFinite(week) && week !== query.week) {
        return false;
      }

      return true;
    });

    const envelope = Array.isArray(record.rows)
      ? { ...record, rows: filteredRows }
      : record.data && typeof record.data === 'object' && !Array.isArray(record.data)
        ? { ...record, data: { ...(record.data as Record<string, unknown>), rows: filteredRows } }
        : { ...record, rows: filteredRows };

    return envelope;
  }

  private extractRows(record: Record<string, unknown>): unknown[] | null {
    if (Array.isArray(record.rows)) return record.rows;
    if (Array.isArray(record.data)) return record.data;
    if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.rows)) return nested.rows;
      if (Array.isArray(nested.items)) return nested.items;
      if (Array.isArray(nested.results)) return nested.results;
    }
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.results)) return record.results;
    return null;
  }
}

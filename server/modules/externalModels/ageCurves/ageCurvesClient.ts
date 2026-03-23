import { promises as fs } from 'fs';
import path from 'path';
import { AgeCurveClientConfig, AgeCurveIntegrationError } from './types';

const DEFAULT_LAB_ENDPOINT_PATH = '/api/age-curves/lab';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_EXPORTS_PATH = path.join(process.cwd(), 'data', 'age-curves', 'age_curve_lab.json');

export interface AgeCurveLabQuery {
  season?: number;
}

export class AgeCurveClient {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;
  private readonly labEndpointPath: string;
  private readonly exportsPath: string;
  private readonly enabled: boolean;

  constructor(config: AgeCurveClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.AGE_CURVE_MODEL_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? Number(process.env.AGE_CURVE_MODEL_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    this.labEndpointPath = config.labEndpointPath ?? process.env.AGE_CURVE_MODEL_LAB_ENDPOINT_PATH ?? DEFAULT_LAB_ENDPOINT_PATH;
    this.exportsPath = config.exportsPath ?? process.env.AGE_CURVE_EXPORTS_PATH ?? DEFAULT_EXPORTS_PATH;
    this.enabled = config.enabled ?? process.env.AGE_CURVE_MODEL_ENABLED !== '0';
  }

  getConfig() {
    return {
      enabled: this.enabled,
      configured: Boolean(this.baseUrl || this.exportsPath),
      baseUrl: this.baseUrl,
      labEndpointPath: this.labEndpointPath,
      exportsPath: this.exportsPath,
      timeoutMs: this.timeoutMs,
    };
  }

  async fetchAgeCurveLab(query: AgeCurveLabQuery = {}): Promise<unknown> {
    if (!this.enabled) {
      throw new AgeCurveIntegrationError('config_error', 'Age Curve integration is disabled by configuration.', 503);
    }

    if (this.baseUrl) {
      return this.fetchAgeCurveLabFromApi(query);
    }

    return this.readAgeCurveArtifact(query);
  }

  private async fetchAgeCurveLabFromApi(query: AgeCurveLabQuery): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL(this.labEndpointPath, this.baseUrl);
      if (query.season != null) {
        url.searchParams.set('season', String(query.season));
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new AgeCurveIntegrationError('not_found', 'Age Curve Lab upstream source returned no dataset.', 404);
      }

      if (response.status >= 500) {
        throw new AgeCurveIntegrationError('upstream_unavailable', 'Age Curve Lab upstream source is currently unavailable.', 503);
      }

      if (!response.ok) {
        throw new AgeCurveIntegrationError(
          'invalid_payload',
          `Age Curve Lab upstream source returned HTTP ${response.status}.`,
          502,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AgeCurveIntegrationError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AgeCurveIntegrationError(
          'upstream_timeout',
          `Age Curve Lab upstream source timed out after ${this.timeoutMs}ms.`,
          504,
          error,
        );
      }

      throw new AgeCurveIntegrationError(
        'upstream_unavailable',
        'Age Curve Lab upstream request failed before a valid response was received.',
        503,
        error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async readAgeCurveArtifact(query: AgeCurveLabQuery): Promise<unknown> {
    try {
      const raw = await fs.readFile(this.exportsPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return this.filterArtifact(parsed, query);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError?.code === 'ENOENT') {
        throw new AgeCurveIntegrationError(
          'not_found',
          'No Age Curve Lab artifact was found for TIBER-Fantasy to promote.',
          404,
          error,
        );
      }

      if (error instanceof SyntaxError) {
        throw new AgeCurveIntegrationError('invalid_payload', 'Age Curve Lab artifact is not valid JSON.', 502, error);
      }

      throw new AgeCurveIntegrationError('upstream_unavailable', 'Unable to read the Age Curve Lab artifact.', 503, error);
    }
  }

  private filterArtifact(payload: unknown, query: AgeCurveLabQuery): unknown {
    if (query.season == null || !payload || typeof payload !== 'object') {
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

      const seasonCandidate = (row as Record<string, unknown>).season;
      return Number(seasonCandidate) === query.season;
    });

    return {
      ...record,
      season: query.season,
      rows: filteredRows,
    };
  }

  private extractRows(payload: Record<string, unknown>): unknown[] | null {
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.data)) return payload.data;
    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
      const nested = payload.data as Record<string, unknown>;
      if (Array.isArray(nested.rows)) return nested.rows;
      if (Array.isArray(nested.items)) return nested.items;
      if (Array.isArray(nested.results)) return nested.results;
    }

    return null;
  }
}

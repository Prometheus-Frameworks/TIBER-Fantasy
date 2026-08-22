import type { ScoringWeeklyPlayerCardV1 } from './fantasyForecastWeeklyPlayerV1Adapter';
import { ScoringServiceClient } from './scoringServiceClient';
import {
  ScoringResult,
  ScoringRosPlayerCard,
  ScoringWeeklyCompare,
  ScoringWeeklyCompareRequest,
  ScoringWeeklyPlayerCardRequest,
  ScoringWeeklyRankings,
  ScoringWeeklyRankingsRequest,
  ScoringServiceIntegrationError,
} from './types';

export class ScoringService {
  constructor(private readonly client: ScoringServiceClient = new ScoringServiceClient()) {}

  getStatus() {
    const config = this.client.getConfig();
    // FFI-3: a configured base URL is NOT readiness. Readiness requires a
    // successful semantic handshake against the v1 contract, which this
    // status endpoint has not performed — so it never reports 'ready'.
    return {
      ...config,
      readiness: config.configured ? 'configured_unverified' : 'not_ready',
    };
  }

  async getWeeklyPlayerCard(request: ScoringWeeklyPlayerCardRequest): Promise<ScoringResult<ScoringWeeklyPlayerCardV1>> {
    return this.safeRun(() => this.client.getWeeklyPlayerCard(request));
  }

  async getWeeklyRankings(request: ScoringWeeklyRankingsRequest): Promise<ScoringResult<ScoringWeeklyRankings>> {
    return this.safeRun(() => this.client.getWeeklyRankings(request));
  }

  async getRosPlayerCard(request: ScoringWeeklyPlayerCardRequest): Promise<ScoringResult<ScoringRosPlayerCard>> {
    return this.safeRun(() => this.client.getRosPlayerCard(request));
  }

  async getWeeklyCompare(request: ScoringWeeklyCompareRequest): Promise<ScoringResult<ScoringWeeklyCompare>> {
    return this.safeRun(() => this.client.getWeeklyCompare(request));
  }

  private async safeRun<T>(fn: () => Promise<T>): Promise<ScoringResult<T>> {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (error) {
      if (error instanceof ScoringServiceIntegrationError) {
        return { ok: false, code: error.code, message: error.message };
      }

      return {
        ok: false,
        code: 'upstream_unavailable',
        message: 'Scoring integration failed unexpectedly.',
      };
    }
  }
}

export const scoringService = new ScoringService();

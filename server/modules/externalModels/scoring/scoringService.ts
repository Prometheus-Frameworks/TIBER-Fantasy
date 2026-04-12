import { ScoringServiceClient } from './scoringServiceClient';
import {
  ScoringResult,
  ScoringRosPlayerCard,
  ScoringWeeklyCompare,
  ScoringWeeklyCompareRequest,
  ScoringWeeklyPlayerCard,
  ScoringWeeklyPlayerCardRequest,
  ScoringWeeklyRankings,
  ScoringWeeklyRankingsRequest,
  ScoringServiceIntegrationError,
} from './types';

export class ScoringService {
  constructor(private readonly client: ScoringServiceClient = new ScoringServiceClient()) {}

  getStatus() {
    const config = this.client.getConfig();
    return {
      ...config,
      readiness: config.configured ? 'ready' : 'not_ready',
    };
  }

  async getWeeklyPlayerCard(request: ScoringWeeklyPlayerCardRequest): Promise<ScoringResult<ScoringWeeklyPlayerCard>> {
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

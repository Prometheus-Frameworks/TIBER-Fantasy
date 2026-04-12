import {
  ScoringRosPlayerCard,
  ScoringServiceClientConfig,
  ScoringServiceIntegrationError,
  ScoringWeeklyCompare,
  ScoringWeeklyCompareRequest,
  ScoringWeeklyPlayerCard,
  ScoringWeeklyPlayerCardRequest,
  ScoringWeeklyRankings,
  ScoringWeeklyRankingsRequest,
  scoringRosPlayerCardSchema,
  scoringWeeklyCompareSchema,
  scoringWeeklyPlayerCardSchema,
  scoringWeeklyRankingsSchema,
} from './types';

const DEFAULT_TIMEOUT_MS = 5000;

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toRoleNotes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (typeof value === 'string' && value.trim().length > 0) return [value];
  return [];
}

function normalizePlayerCard(payload: unknown): ScoringWeeklyPlayerCard {
  const source = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  return {
    playerId: String(source.playerId ?? source.player_id ?? source.id ?? ''),
    playerName: String(source.playerName ?? source.player_name ?? 'Unknown Player'),
    team: asStringOrNull(source.team ?? source.teamAbbr ?? source.team_abbr),
    position: asStringOrNull(source.position ?? source.pos),
    expectedPoints: toNumberOrNull(source.expectedPoints ?? source.expected_points ?? source.expected),
    vorp: toNumberOrNull(source.vorp ?? source.valueOverReplacement),
    floor: toNumberOrNull(source.floor),
    median: toNumberOrNull(source.median ?? source.projectionMedian),
    ceiling: toNumberOrNull(source.ceiling),
    confidence: asStringOrNull(source.confidence ?? source.confidenceBand),
    volatility: asStringOrNull(source.volatility),
    fragility: asStringOrNull(source.fragility),
    weeklyOutlook: asStringOrNull(source.weeklyOutlook ?? source.weekly_outlook),
    roleSummary: asStringOrNull(source.roleSummary ?? source.role_summary),
    valueSummary: asStringOrNull(source.valueSummary ?? source.value_summary),
    roleNotes: toRoleNotes(source.roleNotes ?? source.role_notes),
  };
}

function normalizeRankings(payload: unknown): ScoringWeeklyRankings {
  const source = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const candidateItems = Array.isArray(source.items) ? source.items : Array.isArray(source.rankings) ? source.rankings : [];

  return {
    asOf: asStringOrNull(source.asOf ?? source.generatedAt),
    items: candidateItems.map((item, index) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        rank: Number(row.rank ?? index + 1),
        playerId: String(row.playerId ?? row.player_id ?? row.id ?? ''),
        playerName: String(row.playerName ?? row.player_name ?? 'Unknown Player'),
        team: asStringOrNull(row.team ?? row.team_abbr),
        position: asStringOrNull(row.position ?? row.pos),
        expectedPoints: toNumberOrNull(row.expectedPoints ?? row.expected_points),
        vorp: toNumberOrNull(row.vorp),
        floor: toNumberOrNull(row.floor),
        ceiling: toNumberOrNull(row.ceiling),
        confidenceBand: asStringOrNull(row.confidenceBand ?? row.confidence ?? row.confidence_band),
        weeklyOutlook: asStringOrNull(row.weeklyOutlook ?? row.weekly_outlook),
      };
    }),
  };
}

export class ScoringServiceClient {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;

  constructor(config: ScoringServiceClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.SCORING_SERVICE_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? Number(process.env.SCORING_SERVICE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  }

  getConfig() {
    return {
      configured: Boolean(this.baseUrl),
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
    };
  }

  async getWeeklyPlayerCard(request: ScoringWeeklyPlayerCardRequest): Promise<ScoringWeeklyPlayerCard> {
    const payload = await this.postJson('/api/tiber/weekly/player-card', request);
    return scoringWeeklyPlayerCardSchema.parse(normalizePlayerCard(payload));
  }

  async getWeeklyRankings(request: ScoringWeeklyRankingsRequest): Promise<ScoringWeeklyRankings> {
    const payload = await this.postJson('/api/tiber/weekly/rankings', request);
    return scoringWeeklyRankingsSchema.parse(normalizeRankings(payload));
  }

  async getRosPlayerCard(request: ScoringWeeklyPlayerCardRequest): Promise<ScoringRosPlayerCard> {
    const payload = await this.postJson('/api/tiber/ros/player-card', request);
    return scoringRosPlayerCardSchema.parse(normalizePlayerCard(payload));
  }

  async getWeeklyCompare(request: ScoringWeeklyCompareRequest): Promise<ScoringWeeklyCompare> {
    const payload = await this.postJson('/api/tiber/weekly/compare', request);
    const source = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    return scoringWeeklyCompareSchema.parse({
      asOf: asStringOrNull(source.asOf ?? source.generatedAt),
      leftPlayerId: asStringOrNull(source.leftPlayerId ?? source.left_player_id),
      rightPlayerId: asStringOrNull(source.rightPlayerId ?? source.right_player_id),
      expectedPointsDelta: toNumberOrNull(source.expectedPointsDelta ?? source.expected_points_delta),
      vorpDelta: toNumberOrNull(source.vorpDelta ?? source.vorp_delta),
      recommendation: asStringOrNull(source.recommendation),
    });
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    if (!this.baseUrl) {
      throw new ScoringServiceIntegrationError('config_error', 'SCORING_SERVICE_BASE_URL is not configured.', 503);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL(path, this.baseUrl);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ScoringServiceIntegrationError(
          'upstream_error',
          `Scoring service returned HTTP ${response.status} for ${path}.`,
          response.status >= 500 ? 503 : 502,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ScoringServiceIntegrationError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ScoringServiceIntegrationError('upstream_timeout', `Scoring service timed out after ${this.timeoutMs}ms.`, 504, error);
      }
      throw new ScoringServiceIntegrationError('upstream_unavailable', 'Scoring service request failed.', 503, error);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

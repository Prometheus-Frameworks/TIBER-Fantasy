import { z } from 'zod';
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

// Malformed upstream data (fails schema validation) is a distinct failure mode from
// connectivity/timeout errors and must not be bucketed with them — callers rely on the
// error `code` to tell "scoring service is down" apart from "scoring service replied with
// garbage," and the latter must never be silently treated as an empty/successful result.
// Scoped to getWeeklyRankings only (TIBER-Ops #19's weekly-rankings defect slice); the
// other scoring-service methods keep their original `.parse()` behavior.
function parseOrThrowInvalidPayload<S extends z.ZodTypeAny>(schema: S, data: unknown, context: string): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ScoringServiceIntegrationError(
      'invalid_payload',
      `Scoring service returned a malformed ${context} payload: ${result.error.message}`,
      502,
      result.error,
    );
  }
  return result.data;
}

const DEFAULT_TIMEOUT_MS = 5000;

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
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
  // A missing, null, or non-array items/rankings collection is malformed upstream data,
  // not a genuine empty result — only an explicit `[]` counts as "no rankings this week."
  // Collapsing the two would let a broken upstream response render as "0 players" instead
  // of surfacing as an error.
  const rawCollection = source.items ?? source.rankings;
  if (!Array.isArray(rawCollection)) {
    throw new ScoringServiceIntegrationError(
      'invalid_payload',
      'Scoring service weekly rankings payload is missing an items/rankings array.',
      502,
    );
  }

  return {
    asOf: asStringOrNull(source.asOf ?? source.generatedAt),
    items: rawCollection.map((item, index) => {
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

function parseTimeoutMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.round(parsed);
}

function unwrapServiceEnvelope(payload: unknown): Record<string, unknown> {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const ok = root.ok;
  if (ok !== true) {
    throw new ScoringServiceIntegrationError('invalid_payload', 'Scoring service returned a non-ok envelope.', 502);
  }
  const data = root.data;
  if (!data || typeof data !== 'object') {
    throw new ScoringServiceIntegrationError('invalid_payload', 'Scoring service envelope missing data payload.', 502);
  }
  return data as Record<string, unknown>;
}

function toUpstreamLeagueContext(context: Record<string, unknown>) {
  return {
    season: context.season,
    week: context.week,
    scoring_format: context.scoringFormat ?? context.scoring_format ?? 'ppr',
    num_teams: context.teams ?? context.num_teams ?? 12,
  };
}

export class ScoringServiceClient {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;

  constructor(config: ScoringServiceClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.SCORING_SERVICE_BASE_URL;
    this.timeoutMs = parseTimeoutMs(config.timeoutMs ?? process.env.SCORING_SERVICE_TIMEOUT_MS);
  }

  getConfig() {
    return {
      configured: Boolean(this.baseUrl),
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
    };
  }

  async getWeeklyPlayerCard(request: ScoringWeeklyPlayerCardRequest): Promise<ScoringWeeklyPlayerCard> {
    const payload = await this.postJson('/api/tiber/weekly/player-card', {
      players: [request.player],
      league_context: toUpstreamLeagueContext(request.leagueContext),
    });
    const envelope = unwrapServiceEnvelope(payload);
    return scoringWeeklyPlayerCardSchema.parse(normalizePlayerCard(envelope.card));
  }

  async getWeeklyRankings(request: ScoringWeeklyRankingsRequest): Promise<ScoringWeeklyRankings> {
    const payload = await this.postJson('/api/tiber/weekly/rankings', {
      players: request.players,
      league_context: toUpstreamLeagueContext(request.leagueContext),
    });
    const envelope = unwrapServiceEnvelope(payload);
    return parseOrThrowInvalidPayload(scoringWeeklyRankingsSchema, normalizeRankings(envelope.view), 'weekly rankings');
  }

  async getRosPlayerCard(request: ScoringWeeklyPlayerCardRequest): Promise<ScoringRosPlayerCard> {
    const payload = await this.postJson('/api/tiber/ros/player-card', {
      players: [request.player],
      league_context: toUpstreamLeagueContext(request.leagueContext),
      remaining_weeks: request.remainingWeeks,
    });
    const envelope = unwrapServiceEnvelope(payload);
    return scoringRosPlayerCardSchema.parse(normalizePlayerCard(envelope.card));
  }

  async getWeeklyCompare(request: ScoringWeeklyCompareRequest): Promise<ScoringWeeklyCompare> {
    const payload = await this.postJson('/api/tiber/weekly/compare', {
      player_a: request.playerA,
      player_b: request.playerB,
      league_context: toUpstreamLeagueContext(request.leagueContext),
    });
    const envelope = unwrapServiceEnvelope(payload);
    const source = (envelope.view && typeof envelope.view === 'object' ? envelope.view : envelope) as Record<string, unknown>;
    return scoringWeeklyCompareSchema.parse({
      asOf: asStringOrNull(source.asOf ?? source.generatedAt),
      view: {
        verdict: asStringOrNull(source.verdict),
        playerA: asStringOrNull(source.player_a ?? source.playerA),
        playerB: asStringOrNull(source.player_b ?? source.playerB),
        deltas: {
          expectedPoints: toNumberOrNull(
            source.expectedPointsDelta ?? source.expected_points_delta ?? (source.deltas as any)?.expected_points,
          ),
          vorp: toNumberOrNull(source.vorpDelta ?? source.vorp_delta ?? (source.deltas as any)?.vorp),
        },
        recommendation: asStringOrNull(source.recommendation ?? source.summary),
      },
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

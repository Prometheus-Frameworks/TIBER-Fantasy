import { ForgeCompareService, forgeCompareService } from './forgeCompareService';
import { ForgeService, forgeService } from './forgeService';
import {
  TiberForgeComparisonResult,
  TiberForgeMode,
  TiberForgePosition,
  TiberForgeWeek,
} from './types';

export interface ForgeMigrationReviewFilters {
  position: TiberForgePosition;
  season: number;
  week: TiberForgeWeek;
  limit: number;
  mode: TiberForgeMode;
  includeSourceMeta: boolean;
  includeRawCanonical: boolean;
}

export interface ForgeMigrationReviewSamplePlayer {
  playerId: string;
  playerName: string;
  team: string | null;
  position: TiberForgePosition;
}

export interface ForgeMigrationReviewPlayerResult {
  playerId: string;
  playerName: string;
  team: string | null;
  position: TiberForgePosition;
  legacy: TiberForgeComparisonResult['legacy'];
  external: TiberForgeComparisonResult['external'];
  comparison: TiberForgeComparisonResult['comparison'];
}

export interface ForgeMigrationReviewSummary {
  totalPlayers: number;
  comparableCount: number;
  closeCount: number;
  driftCount: number;
  unavailableCount: number;
  notComparableCount: number;
  averageAbsoluteScoreDelta: number | null;
  worstScoreDelta: {
    playerId: string;
    playerName: string;
    delta: number;
    absoluteDelta: number;
  } | null;
}

export interface ForgeMigrationReviewReport {
  generatedAt: string;
  filters: ForgeMigrationReviewFilters;
  integration: {
    enabled: boolean;
    baseUrlConfigured: boolean;
    endpointPath: string;
    timeoutMs: number;
    readiness: 'ready' | 'not_ready';
    startupConfigLogged: boolean;
    reviewRan: boolean;
    skippedReason: 'integration_disabled' | 'base_url_missing' | null;
  };
  sampledPlayers: ForgeMigrationReviewSamplePlayer[];
  summary: ForgeMigrationReviewSummary;
  results: ForgeMigrationReviewPlayerResult[];
}

export type ForgeMigrationPlayerSampler = (filters: ForgeMigrationReviewFilters) => Promise<ForgeMigrationReviewSamplePlayer[]>;

function roundDelta(value: number, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function toSkippedComparisonNotes(skippedReason: NonNullable<ForgeMigrationReviewReport['integration']['skippedReason']>) {
  return [
    skippedReason === 'integration_disabled'
      ? 'External FORGE review ran in unavailable mode because the integration is disabled.'
      : 'External FORGE review ran in unavailable mode because FORGE_SERVICE_BASE_URL is not configured.',
  ];
}

function buildSkippedPlayerResult(
  sampledPlayer: ForgeMigrationReviewSamplePlayer,
  filters: ForgeMigrationReviewFilters,
  skippedReason: NonNullable<ForgeMigrationReviewReport['integration']['skippedReason']>,
): ForgeMigrationReviewPlayerResult {
  return {
    playerId: sampledPlayer.playerId,
    playerName: sampledPlayer.playerName,
    team: sampledPlayer.team,
    position: sampledPlayer.position,
    legacy: {
      available: false,
      error: {
        category: 'legacy_error',
        message: 'Legacy FORGE review was skipped because external FORGE is unavailable for migration review.',
      },
    },
    external: {
      available: false,
      error: {
        category: 'config_error',
        message:
          skippedReason === 'integration_disabled'
            ? 'External FORGE integration is disabled.'
            : 'FORGE_SERVICE_BASE_URL is not configured.',
      },
    },
    comparison: {
      parityStatus: 'unavailable',
      notes: [
        ...toSkippedComparisonNotes(skippedReason),
        `Sampled request retained filters for ${filters.position} ${filters.season} week ${String(filters.week)}.`,
      ],
    },
  };
}

function toReviewPlayerResult(
  sampledPlayer: ForgeMigrationReviewSamplePlayer,
  comparisonResult: TiberForgeComparisonResult,
): ForgeMigrationReviewPlayerResult {
  const legacyPlayer = comparisonResult.legacy.data;
  const externalPlayer = comparisonResult.external.data;

  return {
    playerId: sampledPlayer.playerId,
    playerName: legacyPlayer?.playerName ?? externalPlayer?.playerName ?? sampledPlayer.playerName,
    team: legacyPlayer?.team ?? externalPlayer?.team ?? sampledPlayer.team,
    position: sampledPlayer.position,
    legacy: comparisonResult.legacy,
    external: comparisonResult.external,
    comparison: comparisonResult.comparison,
  };
}

export function summarizeForgeMigrationReviewResults(
  results: ForgeMigrationReviewPlayerResult[],
): ForgeMigrationReviewSummary {
  const comparableResults = results.filter((result) => result.comparison.parityStatus === 'close' || result.comparison.parityStatus === 'drift');
  const deltas = comparableResults
    .map((result) => result.comparison.scoreDelta)
    .filter((delta): delta is number => typeof delta === 'number');

  const worst = deltas.length === 0
    ? null
    : results
        .filter((result): result is ForgeMigrationReviewPlayerResult & { comparison: ForgeMigrationReviewPlayerResult['comparison'] & { scoreDelta: number } } => typeof result.comparison.scoreDelta === 'number')
        .reduce((currentWorst, result) => {
          const absoluteDelta = Math.abs(result.comparison.scoreDelta!);
          if (!currentWorst || absoluteDelta > currentWorst.absoluteDelta) {
            return {
              playerId: result.playerId,
              playerName: result.playerName,
              delta: result.comparison.scoreDelta!,
              absoluteDelta,
            };
          }
          return currentWorst;
        }, null as ForgeMigrationReviewSummary['worstScoreDelta']);

  const averageAbsoluteScoreDelta =
    deltas.length === 0 ? null : roundDelta(deltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / deltas.length);

  return {
    totalPlayers: results.length,
    comparableCount: comparableResults.length,
    closeCount: results.filter((result) => result.comparison.parityStatus === 'close').length,
    driftCount: results.filter((result) => result.comparison.parityStatus === 'drift').length,
    unavailableCount: results.filter((result) => result.comparison.parityStatus === 'unavailable').length,
    notComparableCount: results.filter((result) => result.comparison.parityStatus === 'not_comparable').length,
    averageAbsoluteScoreDelta,
    worstScoreDelta: worst ? { ...worst, absoluteDelta: roundDelta(worst.absoluteDelta), delta: roundDelta(worst.delta) } : null,
  };
}

export async function sampleForgeMigrationReviewPlayers(
  filters: ForgeMigrationReviewFilters,
): Promise<ForgeMigrationReviewSamplePlayer[]> {
  const { runForgeEngineBatch } = await import('../../forge/forgeEngine');
  const sampled = await runForgeEngineBatch(filters.position, filters.season, filters.week, filters.limit);

  return sampled.slice(0, filters.limit).map((player) => ({
    playerId: player.playerId,
    playerName: player.playerName,
    team: player.nflTeam ?? null,
    position: player.position as TiberForgePosition,
  }));
}

export class ForgeMigrationReviewService {
  constructor(
    private readonly compareService: Pick<ForgeCompareService, 'compare'> = forgeCompareService,
    private readonly service: Pick<ForgeService, 'getStatus'> = forgeService,
    private readonly samplePlayers: ForgeMigrationPlayerSampler = sampleForgeMigrationReviewPlayers,
  ) {}

  async generateReview(filters: ForgeMigrationReviewFilters): Promise<ForgeMigrationReviewReport> {
    const generatedAt = new Date().toISOString();
    const status = this.service.getStatus();
    const skippedReason = !status.enabled ? 'integration_disabled' : !status.configured ? 'base_url_missing' : null;
    const sampledPlayers = await this.samplePlayers(filters);

    const results = skippedReason
      ? sampledPlayers.map((sampledPlayer) => buildSkippedPlayerResult(sampledPlayer, filters, skippedReason))
      : await Promise.all(
          sampledPlayers.map(async (sampledPlayer) => {
            try {
              const comparisonResult = await this.compareService.compare({
                playerId: sampledPlayer.playerId,
                position: sampledPlayer.position,
                season: filters.season,
                week: filters.week,
                mode: filters.mode,
                includeSourceMeta: filters.includeSourceMeta,
                includeRawCanonical: filters.includeRawCanonical,
              });

              return toReviewPlayerResult(sampledPlayer, comparisonResult);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unexpected FORGE review failure.';
              return {
                playerId: sampledPlayer.playerId,
                playerName: sampledPlayer.playerName,
                team: sampledPlayer.team,
                position: sampledPlayer.position,
                legacy: {
                  available: false,
                  error: {
                    category: 'legacy_error',
                    message: 'Legacy FORGE comparison failed before a stable review result could be assembled.',
                  },
                },
                external: {
                  available: false,
                  error: {
                    category: 'upstream_unavailable',
                    message,
                  },
                },
                comparison: {
                  parityStatus: 'unavailable',
                  notes: [`Review comparison failed for sampled player ${sampledPlayer.playerId}: ${message}`],
                },
              } satisfies ForgeMigrationReviewPlayerResult;
            }
          }),
        );

    return {
      generatedAt,
      filters,
      integration: {
        enabled: status.enabled,
        baseUrlConfigured: status.configured,
        endpointPath: status.endpointPath,
        timeoutMs: status.timeoutMs,
        readiness: status.readiness,
        startupConfigLogged: status.startupConfigLogged,
        reviewRan: skippedReason == null,
        skippedReason,
      },
      sampledPlayers,
      summary: summarizeForgeMigrationReviewResults(results),
      results,
    };
  }
}

export const forgeMigrationReviewService = new ForgeMigrationReviewService();

import type { Request, Response } from 'express';
import type { WeeklyRow } from '../../shared/types/fantasy';
import {
  EvidenceIngestionTargetUnavailableError,
  InvalidEvidenceIngestionTargetError,
  requireEvidenceIngestionDefaultTarget,
  resolveEvidenceIngestionTarget,
} from '../config/season';

export interface NflfastRWeeklySyncService {
  fetchSeasonToDate: (season?: number, throughWeek?: number) => Promise<WeeklyRow[]>;
  fetchWeeklyFromNflfastR: (season: number, week: number) => Promise<WeeklyRow[]>;
  resolveSeasonToDateWeekBound: (season: number, now?: Date) => number;
}

export interface WeeklySyncDependencies {
  loadNflfastR: () => Promise<NflfastRWeeklySyncService>;
  upsertWeeklyStats: (
    stats: WeeklyRow[],
  ) => Promise<{ inserted: number; updated?: number }>;
}

/**
 * Mounted POST /api/weekly/sync handler core. Dependencies stay explicit so
 * the request boundary can be regressed without loading the full monolith.
 */
export async function handleWeeklySync(
  req: Request,
  res: Response,
  dependencies: WeeklySyncDependencies,
): Promise<void> {
  try {
    const nflfastr = await dependencies.loadNflfastR();
    const requestedSeason = req.body?.season as number | undefined;
    const requestedWeek = req.body?.week as number | undefined;

    let season: number;
    let week: number | undefined;
    let throughWeek: number | undefined;

    if (requestedSeason === undefined && requestedWeek === undefined) {
      const target = requireEvidenceIngestionDefaultTarget();
      season = target.season;
      throughWeek = target.week;
    } else if (requestedWeek !== undefined) {
      const target = resolveEvidenceIngestionTarget({
        season: requestedSeason,
        week: requestedWeek,
      });
      season = target.season;
      week = target.week;
    } else {
      if (!Number.isInteger(requestedSeason) || requestedSeason! < 2000 || requestedSeason! > 2100) {
        throw new InvalidEvidenceIngestionTargetError(
          'Season must be an integer between 2000 and 2100.',
        );
      }
      season = requestedSeason!;
      throughWeek = nflfastr.resolveSeasonToDateWeekBound(season);
    }

    let stats: WeeklyRow[];
    if (week !== undefined) {
      console.log(`🔄 [Weekly Sync] Fetching season=${season} week=${week}...`);
      stats = await nflfastr.fetchWeeklyFromNflfastR(season, week);
    } else {
      console.log(`🔄 [Weekly Sync] Fetching season=${season} (season-to-date)...`);
      stats = await nflfastr.fetchSeasonToDate(season, throughWeek);
    }

    const result = await dependencies.upsertWeeklyStats(stats);

    console.log(`✅ [Weekly Sync] Synced ${result.inserted} records for season=${season}`);

    res.json({
      success: true,
      season,
      week: week || 'all',
      records: result.inserted,
      message: `Successfully synced ${result.inserted} weekly stat records`,
    });
  } catch (error) {
    console.error('❌ [Weekly Sync] Sync failed:', error);
    const status =
      error instanceof EvidenceIngestionTargetUnavailableError ||
      error instanceof InvalidEvidenceIngestionTargetError
        ? error.statusCode
        : 500;
    res.status(status).json({
      success: false,
      error: (error as Error).message || 'Unknown error',
    });
  }
}

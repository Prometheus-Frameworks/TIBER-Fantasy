import { elapsedRegularSeasonWeeks } from '../../shared/nflSeasonCalendar';
import { InvalidEvidenceIngestionTargetError } from '../config/season';

/**
 * NFLfastR archives this service can fetch season-wide even though they predate
 * the live presentation calendar. Keep this metadata local to the producer:
 * it must not make an old season look like a configured live season or become
 * a fallback for no-argument evidence jobs.
 */
export const NFLFASTR_COMPLETED_ARCHIVE_WEEK_BOUNDS: Readonly<Partial<Record<number, number>>> =
  Object.freeze({
    2024: 18,
  });

/**
 * Resolve the honest upper bound for an explicit season-to-date NFLfastR sync.
 * Configured seasons use their own calendar and can therefore resolve to zero
 * before Week 1. Only explicitly supported, completed archives may use a fixed
 * terminal week; unknown seasons fail closed.
 */
export function resolveNflfastrSeasonToDateWeekBound(
  season: number,
  now: Date = new Date(),
): number {
  if (!Number.isInteger(season) || season < 2000 || season > 2100) {
    throw new InvalidEvidenceIngestionTargetError('Season must be an integer between 2000 and 2100.');
  }

  const elapsed = elapsedRegularSeasonWeeks(season, now);
  if (elapsed !== null) return elapsed;

  const completedArchiveBound = NFLFASTR_COMPLETED_ARCHIVE_WEEK_BOUNDS[season];
  if (completedArchiveBound !== undefined) return completedArchiveBound;

  throw new InvalidEvidenceIngestionTargetError(
    `Season ${season} is not present in the configured NFL calendar and has no completed NFLfastR archive bound.`,
  );
}

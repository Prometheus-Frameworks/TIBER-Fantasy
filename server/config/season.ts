import { elapsedRegularSeasonWeeks } from '../../shared/nflSeasonCalendar';
import { resolveSeasonPhase } from '../../shared/weekDetection';

const DEFAULT_SEASON = 2026;
const CACHE_STALE_AFTER_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CacheTimestamp = string | number | Date | null | undefined;

export function resolveCurrentSeason(value?: string): number {
  const normalized = value?.trim();
  return normalized && /^20\d{2}$/.test(normalized)
    ? Number.parseInt(normalized, 10)
    : DEFAULT_SEASON;
}

export const CURRENT_SEASON = resolveCurrentSeason(process.env.TIBER_SEASON);

/**
 * Configured default for the governed weekly evidence, Bronze, Buys/Sells,
 * nflfastR, UPH, and schedule-sync lanes plus the public season-agreement signal.
 * Keeping the alias here means those no-argument writes and their health views
 * cannot drift onto individual year literals. Source-observed jobs (for
 * example Sleeper roster changes) use the separate phase-aware resolver below
 * because preseason observations are valid even without a football evidence week.
 */
export const INGESTION_DEFAULT_SEASON = CURRENT_SEASON;

export type EvidenceIngestionTargetFailureCode =
  | 'invalid_clock'
  | 'calendar_unavailable'
  | 'season_mismatch'
  | 'no_evidence_week';

export interface EvidenceIngestionTarget {
  season: number;
  week: number;
}

/**
 * Season/week attribution for source-observed events such as roster changes.
 * It shares the tuple shape with evidence ingestion, but not its semantics:
 * preseason roster movement is an observation and may truthfully be assigned
 * to the configured phase target even though no football evidence week exists.
 */
export type SourceObservedTarget = EvidenceIngestionTarget;

export type SourceObservedTargetFailureCode =
  | 'invalid_clock'
  | 'calendar_unavailable'
  | 'season_mismatch'
  | 'target_unavailable';

export type SourceObservedTargetResolution =
  | {
      available: true;
      target: SourceObservedTarget;
    }
  | {
      available: false;
      code: SourceObservedTargetFailureCode;
      reason: string;
      configuredSeason: number;
      phaseSeason: number | null;
    };

export type EvidenceIngestionTargetResolution =
  | {
      available: true;
      target: EvidenceIngestionTarget;
    }
  | {
      available: false;
      code: EvidenceIngestionTargetFailureCode;
      reason: string;
      configuredSeason: number;
      phaseSeason: number | null;
    };

/**
 * Resolve the season/week pair used by no-argument evidence ingestion jobs.
 *
 * This intentionally uses elapsed regular-season evidence, not the decision
 * target exposed to forward-looking UI surfaces. During preseason, for
 * example, Week 1 is a valid planning target but no Week 1 evidence exists yet,
 * so evidence jobs fail closed instead of manufacturing a future-week run.
 *
 * The pair is atomic: both values come from the same configured calendar and
 * clock. A configured season mismatch, stale calendar, invalid clock, or zero
 * elapsed evidence weeks makes the whole resolution unavailable.
 */
export function resolveEvidenceIngestionDefaultTarget(
  now: Date = new Date(),
  configuredSeason: number = INGESTION_DEFAULT_SEASON,
): EvidenceIngestionTargetResolution {
  if (Number.isNaN(now.getTime())) {
    return {
      available: false,
      code: 'invalid_clock',
      reason: 'Cannot resolve an evidence ingestion target from an invalid clock value.',
      configuredSeason,
      phaseSeason: null,
    };
  }

  if (!Number.isInteger(configuredSeason) || configuredSeason < 2000 || configuredSeason > 2100) {
    return {
      available: false,
      code: 'season_mismatch',
      reason: 'Configured ingestion season must be an integer between 2000 and 2100.',
      configuredSeason,
      phaseSeason: null,
    };
  }

  const phase = resolveSeasonPhase(now);
  if (phase.configStatus !== 'ok') {
    return {
      available: false,
      code: 'calendar_unavailable',
      reason: phase.configNote ?? 'The NFL season calendar is unavailable.',
      configuredSeason,
      // `resolveSeasonPhase()` uses newest+1 only as an internal stale-calendar
      // sentinel. It is not a governed season fact and must not escape through
      // ingestion observability.
      phaseSeason: null,
    };
  }

  if (phase.season !== configuredSeason) {
    return {
      available: false,
      code: 'season_mismatch',
      reason:
        `Configured ingestion season ${configuredSeason} does not match ` +
        `the evidence phase season ${phase.season} (${phase.seasonPhaseLabel}).`,
      configuredSeason,
      phaseSeason: phase.season,
    };
  }

  const elapsedWeek = elapsedRegularSeasonWeeks(configuredSeason, now);
  if (elapsedWeek === null || elapsedWeek < 1) {
    return {
      available: false,
      code: 'no_evidence_week',
      reason:
        `No regular-season evidence week is available for ${configuredSeason} ` +
        `during ${phase.seasonPhaseLabel}.`,
      configuredSeason,
      phaseSeason: phase.season,
    };
  }

  return {
    available: true,
    target: { season: configuredSeason, week: elapsedWeek },
  };
}

/**
 * Resolve the atomic season/week attribution for source-observed events.
 *
 * During the regular season the event belongs to the in-flight phase week,
 * never the forward decision week. Outside it, a configured phase target
 * (for example 2026 Week 1 during the 2026 preseason) is valid attribution
 * for roster movement even though it is not football evidence. A stale
 * calendar, missing phase target, or config mismatch fails closed.
 */
export function resolveSourceObservedDefaultTarget(
  now: Date = new Date(),
  configuredSeason: number = INGESTION_DEFAULT_SEASON,
): SourceObservedTargetResolution {
  if (Number.isNaN(now.getTime())) {
    return {
      available: false,
      code: 'invalid_clock',
      reason: 'Cannot resolve a source-observed target from an invalid clock value.',
      configuredSeason,
      phaseSeason: null,
    };
  }

  if (!Number.isInteger(configuredSeason) || configuredSeason < 2000 || configuredSeason > 2100) {
    return {
      available: false,
      code: 'season_mismatch',
      reason: 'Configured source-observed season must be an integer between 2000 and 2100.',
      configuredSeason,
      phaseSeason: null,
    };
  }

  const phase = resolveSeasonPhase(now);
  if (phase.configStatus !== 'ok') {
    return {
      available: false,
      code: 'calendar_unavailable',
      reason: phase.configNote ?? 'The NFL season calendar is unavailable.',
      configuredSeason,
      phaseSeason: null,
    };
  }

  const target = phase.regularSeasonWeek !== null
    ? { season: phase.season, week: phase.regularSeasonWeek }
    : phase.targetSeason !== null && phase.targetWeek !== null
      ? { season: phase.targetSeason, week: phase.targetWeek }
      : null;

  if (target === null) {
    return {
      available: false,
      code: 'target_unavailable',
      reason: `No source-observed season/week target is available during ${phase.seasonPhaseLabel}.`,
      configuredSeason,
      phaseSeason: phase.season,
    };
  }

  if (target.season !== configuredSeason) {
    return {
      available: false,
      code: 'season_mismatch',
      reason:
        `Configured source-observed season ${configuredSeason} does not match ` +
        `the phase attribution season ${target.season} (${phase.seasonPhaseLabel}).`,
      configuredSeason,
      phaseSeason: phase.season,
    };
  }

  return { available: true, target };
}

export class SourceObservedTargetUnavailableError extends Error {
  readonly code: SourceObservedTargetFailureCode;
  readonly statusCode = 503;

  constructor(resolution: Extract<SourceObservedTargetResolution, { available: false }>) {
    super(resolution.reason);
    this.name = 'SourceObservedTargetUnavailableError';
    this.code = resolution.code;
  }
}

export class InvalidSourceObservedTargetError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidSourceObservedTargetError';
  }
}

export function requireSourceObservedDefaultTarget(
  now: Date = new Date(),
  configuredSeason: number = INGESTION_DEFAULT_SEASON,
): SourceObservedTarget {
  const resolution = resolveSourceObservedDefaultTarget(now, configuredSeason);
  if (!resolution.available) {
    throw new SourceObservedTargetUnavailableError(resolution);
  }
  return resolution.target;
}

/** Fully explicit source-observed pairs are honored; partial pairs are never mixed with defaults. */
export function resolveSourceObservedTarget(input: {
  season?: number;
  week?: number;
  now?: Date;
  configuredSeason?: number;
} = {}): SourceObservedTarget {
  const { season, week } = input;
  const hasSeason = season !== undefined;
  const hasWeek = week !== undefined;

  if (hasSeason !== hasWeek) {
    throw new InvalidSourceObservedTargetError(
      'Source-observed processing requires season and week together, or neither.',
    );
  }
  if (hasSeason && (!Number.isInteger(season) || season! < 2000 || season! > 2100)) {
    throw new InvalidSourceObservedTargetError('Season must be an integer between 2000 and 2100.');
  }
  if (hasWeek && (!Number.isInteger(week) || week! < 1 || week! > 18)) {
    throw new InvalidSourceObservedTargetError('Week must be an integer between 1 and 18.');
  }

  if (hasSeason && hasWeek) {
    return { season: season!, week: week! };
  }

  return requireSourceObservedDefaultTarget(
    input.now,
    input.configuredSeason ?? INGESTION_DEFAULT_SEASON,
  );
}

export class EvidenceIngestionTargetUnavailableError extends Error {
  readonly code: EvidenceIngestionTargetFailureCode;
  readonly statusCode = 503;

  constructor(resolution: Extract<EvidenceIngestionTargetResolution, { available: false }>) {
    super(resolution.reason);
    this.name = 'EvidenceIngestionTargetUnavailableError';
    this.code = resolution.code;
  }
}

export class InvalidEvidenceIngestionTargetError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidEvidenceIngestionTargetError';
  }
}

export function requireEvidenceIngestionDefaultTarget(
  now: Date = new Date(),
  configuredSeason: number = INGESTION_DEFAULT_SEASON,
): EvidenceIngestionTarget {
  const resolution = resolveEvidenceIngestionDefaultTarget(now, configuredSeason);
  if (!resolution.available) {
    throw new EvidenceIngestionTargetUnavailableError(resolution);
  }
  return resolution.target;
}

/**
 * Resolve an optional caller-supplied pair without mixing a supplied archive
 * season with the live default week (or vice versa). Fully explicit pairs are
 * honored. A half-explicit pair may use the governed default only when its
 * supplied half agrees with that default; otherwise callers must name both.
 */
export function resolveEvidenceIngestionTarget(input: {
  season?: number;
  week?: number;
  now?: Date;
  configuredSeason?: number;
} = {}): EvidenceIngestionTarget {
  const { season, week } = input;
  const hasSeason = season !== undefined;
  const hasWeek = week !== undefined;

  if (hasSeason && (!Number.isInteger(season) || season! < 2000 || season! > 2100)) {
    throw new InvalidEvidenceIngestionTargetError('Season must be an integer between 2000 and 2100.');
  }
  if (hasWeek && (!Number.isInteger(week) || week! < 1 || week! > 18)) {
    throw new InvalidEvidenceIngestionTargetError('Week must be an integer between 1 and 18.');
  }

  if (hasSeason && hasWeek) {
    return { season: season!, week: week! };
  }

  const governed = requireEvidenceIngestionDefaultTarget(
    input.now,
    input.configuredSeason ?? INGESTION_DEFAULT_SEASON,
  );

  if (hasSeason && season !== governed.season) {
    throw new InvalidEvidenceIngestionTargetError(
      `Season ${season} has no explicit week; provide both season and week instead of pairing it with ` +
      `the governed ${governed.season} Week ${governed.week} default.`,
    );
  }

  if (hasWeek && week !== governed.week) {
    throw new InvalidEvidenceIngestionTargetError(
      `Week ${week} has no explicit season; provide both season and week instead of pairing it with ` +
      `the governed ${governed.season} Week ${governed.week} default.`,
    );
  }

  return {
    season: hasSeason ? season! : governed.season,
    week: hasWeek ? week! : governed.week,
  };
}

/** Resolve a season-only evidence job without falling back to the wall year. */
export function resolveEvidenceIngestionSeason(
  season?: number,
  now?: Date,
  configuredSeason: number = INGESTION_DEFAULT_SEASON,
): number {
  if (season !== undefined) {
    if (!Number.isInteger(season) || season < 2000 || season > 2100) {
      throw new InvalidEvidenceIngestionTargetError('Season must be an integer between 2000 and 2100.');
    }
    return season;
  }

  // Even though the caller only needs a season, resolving the full evidence
  // tuple prevents an implicit season-only job from running during preseason,
  // stale-calendar, or config-mismatch states.
  return requireEvidenceIngestionDefaultTarget(now, configuredSeason).season;
}

/**
 * Schedule sync is forward-looking configuration work, not evidence ingestion.
 * It may use the phase target season during postseason/preseason, but remains
 * unavailable when the calendar is stale or the configured season disagrees.
 */
export function requireScheduleSyncDefaultSeason(
  now: Date = new Date(),
  configuredSeason: number = INGESTION_DEFAULT_SEASON,
): number {
  if (Number.isNaN(now.getTime())) {
    throw new EvidenceIngestionTargetUnavailableError({
      available: false,
      code: 'invalid_clock',
      reason: 'Cannot resolve a schedule sync season from an invalid clock value.',
      configuredSeason,
      phaseSeason: null,
    });
  }

  if (!Number.isInteger(configuredSeason) || configuredSeason < 2000 || configuredSeason > 2100) {
    throw new EvidenceIngestionTargetUnavailableError({
      available: false,
      code: 'season_mismatch',
      reason: 'Configured schedule season must be an integer between 2000 and 2100.',
      configuredSeason,
      phaseSeason: null,
    });
  }

  const phase = resolveSeasonPhase(now);
  if (phase.configStatus !== 'ok') {
    throw new EvidenceIngestionTargetUnavailableError({
      available: false,
      code: 'calendar_unavailable',
      reason: phase.configNote ?? 'The NFL season calendar is unavailable.',
      configuredSeason,
      phaseSeason: null,
    });
  }

  const scheduleSeason = phase.targetSeason ?? phase.season;
  if (scheduleSeason !== configuredSeason) {
    throw new EvidenceIngestionTargetUnavailableError({
      available: false,
      code: 'season_mismatch',
      reason:
        `Configured schedule season ${configuredSeason} does not match ` +
        `the phase schedule season ${scheduleSeason} (${phase.seasonPhaseLabel}).`,
      configuredSeason,
      phaseSeason: scheduleSeason,
    });
  }

  return configuredSeason;
}

function parseTimestamp(value: CacheTimestamp): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && !Number.isNaN(new Date(value).getTime()) ? value : null;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function getNewestCacheTimestamp(values: readonly CacheTimestamp[]): Date | null {
  let newestTimestamp: number | null = null;

  for (const value of values) {
    const timestamp = parseTimestamp(value);
    if (timestamp !== null && (newestTimestamp === null || timestamp > newestTimestamp)) {
      newestTimestamp = timestamp;
    }
  }

  return newestTimestamp === null ? null : new Date(newestTimestamp);
}

/**
 * Warn when a cache is more than seven days old during the active NFL window.
 * This is observability-only: callers must not reject cache data based on it.
 */
export function warnIfCacheStale(
  cacheFile: string,
  newestTimestamp: CacheTimestamp,
  now = new Date(),
): boolean {
  const month = now.getUTCMonth();
  const isActiveSeasonWindow = month === 0 || month >= 7;
  if (!isActiveSeasonWindow) {
    return false;
  }

  const newestTimestampMs = parseTimestamp(newestTimestamp);
  if (newestTimestampMs === null) {
    return false;
  }

  const ageMs = now.getTime() - newestTimestampMs;
  if (ageMs <= CACHE_STALE_AFTER_DAYS * MS_PER_DAY) {
    return false;
  }

  console.warn(JSON.stringify({
    level: 'warn',
    src: 'SeasonConfig',
    msg: 'Cache content timestamp is stale during the active NFL season window',
    cache_file: cacheFile,
    newest_timestamp: new Date(newestTimestampMs).toISOString(),
    age_days: ageMs / MS_PER_DAY,
    threshold_days: CACHE_STALE_AFTER_DAYS,
    season: CURRENT_SEASON,
  }));

  return true;
}

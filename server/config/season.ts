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

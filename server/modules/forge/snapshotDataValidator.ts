import type { OffensivePosition } from './forgeEngine';

export interface SnapshotPlayerWeekRow {
  week: number;
  player_id?: string;
  targets?: number | null;
  rush_attempts?: number | null;
  routes?: number | null;
  dropbacks?: number | null;
  snap_share?: number | null;
  [key: string]: unknown;
}

export interface ValidationWarning {
  week: number;
  playerId: string;
  rule: string;
  field: string;
  originalValue: number | null;
  correctedValue?: number;
  message: string;
}

export interface ValidationResult<T> {
  cleanRows: T[];
  droppedCount: number;
  warnings: ValidationWarning[];
}

const INACTIVE_THRESHOLDS: Record<OffensivePosition, number> = {
  QB: 10,
  RB: 3,
  WR: 3,
  TE: 3,
};

const MAX_REASONABLE_SNAP_SHARE = 0.12;

export function validateSnapshotRows<T extends SnapshotPlayerWeekRow>(
  rows: T[],
  position: OffensivePosition,
  playerId: string
): ValidationResult<T> {
  const warnings: ValidationWarning[] = [];
  const droppedWeeks: Array<{ week: number; rule: string }> = [];

  const normalizedRows = rows.map(row => {
    const cloned = { ...row } as T;

    const rawSnapShare = toNumberOrNull(cloned.snap_share);
    if (rawSnapShare === null) {
      (cloned as SnapshotPlayerWeekRow).snap_share = 0;
      warnings.push({
        week: toInt(cloned.week),
        playerId,
        rule: 'NULL_SNAP_SHARE',
        field: 'snap_share',
        originalValue: null,
        correctedValue: 0,
        message: 'snap_share was NULL and was replaced with 0.0',
      });
    } else if (rawSnapShare === 1 || rawSnapShare > 0.5) {
      (cloned as SnapshotPlayerWeekRow).snap_share = MAX_REASONABLE_SNAP_SHARE;
      warnings.push({
        week: toInt(cloned.week),
        playerId,
        rule: 'ANOMALOUS_SNAP_SHARE',
        field: 'snap_share',
        originalValue: rawSnapShare,
        correctedValue: MAX_REASONABLE_SNAP_SHARE,
        message: `snap_share ${rawSnapShare} exceeds reasonable per-player max and was clipped`,
      });
    }

    return cloned;
  });

  const cleanRows = normalizedRows.filter(row => {
    const week = toInt(row.week);
    const targets = toInt(row.targets);
    const rushAttempts = toInt(row.rush_attempts);
    const routes = toInt(row.routes);
    const dropbacks = toInt(row.dropbacks);

    if ((targets + rushAttempts + routes + dropbacks) === 0) {
      droppedWeeks.push({ week, rule: 'GHOST_ROW' });
      return false;
    }

    if (isInactiveWeek(position, { targets, rushAttempts, routes, dropbacks })) {
      droppedWeeks.push({ week, rule: 'INACTIVE_WEEK' });
      return false;
    }

    return true;
  });

  warnings.push(...detectExtremeOutliers(cleanRows, playerId));

  if (cleanRows.length < 3) {
    warnings.push({
      week: -1,
      playerId,
      rule: 'LOW_SAMPLE_SIZE',
      field: 'clean_rows',
      originalValue: cleanRows.length,
      message: `Player has only ${cleanRows.length} clean weeks after validation`,
    });
  }

  logValidationSummary(playerId, position, rows.length, cleanRows.length, droppedWeeks, warnings);

  return {
    cleanRows,
    droppedCount: droppedWeeks.length,
    warnings,
  };
}

function isInactiveWeek(
  position: OffensivePosition,
  metrics: { targets: number; rushAttempts: number; routes: number; dropbacks: number }
): boolean {
  switch (position) {
    case 'QB':
      return metrics.dropbacks < INACTIVE_THRESHOLDS.QB;
    case 'RB':
      return (metrics.targets + metrics.rushAttempts) < INACTIVE_THRESHOLDS.RB;
    case 'WR':
    case 'TE':
      return metrics.routes < INACTIVE_THRESHOLDS[position];
  }
}

function detectExtremeOutliers<T extends SnapshotPlayerWeekRow>(
  rows: T[],
  playerId: string
): ValidationWarning[] {
  const metrics: Array<keyof SnapshotPlayerWeekRow> = ['targets', 'rush_attempts', 'routes', 'dropbacks'];
  const warnings: ValidationWarning[] = [];

  for (const field of metrics) {
    const values = rows
      .map(row => ({ week: toInt(row.week), value: toNumberOrNull(row[field]) }))
      .filter((entry): entry is { week: number; value: number } => entry.value !== null);

    if (values.length < 3) continue;

    const mean = values.reduce((acc, entry) => acc + entry.value, 0) / values.length;
    const variance = values.reduce((acc, entry) => acc + (entry.value - mean) ** 2, 0) / values.length;
    const sigma = Math.sqrt(variance);

    if (sigma <= 0) continue;

    for (const entry of values) {
      if (entry.value > mean + (3 * sigma)) {
        warnings.push({
          week: entry.week,
          playerId,
          rule: 'EXTREME_OUTLIER',
          field,
          originalValue: entry.value,
          message: `${String(field)}=${entry.value} is >3σ above player mean ${mean.toFixed(2)}`,
        });
      }
    }
  }

  return warnings;
}

function logValidationSummary(
  playerId: string,
  position: OffensivePosition,
  rawCount: number,
  cleanCount: number,
  droppedWeeks: Array<{ week: number; rule: string }>,
  warnings: ValidationWarning[]
): void {
  const droppedCount = droppedWeeks.length;
  const dropText = droppedCount === 0
    ? '0 dropped'
    : `${droppedCount} dropped: ${droppedWeeks.map(d => `${d.rule} wk${d.week}`).join(', ')}`;

  console.log(
    `[DataValidator] ${playerId} (${position}): ${rawCount} weeks → ${cleanCount} clean (${dropText}), ${warnings.length} warnings`
  );

  if (cleanCount < 5) {
    for (const warning of warnings) {
      console.warn(`[DataValidator][detail] ${playerId} wk${warning.week} ${warning.rule} ${warning.field}: ${warning.message}`);
    }
  }
}

function toInt(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

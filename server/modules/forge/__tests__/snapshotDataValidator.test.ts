import { validateSnapshotRows, type SnapshotPlayerWeekRow } from '../snapshotDataValidator';

describe('snapshotDataValidator', () => {
  test('drops ghost rows where all primary metrics are zero', () => {
    const rows: SnapshotPlayerWeekRow[] = [
      { week: 1, targets: 0, rush_attempts: 0, routes: 0, dropbacks: 0, snap_share: 0.05 },
      { week: 2, targets: 2, rush_attempts: 5, routes: 12, dropbacks: 0, snap_share: 0.08 },
    ];

    const result = validateSnapshotRows(rows, 'RB', 'test-rb');

    expect(result.cleanRows).toHaveLength(1);
    expect(result.cleanRows[0].week).toBe(2);
    expect(result.droppedCount).toBe(1);
  });

  test('replaces null snap_share with 0.0 and emits warning', () => {
    const rows: SnapshotPlayerWeekRow[] = [
      { week: 1, targets: 3, rush_attempts: 4, routes: 18, dropbacks: 0, snap_share: null },
    ];

    const result = validateSnapshotRows(rows, 'RB', 'test-rb');

    expect(result.cleanRows[0].snap_share).toBe(0);
    expect(result.warnings.some(w => w.rule === 'NULL_SNAP_SHARE')).toBe(true);
  });

  test('clips anomalous snap_share=1.0 to 0.12', () => {
    const rows: SnapshotPlayerWeekRow[] = [
      { week: 1, targets: 4, rush_attempts: 6, routes: 15, dropbacks: 0, snap_share: 1.0 },
    ];

    const result = validateSnapshotRows(rows, 'RB', 'test-rb');

    expect(result.cleanRows[0].snap_share).toBe(0.12);
    expect(result.warnings.some(w => w.rule === 'ANOMALOUS_SNAP_SHARE')).toBe(true);
  });

  test('drops inactive QB week with low dropbacks', () => {
    const rows: SnapshotPlayerWeekRow[] = [
      { week: 1, targets: 0, rush_attempts: 2, routes: 0, dropbacks: 5, snap_share: 0.09 },
      { week: 2, targets: 0, rush_attempts: 3, routes: 0, dropbacks: 28, snap_share: 0.08 },
    ];

    const result = validateSnapshotRows(rows, 'QB', 'test-qb');

    expect(result.cleanRows).toHaveLength(1);
    expect(result.cleanRows[0].week).toBe(2);
  });

  test('passes clean rows unchanged', () => {
    const rows: SnapshotPlayerWeekRow[] = [
      { week: 1, targets: 6, rush_attempts: 0, routes: 34, dropbacks: 0, snap_share: 0.09 },
      { week: 2, targets: 8, rush_attempts: 0, routes: 36, dropbacks: 0, snap_share: 0.1 },
      { week: 3, targets: 7, rush_attempts: 0, routes: 35, dropbacks: 0, snap_share: 0.08 },
    ];

    const result = validateSnapshotRows(rows, 'WR', 'test-wr');

    expect(result.cleanRows).toHaveLength(3);
    expect(result.droppedCount).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  test('adds low sample size warning when fewer than 3 clean weeks remain', () => {
    const rows: SnapshotPlayerWeekRow[] = [
      { week: 1, targets: 0, rush_attempts: 0, routes: 0, dropbacks: 0, snap_share: 0.06 },
      { week: 2, targets: 4, rush_attempts: 2, routes: 0, dropbacks: 0, snap_share: 0.07 },
    ];

    const result = validateSnapshotRows(rows, 'RB', 'test-rb');

    expect(result.cleanRows).toHaveLength(1);
    expect(result.warnings.some(w => w.rule === 'LOW_SAMPLE_SIZE')).toBe(true);
  });

  test('flags extreme outlier week when metric is >3σ from player mean', () => {
    const rows: SnapshotPlayerWeekRow[] = [
      { week: 1, targets: 5, rush_attempts: 0, routes: 32, dropbacks: 0, snap_share: 0.08 },
      { week: 2, targets: 5, rush_attempts: 0, routes: 33, dropbacks: 0, snap_share: 0.08 },
      { week: 3, targets: 5, rush_attempts: 0, routes: 31, dropbacks: 0, snap_share: 0.08 },
      { week: 4, targets: 5, rush_attempts: 0, routes: 34, dropbacks: 0, snap_share: 0.08 },
      { week: 5, targets: 5, rush_attempts: 0, routes: 35, dropbacks: 0, snap_share: 0.08 },
      { week: 6, targets: 5, rush_attempts: 0, routes: 36, dropbacks: 0, snap_share: 0.08 },
      { week: 7, targets: 5, rush_attempts: 0, routes: 33, dropbacks: 0, snap_share: 0.08 },
      { week: 8, targets: 5, rush_attempts: 0, routes: 32, dropbacks: 0, snap_share: 0.08 },
      { week: 9, targets: 5, rush_attempts: 0, routes: 34, dropbacks: 0, snap_share: 0.08 },
      { week: 10, targets: 5, rush_attempts: 0, routes: 33, dropbacks: 0, snap_share: 0.08 },
      { week: 11, targets: 100, rush_attempts: 0, routes: 34, dropbacks: 0, snap_share: 0.08 },
    ];

    const result = validateSnapshotRows(rows, 'WR', 'test-wr');

    expect(result.warnings.some(w => w.rule === 'EXTREME_OUTLIER' && w.field === 'targets')).toBe(true);
  });
});

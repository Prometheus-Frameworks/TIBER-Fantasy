import {
  isExpertMockSnapshotEligibleAt,
  isExpertSignalEligibleAt,
} from '../eligibility';
import {
  SYNTHETIC_CORRECTION_EVENT,
  SYNTHETIC_FUTURE_MOCK,
  SYNTHETIC_FUTURE_SIGNAL_EVENT,
  SYNTHETIC_REDRAFT_MOCK,
  SYNTHETIC_WEEKLY_RANKING_EVENT,
} from '../__fixtures__/expertSignals';

describe('ESE-0 point-in-time eligibility', () => {
  it('uses knownAt as the sole decision-eligibility clock', () => {
    expect(isExpertSignalEligibleAt(SYNTHETIC_WEEKLY_RANKING_EVENT, '2026-09-15T13:05:00Z')).toBe(true);
    expect(isExpertSignalEligibleAt(SYNTHETIC_WEEKLY_RANKING_EVENT, '2026-09-15T13:05:01Z')).toBe(true);
    expect(isExpertSignalEligibleAt(SYNTHETIC_WEEKLY_RANKING_EVENT, '2026-09-15T13:04:59Z')).toBe(false);
  });

  it('rejects future expert evidence', () => {
    expect(isExpertSignalEligibleAt(SYNTHETIC_FUTURE_SIGNAL_EVENT, '2026-09-15T17:00:00Z')).toBe(false);
    expect(isExpertMockSnapshotEligibleAt(SYNTHETIC_FUTURE_MOCK, '2026-09-15T17:00:00Z')).toBe(false);
  });

  it('does not make a later correction historically eligible', () => {
    const historicalCutoff = '2026-09-15T13:30:00Z';
    expect(isExpertSignalEligibleAt(SYNTHETIC_WEEKLY_RANKING_EVENT, historicalCutoff)).toBe(true);
    expect(isExpertSignalEligibleAt(SYNTHETIC_CORRECTION_EVENT, historicalCutoff)).toBe(false);
  });

  it('applies the same cutoff rule to expert mock snapshots', () => {
    expect(isExpertMockSnapshotEligibleAt(SYNTHETIC_REDRAFT_MOCK, '2026-09-15T12:03:00Z')).toBe(true);
    expect(isExpertMockSnapshotEligibleAt(SYNTHETIC_REDRAFT_MOCK, '2026-09-15T12:02:59Z')).toBe(false);
  });

  it('fails closed on malformed decision clocks and malformed records', () => {
    expect(isExpertSignalEligibleAt(SYNTHETIC_WEEKLY_RANKING_EVENT, 'not-a-clock')).toBe(false);
    expect(isExpertMockSnapshotEligibleAt(SYNTHETIC_REDRAFT_MOCK, 'not-a-clock')).toBe(false);
    expect(isExpertSignalEligibleAt({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, knownAt: undefined }, '2026-09-15T18:00:00Z')).toBe(false);
  });
});

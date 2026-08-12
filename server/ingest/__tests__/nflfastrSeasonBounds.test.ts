import {
  NFLFASTR_COMPLETED_ARCHIVE_WEEK_BOUNDS,
  resolveNflfastrSeasonToDateWeekBound,
} from '../nflfastrSeasonBounds';
import { getSeasonCalendar } from '../../../shared/nflSeasonCalendar';
import { InvalidEvidenceIngestionTargetError } from '../../config/season';

describe('NFLfastR season-to-date bounds', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('keeps the completed 2024 producer archive available through Week 18', () => {
    expect(getSeasonCalendar(2024)).toBeNull();
    expect(NFLFASTR_COMPLETED_ARCHIVE_WEEK_BOUNDS).toEqual({ 2024: 18 });
    expect(
      resolveNflfastrSeasonToDateWeekBound(
        2024,
        new Date('2026-08-12T12:00:00.000Z'),
      ),
    ).toBe(18);
  });

  test('uses configured live-season elapsed evidence without inventing preseason Week 1', () => {
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));

    expect(resolveNflfastrSeasonToDateWeekBound(2026)).toBe(0);
  });

  test('keeps the January rollover on football season 2026 Week 17', () => {
    expect(
      resolveNflfastrSeasonToDateWeekBound(
        2026,
        new Date('2027-01-05T12:00:00.000Z'),
      ),
    ).toBe(17);
  });

  test.each([2023, 2027])('rejects unsupported season-only sync for %s', (season) => {
    expect(() =>
      resolveNflfastrSeasonToDateWeekBound(
        season,
        new Date('2026-08-12T12:00:00.000Z'),
      ),
    ).toThrow(InvalidEvidenceIngestionTargetError);
  });
});

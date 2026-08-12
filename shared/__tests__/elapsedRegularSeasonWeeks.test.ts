/**
 * Fantasy #307 Phase A — the evidence bound belongs to the queried season.
 *
 * `elapsedRegularSeasonWeeks` replaced a fallback that reached for the *live*
 * phase week whenever a request named some other season. Because the consumer
 * applies it as a hard `lte` filter, that fallback silently truncated an
 * archive to the live week, emptied it entirely in the offseason, and would
 * have claimed evidence for a forward season that had not kicked off. Each of
 * those is pinned below.
 */

import { elapsedRegularSeasonWeeks, getSeasonCalendar } from '../nflSeasonCalendar';

const at = (iso: string) => new Date(iso);

describe('elapsedRegularSeasonWeeks', () => {
  it('counts no weeks before the season has kicked off', () => {
    // A forward season has produced no football. Bounding it by the live
    // clock's week would have invented evidence for unplayed games.
    expect(elapsedRegularSeasonWeeks(2026, at('2026-08-10T12:00:00Z'))).toBe(0);
    expect(elapsedRegularSeasonWeeks(2026, at('2026-09-10T19:59:59Z'))).toBe(0);
  });

  it('counts the in-flight week, matching what the live phase week reports', () => {
    // This is the property that makes the generalisation safe: for the season
    // actually being played, the derived bound equals the live phase week, so
    // live behaviour is unchanged.
    expect(elapsedRegularSeasonWeeks(2026, at('2026-09-10T20:00:00Z'))).toBe(1);
    expect(elapsedRegularSeasonWeeks(2026, at('2026-09-15T12:00:00Z'))).toBe(1);
    expect(elapsedRegularSeasonWeeks(2026, at('2026-09-17T20:00:00Z'))).toBe(2);
  });

  it('counts a completed season in full, including during its own postseason', () => {
    // The offseason/postseason regression: `phase.regularSeasonWeek` is null
    // outside the regular season, so the old `?? 0` fallback emptied the 2025
    // archive during the 2025 postseason even though all 18 weeks exist.
    const weeks = getSeasonCalendar(2025)!.regularSeasonWeeks;
    expect(elapsedRegularSeasonWeeks(2025, at('2026-01-20T12:00:00Z'))).toBe(weeks);
    expect(elapsedRegularSeasonWeeks(2025, at('2026-08-10T12:00:00Z'))).toBe(weeks);
    expect(elapsedRegularSeasonWeeks(2025, at('2030-01-01T12:00:00Z'))).toBe(weeks);
  });

  it('does not truncate an archive to the live clock', () => {
    // The reported defect, stated directly: asking about 2025 during 2026
    // Week 3 must still bound 2025 by 2025, not by 3.
    const during2026Week3 = at('2026-09-24T20:00:00Z');
    expect(elapsedRegularSeasonWeeks(2026, during2026Week3)).toBe(3);
    expect(elapsedRegularSeasonWeeks(2025, during2026Week3)).toBe(18);
  });

  it('returns null for a season this build cannot describe', () => {
    // Fail closed rather than borrowing a bound from another season.
    expect(elapsedRegularSeasonWeeks(2019, at('2026-08-10T12:00:00Z'))).toBeNull();
    expect(elapsedRegularSeasonWeeks(2099, at('2026-08-10T12:00:00Z'))).toBeNull();
  });

  it('never exceeds the season it describes', () => {
    for (const season of [2025, 2026]) {
      const calendar = getSeasonCalendar(season)!;
      expect(elapsedRegularSeasonWeeks(season, at('2099-01-01T00:00:00Z')))
        .toBe(calendar.regularSeasonWeeks);
    }
  });
});

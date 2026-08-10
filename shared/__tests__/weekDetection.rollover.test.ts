/**
 * Fantasy #307 Phase A — season/phase rollover coverage.
 *
 * The defect being locked out: after the 2025 schedule ended, detection returned
 * `{ season: 2025, currentWeek: 18 }` forever, so the live Rankings surface
 * presented "2025, through week 18" throughout 2026.
 */

import {
  checkSeasonConfigAgreement,
  getBestRisersFallersWeek,
  getCurrentWeek,
  getWeekInfo,
  isRisersFallersDataAvailable,
  resolveSeasonPhase,
} from '../weekDetection';
import { NFL_SEASON_CALENDARS, deriveWeekWindowsFromAnchor, getSeasonCalendar } from '../nflSeasonCalendar';

const at = (iso: string) => new Date(iso);

describe('a week is not complete while its last game is being played', () => {
  // Week 11 2025: MNF kicks off 2025-11-18T01:15Z and finishes ~05:00Z.
  // The defect: kickoff was treated as completion, so for the several hours the
  // game was live the API reported a completed week, a completed MNF, and a full
  // 16/16 slate — then rolled the forward target to Week 12.
  const DURING_MNF = at('2025-11-18T02:30:00Z');
  // Deliberately beyond any plausible fixed-duration estimate: a doubleheader
  // or a long game can still be live here, so a kickoff+Nh cutoff would have
  // reported the week complete. The configured week end is the only boundary
  // this calendar actually knows.
  const LONG_GAME_STILL_LIVE = at('2025-11-18T07:30:00Z');
  const AFTER_WEEK_END = at('2025-11-19T05:00:00Z');

  test('mid-MNF the week is neither complete nor assertably still running', () => {
    const phase = resolveSeasonPhase(DURING_MNF);
    expect(phase.regularSeasonWeek).toBe(11);
    expect(phase.weekStatus).toBe('completion_unverified');
  });

  test('mid-MNF no definite MNF or game-count claim is emitted', () => {
    // Neither 16/16 (the original defect) nor 15/16 (its mirror image). We have
    // no completion signal, so the contract says so instead of guessing.
    const info = getCurrentWeek(DURING_MNF);
    expect(info?.mondayNightCompleted).toBeNull();
    expect(info?.gamesCompleted).toBeNull();
  });

  test('the forward target rolls at kickoff, decoupled from result finalization', () => {
    // Start/sit, waivers and the board have nothing left to decide about this
    // week once its last game has kicked off; they should not wait on evidence
    // that only result publication needs.
    expect(resolveSeasonPhase(DURING_MNF).targetWeek).toBe(12);
    expect(resolveSeasonPhase(LONG_GAME_STILL_LIVE).targetWeek).toBe(12);
  });

  test('a game running long still does not finalize the week', () => {
    const phase = resolveSeasonPhase(LONG_GAME_STILL_LIVE);
    expect(phase.weekStatus).toBe('completion_unverified');
    const info = getCurrentWeek(LONG_GAME_STILL_LIVE);
    expect(info?.mondayNightCompleted).toBeNull();
    expect(info?.gamesCompleted).toBeNull();
  });

  test('result-dependent admission stays conservative through the whole window', () => {
    // Risers/fallers must not admit Week 11 until it is verifiably final,
    // even though the forward target has already moved on.
    expect(getBestRisersFallersWeek(DURING_MNF)).toBe(10);
    expect(getBestRisersFallersWeek(LONG_GAME_STILL_LIVE)).toBe(10);
    expect(getBestRisersFallersWeek(AFTER_WEEK_END)).toBe(11);
  });

  test('past the configured week end, Week 11 is final and the board moves to 12', () => {
    const phase = resolveSeasonPhase(AFTER_WEEK_END);
    expect(phase.regularSeasonWeek).toBe(12);
    expect(phase.targetWeek).toBe(12);
    // Week 11 itself, queried explicitly, is now complete with a full slate.
    const info = getWeekInfo(11, 2025, AFTER_WEEK_END);
    expect(info?.weekStatus).toBe('completed');
    expect(info?.mondayNightCompleted).toBe(true);
    expect(info?.gamesCompleted).toBe(16);
  });
});

describe('resolveSeasonPhase — 2025 postseason → 2026 offseason/preseason → 2026 Week 1', () => {
  test('mid-2025 regular season reports the live week', () => {
    const phase = resolveSeasonPhase(at('2025-11-16T18:00:00Z')); // Week 11, Sunday
    expect(phase.season).toBe(2025);
    expect(phase.phase).toBe('regular_season');
    expect(phase.regularSeasonWeek).toBe(11);
    expect(phase.targetWeek).toBe(11);
    expect(phase.seasonPhaseLabel).toBe('2025 · Week 11');
  });

  test('the Tuesday after MNF is Week 11 completion-unverified, not completed', () => {
    // Kickoff was Monday 01:15Z, but nothing observable tells us the last game
    // has finished, so the week is not finalized. The forward target has
    // already rolled — that axis does not depend on result evidence.
    const phase = resolveSeasonPhase(at('2025-11-18T12:00:00Z'));
    expect(phase.regularSeasonWeek).toBe(11);
    expect(phase.weekStatus).toBe('completion_unverified');
    expect(phase.targetWeek).toBe(12);
  });

  test('the inter-week gap belongs to the upcoming week as not_started', () => {
    // Week 11 ends 2025-11-19T04:00Z; Week 12 starts 2025-11-20T20:00Z.
    const phase = resolveSeasonPhase(at('2025-11-19T12:00:00Z'));
    expect(phase.regularSeasonWeek).toBe(12);
    expect(phase.weekStatus).toBe('not_started');
    expect(phase.targetWeek).toBe(12);
  });

  test('2025 postseason is postseason, not "Week 18 completed"', () => {
    const phase = resolveSeasonPhase(at('2026-01-20T12:00:00Z'));
    expect(phase.season).toBe(2025);
    expect(phase.phase).toBe('postseason');
    expect(phase.regularSeasonWeek).toBeNull();
    // Forward target rolls to the next configured season.
    expect(phase.targetSeason).toBe(2026);
    expect(phase.targetWeek).toBe(1);
  });

  test('spring 2026 is the 2026 offseason, not 2025 Week 18', () => {
    const phase = resolveSeasonPhase(at('2026-03-15T12:00:00Z'));
    expect(phase.season).toBe(2026);
    expect(phase.phase).toBe('offseason');
    expect(phase.regularSeasonWeek).toBeNull();
    expect(phase.targetWeek).toBe(1);
  });

  test('2026-08-09 is 2026 preseason targeting Week 1 — the exact issue #307 case', () => {
    const phase = resolveSeasonPhase(at('2026-08-09T12:00:00Z'));
    expect(phase.season).toBe(2026);
    expect(phase.phase).toBe('preseason');
    expect(phase.seasonPhaseLabel).toBe('2026 · Preseason');
    expect(phase.regularSeasonWeek).toBeNull();
    expect(phase.targetSeason).toBe(2026);
    expect(phase.targetWeek).toBe(1);
    expect(phase.targetLabel).toBe('Target: Week 1');
    // Never "current Week 1".
    expect(phase.seasonPhaseLabel).not.toContain('Week 1');
  });

  test('2026 Week 1 kickoff flips preseason to regular season', () => {
    const phase = resolveSeasonPhase(at('2026-09-13T18:00:00Z'));
    expect(phase.season).toBe(2026);
    expect(phase.phase).toBe('regular_season');
    expect(phase.regularSeasonWeek).toBe(1);
    expect(phase.seasonPhaseLabel).toBe('2026 · Week 1');
  });

  test('the 2026 target week is flagged as anchor-derived, not an ingested schedule', () => {
    expect(resolveSeasonPhase(at('2026-08-09T12:00:00Z')).scheduleSource).toBe('anchor_derived');
    // 2025 is anchor-derived too: every week is the Week 1 anchor plus an exact
    // seven-day stride, so claiming an ingested schedule was false provenance.
    expect(resolveSeasonPhase(at('2025-11-16T18:00:00Z')).scheduleSource).toBe('anchor_derived');
  });

  test('past the end of the configured calendar it fails loudly instead of clamping', () => {
    const phase = resolveSeasonPhase(at('2031-10-01T12:00:00Z'));
    expect(phase.configStatus).toBe('stale_calendar_config');
    expect(phase.targetWeek).toBeNull();
    expect(phase.configNote).toMatch(/calendar ends after/i);
  });
});

describe('getCurrentWeek — backward-compatible adapter', () => {
  test('no longer reports 2025 Week 18 during the 2026 preseason', () => {
    const info = getCurrentWeek(at('2026-08-09T12:00:00Z'));
    expect(info.season).toBe(2026);
    expect(info.phase).toBe('preseason');
    expect(info.regularSeasonWeek).toBeNull();
    expect(info.targetWeek).toBe(1);
    // The regression itself:
    expect({ season: info.season, week: info.regularSeasonWeek }).not.toEqual({ season: 2025, week: 18 });
  });

  test('keeps the numeric contract during the regular season', () => {
    const info = getCurrentWeek(at('2025-11-16T18:00:00Z'));
    expect(info.currentWeek).toBe(11);
    expect(info.regularSeasonWeek).toBe(11);
    expect(typeof info.gamesCompleted).toBe('number');
    expect(info.totalGames).toBe(16);
    expect(info.weekStartDate).not.toBe('');
  });

  test('exposes phase labels for the presentation layer', () => {
    const info = getCurrentWeek(at('2026-08-09T12:00:00Z'));
    expect(info.seasonPhaseLabel).toBe('2026 · Preseason');
    expect(info.targetLabel).toBe('Target: Week 1');
  });
});

describe('getWeekInfo / risers-fallers', () => {
  test('resolves an explicit season/week', () => {
    const info = getWeekInfo(3, 2025, at('2025-11-16T18:00:00Z'));
    expect(info?.season).toBe(2025);
    expect(info?.currentWeek).toBe(3);
    expect(info?.weekStatus).toBe('completed');
  });

  test('returns null for an unconfigured season', () => {
    expect(getWeekInfo(3, 1999, at('2025-11-16T18:00:00Z'))).toBeNull();
  });

  test('best risers/fallers week is null outside the regular season', () => {
    expect(getBestRisersFallersWeek(at('2026-08-09T12:00:00Z'))).toBeNull();
    expect(getBestRisersFallersWeek(at('2026-03-15T12:00:00Z'))).toBeNull();
  });

  test('best risers/fallers week is a completed week in season', () => {
    // Week 11 is not assertable as complete on the Tuesday, so the last week
    // whose games are all final is 10. This lags a day versus the previous
    // behaviour — the deliberate cost of never claiming unfinished results.
    expect(getBestRisersFallersWeek(at('2025-11-18T12:00:00Z'))).toBe(10);
    expect(getBestRisersFallersWeek(at('2025-11-19T05:00:00Z'))).toBe(11);
  });

  test('week 1 never has risers/fallers data', () => {
    expect(isRisersFallersDataAvailable(1, 2025, at('2025-09-15T12:00:00Z'))).toBe(false);
  });
});

describe('checkSeasonConfigAgreement — ingestion vs presentation', () => {
  test('agrees when the ingestion season matches the current phase season', () => {
    const result = checkSeasonConfigAgreement(2026, at('2026-08-09T12:00:00Z'));
    expect(result.agrees).toBe(true);
    expect(result.presentationSeason).toBe(2026);
  });

  test('disagreement is reported, not silently tolerated', () => {
    const result = checkSeasonConfigAgreement(2025, at('2026-08-09T12:00:00Z'));
    expect(result.agrees).toBe(false);
    expect(result.reason).toMatch(/does not match presentation season 2026/);
  });

  test('a missing ingestion season is a disagreement, not a pass', () => {
    expect(checkSeasonConfigAgreement(undefined, at('2026-08-09T12:00:00Z')).agrees).toBe(false);
  });
});

describe('calendar config integrity', () => {
  test('every configured season has contiguous, ordered weeks', () => {
    for (const calendar of NFL_SEASON_CALENDARS) {
      expect(calendar.weeks).toHaveLength(calendar.regularSeasonWeeks);
      calendar.weeks.forEach((window, index) => {
        expect(window.week).toBe(index + 1);
        expect(new Date(window.startDate).getTime()).toBeLessThan(new Date(window.endDate).getTime());
        if (index > 0) {
          const previous = calendar.weeks[index - 1];
          expect(new Date(previous.startDate).getTime()).toBeLessThan(new Date(window.startDate).getTime());
        }
      });
      expect(new Date(calendar.preseasonStart).getTime()).toBeLessThan(
        new Date(calendar.weeks[0].startDate).getTime(),
      );
      expect(new Date(calendar.postseasonEnd).getTime()).toBeGreaterThan(
        new Date(calendar.weeks[calendar.regularSeasonWeeks - 1].endDate).getTime(),
      );
    }
  });

  test('anchor-derived windows reproduce the ingested 2025 cadence', () => {
    const derived = deriveWeekWindowsFromAnchor('2025-09-04T20:00:00Z', 18);
    const ingested = getSeasonCalendar(2025)!.weeks;
    // Compare instants, not string spelling: the ingested schedule writes
    // "…T04:00:00Z" while `toISOString()` emits "…T04:00:00.000Z".
    const instants = (windows: typeof derived) =>
      windows.map((w) => ({
        week: w.week,
        start: new Date(w.startDate).getTime(),
        end: new Date(w.endDate).getTime(),
        mnf: new Date(w.mondayNightDate).getTime(),
      }));
    expect(instants(derived)).toEqual(instants(ingested));
  });

  test('seasons are unique', () => {
    const seasons = NFL_SEASON_CALENDARS.map((c) => c.season);
    expect(new Set(seasons).size).toBe(seasons.length);
  });
});

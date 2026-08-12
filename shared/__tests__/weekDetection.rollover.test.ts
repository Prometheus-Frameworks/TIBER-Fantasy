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
import {
  NFL_SEASON_CALENDARS,
  deriveWeekWindowsFromAnchor,
  getConfiguredSeasons,
  getSeasonCalendar,
} from '../nflSeasonCalendar';

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

  test('result-dependent admission is closed for the whole anchor-derived season', () => {
    // Risers/fallers admit a week's RESULTS, which requires verified
    // completion. Every configured calendar is anchor-derived — arithmetic
    // that its own contract says can only support phase detection — so no
    // week ever reaches 'completed' and no results are admitted. This is a
    // deliberate product consequence, not a regression: the feature returns
    // when a real schedule/finalization source is ingested, or when its gate
    // migrates to source-declared data presence.
    expect(getBestRisersFallersWeek(DURING_MNF)).toBeNull();
    expect(getBestRisersFallersWeek(LONG_GAME_STILL_LIVE)).toBeNull();
    expect(getBestRisersFallersWeek(AFTER_WEEK_END)).toBeNull();
  });

  test('past the configured week end, the board moves to 12 but Week 11 is not asserted final', () => {
    const phase = resolveSeasonPhase(AFTER_WEEK_END);
    expect(phase.regularSeasonWeek).toBe(12);
    expect(phase.targetWeek).toBe(12);
    // The scheduling boundary elapsed, but a boundary derived from a seven-day
    // stride cannot verify that football finished. Completion stays
    // unverified and completion-dependent claims stay null — 'completed',
    // mondayNightCompleted: true and a 16-game count here were arithmetic
    // asserting observations.
    const info = getWeekInfo(11, 2025, AFTER_WEEK_END);
    expect(info?.weekStatus).toBe('completion_unverified');
    expect(info?.mondayNightCompleted).toBeNull();
    expect(info?.gamesCompleted).toBeNull();
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

  // Fantasy #307 correction round 4: `configuredSeasons` must travel through
  // this adapter additively, on both the live-calendar-ok and stale paths, so
  // `/api/system/current-week` -> `useCurrentNFLWeek` can expose exactly the
  // seasons this build can serve regardless of whether the live phase itself
  // has resolved.
  test('publishes the exact configured-season list, live calendar ok', () => {
    const info = getCurrentWeek(at('2026-08-09T12:00:00Z'));
    expect(info.configuredSeasons).toEqual(getConfiguredSeasons());
  });

  test('publishes the exact configured-season list even when the live calendar is stale', () => {
    const info = getCurrentWeek(at('2031-10-01T12:00:00Z'));
    expect(info.configStatus).toBe('stale_calendar_config');
    // Which seasons are CONFIGURED does not depend on whether the live phase
    // itself resolved — a stale clock does not un-configure an archive.
    expect(info.configuredSeasons).toEqual(getConfiguredSeasons());
    expect(info.configuredSeasons.length).toBeGreaterThan(0);
  });
});

describe('getWeekInfo / risers-fallers', () => {
  test('resolves an explicit season/week', () => {
    const info = getWeekInfo(3, 2025, at('2025-11-16T18:00:00Z'));
    expect(info?.season).toBe(2025);
    expect(info?.currentWeek).toBe(3);
    // Anchor-derived: the scheduled window elapsed, but completion is never
    // asserted from stride arithmetic.
    expect(info?.weekStatus).toBe('completion_unverified');
  });

  test('returns null for an unconfigured season', () => {
    expect(getWeekInfo(3, 1999, at('2025-11-16T18:00:00Z'))).toBeNull();
  });

  test('getWeekInfo also publishes the exact configured-season list', () => {
    const info = getWeekInfo(3, 2025, at('2025-11-16T18:00:00Z'));
    expect(info?.configuredSeasons).toEqual(getConfiguredSeasons());
  });

  test('best risers/fallers week is null outside the regular season', () => {
    expect(getBestRisersFallersWeek(at('2026-08-09T12:00:00Z'))).toBeNull();
    expect(getBestRisersFallersWeek(at('2026-03-15T12:00:00Z'))).toBeNull();
  });

  test('best risers/fallers week is a completed week in season', () => {
    // Week 11 is not assertable as complete on the Tuesday, so the last week
    // whose games are all final is 10 — but "final" cannot be established
    // from an anchor-derived calendar at all, so result admission stays
    // closed for the whole season rather than lagging a day.
    expect(getBestRisersFallersWeek(at('2025-11-18T12:00:00Z'))).toBeNull();
    expect(getBestRisersFallersWeek(at('2025-11-19T05:00:00Z'))).toBeNull();
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

describe('the games-completed estimate never counts a game still being played', () => {
  // The same kickoff-is-not-completion principle applied one level down. The
  // ladder inside estimateGamesCompleted stepped at kickoff times, so the
  // instant a slate started its games were reported as finished.
  //
  // Week 11 2025 runs from Thursday 2025-11-13T20:00Z.
  const infoAt = (iso: string) => getWeekInfo(11, 2025, at(iso));
  const gamesAt = (iso: string) => infoAt(iso)?.gamesCompleted ?? null;

  test('Thursday kickoff reports nothing completed yet', () => {
    expect(gamesAt('2025-11-13T19:59:00Z')).toBe(0);
    // Previously 1: the game had just started.
    expect(gamesAt('2025-11-13T20:00:00Z')).toBe(0);
    expect(gamesAt('2025-11-13T21:30:00Z')).toBe(0);
  });

  test('TNF counts once it has had time to finish', () => {
    expect(gamesAt('2025-11-13T23:00:00Z')).toBe(1);
    expect(gamesAt('2025-11-14T12:00:00Z')).toBe(1);
    expect(gamesAt('2025-11-15T12:00:00Z')).toBe(1);
  });

  test('the Sunday early slate is not counted at its own kickoff', () => {
    // Previously 8 at 17:00Z, when the 1pm ET games had just kicked off.
    expect(gamesAt('2025-11-16T17:00:00Z')).toBe(1);
    expect(gamesAt('2025-11-16T19:00:00Z')).toBe(1);
    expect(gamesAt('2025-11-16T20:00:00Z')).toBe(8);
  });

  test('the Sunday late slate is not counted at its own kickoff', () => {
    // Previously 12 at 21:00Z, when the 4pm ET games had just kicked off.
    expect(gamesAt('2025-11-16T21:00:00Z')).toBe(8);
    expect(gamesAt('2025-11-16T23:00:00Z')).toBe(8);
    expect(gamesAt('2025-11-17T00:00:00Z')).toBe(12);
  });

  test('the estimate never decreases as the week progresses', () => {
    const samples = [
      '2025-11-13T18:00:00Z', '2025-11-13T20:00:00Z', '2025-11-13T23:30:00Z',
      '2025-11-14T12:00:00Z', '2025-11-15T12:00:00Z', '2025-11-16T12:00:00Z',
      '2025-11-16T17:00:00Z', '2025-11-16T20:30:00Z', '2025-11-17T00:30:00Z',
    ].map(gamesAt);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]!);
    }
  });

  test('it never exceeds the slate it is estimating', () => {
    for (const iso of [
      '2025-11-13T20:00:00Z', '2025-11-16T20:30:00Z',
      '2025-11-17T00:30:00Z', '2025-11-19T05:00:00Z',
    ]) {
      const info = infoAt(iso);
      if (info?.gamesCompleted === null || info?.gamesCompleted === undefined) continue;
      expect(info.gamesCompleted).toBeLessThanOrEqual(info.totalGames);
    }
  });
});

/**
 * Fantasy #307 Phase A — the decision-target / evidence-cutoff split.
 *
 * One "current week" number was doing two incompatible jobs: naming the week a
 * forward board should aim at, and bounding which results may be admitted. The
 * first is forward-looking and may legitimately rest on a provisional,
 * anchor-derived signal. The second requires verified completion.
 *
 * These tests pin the separation from both directions: that a provisional
 * target still drives forward-looking work, and that it can never become an
 * evidence cutoff.
 */

import {
  COMPLETION_NOT_VERIFIED_COPY,
  getCurrentWeek,
  getWeekInfo,
  resolveArchiveEvidenceCutoff,
  resolveEvidenceCutoff,
  resolveSeasonPhase,
  resolveWeekTargeting,
} from '../weekDetection';
import { NflSeasonCalendar, deriveWeekWindowsFromAnchor, getSeasonCalendar } from '../nflSeasonCalendar';

const at = (iso: string) => new Date(iso);

/**
 * The season used for the anchor-derived assertions.
 *
 * Worth stating plainly: **every** configured season is currently
 * `anchor_derived`, 2025 included. Its week rows are written out longhand but
 * are an exact seven-day stride off the Week 1 anchor, so the calendar declares
 * them anchor-derived rather than claiming false provenance. That means the
 * verified-completion path has no real calendar to exercise, which is exactly
 * why it is pinned below against a synthetic `explicit_schedule` calendar — a
 * suite that only tested the configured seasons would never execute the branch
 * that admits results, and would pass while it was broken.
 */
const ANCHOR_SEASON = 2025;

function anchorCalendar() {
  const calendar = getSeasonCalendar(ANCHOR_SEASON);
  if (!calendar) throw new Error(`${ANCHOR_SEASON} must be configured for these tests`);
  return calendar;
}

/** A synthetic season whose schedule is declared as genuinely ingested. */
function syntheticVerifiedCalendar(season = 2031): NflSeasonCalendar {
  return {
    season,
    scheduleSource: 'explicit_schedule',
    preseasonStart: `${season}-07-31T00:00:00Z`,
    postseasonEnd: `${season + 1}-02-09T04:00:00Z`,
    regularSeasonWeeks: 18,
    weeks: deriveWeekWindowsFromAnchor(`${season}-09-04T20:00:00Z`, 18),
  };
}

describe('the two values are never the same field', () => {
  test('the targeting contract is versioned and carries both sides', () => {
    const targeting = resolveWeekTargeting(at('2025-10-01T12:00:00Z'));
    expect(targeting.contractVersion).toBe('week-targeting-v1');
    expect(targeting).toHaveProperty('decisionTargetWeek');
    expect(targeting).toHaveProperty('evidenceThroughWeek');
    expect(targeting).toHaveProperty('decisionTargetProvenance');
    expect(targeting).toHaveProperty('evidenceProvenance');
  });

  test('completionVerified is false exactly when there is no evidence cutoff', () => {
    for (const iso of [
      '2026-08-09T12:00:00Z', // preseason
      '2025-09-05T12:00:00Z', // Week 1 in progress
      '2025-10-01T12:00:00Z', // mid-season
    ]) {
      const targeting = resolveWeekTargeting(at(iso));
      expect(targeting.completionVerified).toBe(targeting.evidenceThroughWeek !== null);
      if (!targeting.completionVerified) {
        expect(targeting.completionCopy).toBe(COMPLETION_NOT_VERIFIED_COPY);
      }
    }
  });
});

describe('the Tuesday window: kickoff is not completion', () => {
  // The interval between the final game window opening and the week closing.
  // A kickoff boundary passing is not evidence that anything finished, so this
  // week must not become the evidence cutoff — while the forward target is
  // free to roll, because there is nothing left to decide about this week.
  const week = anchorCalendar().weeks[4]; // Week 5
  const insideWindow = at(new Date(new Date(week.finalGameWindowOpensAt).getTime() + 60 * 60 * 1000).toISOString());

  test('the week is completion_unverified, not completed', () => {
    const phase = resolveSeasonPhase(insideWindow);
    expect(phase.weekStatus).toBe('completion_unverified');
  });

  test('the forward target rolls past it', () => {
    const targeting = resolveWeekTargeting(insideWindow);
    expect(targeting.decisionTargetWeek).toBe(week.week + 1);
  });

  test('the evidence cutoff does NOT include it', () => {
    const targeting = resolveWeekTargeting(insideWindow);
    expect(targeting.evidenceThroughWeek).not.toBe(week.week);
  });

  test('completion-dependent claims are null and copy says so', () => {
    const info = getWeekInfo(week.week, ANCHOR_SEASON, insideWindow);
    expect(info).not.toBeNull();
    expect(info!.weekStatus).toBe('completion_unverified');
    expect(info!.gamesCompleted).toBeNull();
    expect(info!.mondayNightCompleted).toBeNull();
    expect(resolveWeekTargeting(insideWindow).completionCopy).toBe(COMPLETION_NOT_VERIFIED_COPY);
  });

  test('on a VERIFIED schedule the window still yields the previous week', () => {
    // The branch that admits results, exercised against a synthetic ingested
    // schedule. Mid-window, the cutoff is the last week that actually closed.
    const calendar = syntheticVerifiedCalendar();
    const w5 = calendar.weeks[4];
    const mid = new Date(w5.finalGameWindowOpensAt).getTime() + 60 * 60 * 1000;
    expect(resolveEvidenceCutoff(calendar, mid)).toEqual({
      season: calendar.season,
      week: w5.week - 1,
      provenance: 'verified_completed_week',
    });
  });

  test('on a VERIFIED schedule the week becomes the cutoff once it closes', () => {
    const calendar = syntheticVerifiedCalendar();
    const w5 = calendar.weeks[4];
    const afterClose = new Date(w5.endDate).getTime() + 60 * 1000;
    expect(resolveEvidenceCutoff(calendar, afterClose)).toEqual({
      season: calendar.season,
      week: w5.week,
      provenance: 'verified_completed_week',
    });
  });

  test('before any week closes, a verified schedule still yields no cutoff', () => {
    const calendar = syntheticVerifiedCalendar();
    const beforeSeason = new Date(calendar.weeks[0].startDate).getTime() - 60 * 1000;
    expect(resolveEvidenceCutoff(calendar, beforeSeason)).toEqual({
      season: null,
      week: null,
      provenance: 'no_completed_week',
    });
  });
});

describe('anchor-derived targets are provisional and never evidence', () => {
  // 2026 is configured from a Week 1 anchor only. Its week boundaries are
  // cadence arithmetic, so "this week ended" is a statement about a
  // calculation, not about football.
  const anchorSeason = 2026;
  const duringAnchorSeason = at('2026-10-15T12:00:00Z');

  test('the season under test really is anchor-derived', () => {
    expect(getSeasonCalendar(anchorSeason)?.scheduleSource).toBe('anchor_derived');
  });

  test('a target exists and is marked provisional', () => {
    const targeting = resolveWeekTargeting(duringAnchorSeason);
    expect(targeting.decisionTargetWeek).not.toBeNull();
    expect(targeting.decisionTargetProvenance).toBe('anchor_derived');
    expect(targeting.decisionTargetIsProvisional).toBe(true);
  });

  test('no evidence cutoff is produced, however far into the season', () => {
    // The decisive case: deep into an anchor-derived season, many "weeks" have
    // elapsed by arithmetic. None of them may admit results.
    for (const iso of ['2026-09-20T12:00:00Z', '2026-11-01T12:00:00Z', '2026-12-20T12:00:00Z']) {
      const targeting = resolveWeekTargeting(at(iso));
      expect(targeting.evidenceThroughWeek).toBeNull();
      expect(targeting.evidenceThroughSeason).toBeNull();
      expect(targeting.evidenceProvenance).toBe('anchor_derived_cannot_verify_completion');
      expect(targeting.completionVerified).toBe(false);
      expect(targeting.completionCopy).toBe(COMPLETION_NOT_VERIFIED_COPY);
    }
  });

  test('game counts are not fabricated from anchor arithmetic', () => {
    const info = getCurrentWeek(duringAnchorSeason);
    expect(info.gamesCompleted).toBeNull();
  });

  test('the provisional target still drives forward-looking work', () => {
    // The split must not disable forward planning — that would be the mirror
    // failure of admitting unverified results.
    const targeting = resolveWeekTargeting(duringAnchorSeason);
    expect(typeof targeting.decisionTargetWeek).toBe('number');
    expect(targeting.decisionTargetSeason).toBe(anchorSeason);
  });
});

describe('Week 18 and the season boundary', () => {
  const calendar = anchorCalendar();
  const week18 = calendar.weeks[calendar.weeks.length - 1];

  test('after the final week closes there is no Week 19 invented', () => {
    const afterFinalWeek = at(new Date(new Date(week18.endDate).getTime() + 60 * 60 * 1000).toISOString());
    const phase = resolveSeasonPhase(afterFinalWeek);
    expect(phase.regularSeasonWeek).toBeNull();
    expect(phase.targetWeek === null || phase.targetWeek === 1).toBe(true);
  });

  test('on a VERIFIED schedule, Week 18 is the cutoff only after it closes', () => {
    const verified = syntheticVerifiedCalendar();
    const last = verified.weeks[verified.weeks.length - 1];

    const inFinalWindow = new Date(last.finalGameWindowOpensAt).getTime() + 60 * 60 * 1000;
    expect(resolveEvidenceCutoff(verified, inFinalWindow).week).toBe(last.week - 1);

    const afterClose = new Date(last.endDate).getTime() + 60 * 1000;
    expect(resolveEvidenceCutoff(verified, afterClose).week).toBe(last.week);

    // And it does not keep climbing past the configured season.
    const longAfter = new Date(last.endDate).getTime() + 400 * 24 * 60 * 60 * 1000;
    expect(resolveEvidenceCutoff(verified, longAfter).week).toBe(last.week);
  });

  test('a null target is not reconstructed as Week 1 or the current week', () => {
    // The `?? 1` fallback was the same class of defect as the old clamp to
    // Week 18: it manufactures a week the calendar refused to produce.
    const pastEveryConfiguredSeason = at('2099-06-01T00:00:00Z');
    const phase = resolveSeasonPhase(pastEveryConfiguredSeason);
    expect(phase.configStatus).toBe('stale_calendar_config');
    expect(phase.targetWeek).toBeNull();

    const info = getCurrentWeek(pastEveryConfiguredSeason);
    expect(info.currentWeek).not.toBe(1);
    expect(info.currentWeek).toBe(0);
    expect(info.evidenceThroughWeek).toBeNull();
    expect(info.evidenceProvenance).toBe('stale_calendar_config');
  });
});

describe('historical archives take their cutoff from the requested season', () => {
  test('a VERIFIED archive is bounded by its own final week, not the live clock', () => {
    const verified = syntheticVerifiedCalendar(2031);
    // Live clock years later; the archive cutoff is still that season's own.
    const cutoff = resolveEvidenceCutoff(verified, at('2040-11-01T12:00:00Z').getTime());
    expect(cutoff.season).toBe(2031);
    expect(cutoff.week).toBe(verified.regularSeasonWeeks);
    expect(cutoff.provenance).toBe('verified_completed_week');
  });

  test('the archive cutoff does not move when the live clock does', () => {
    const a = resolveArchiveEvidenceCutoff(ANCHOR_SEASON, at('2026-09-01T12:00:00Z'));
    const b = resolveArchiveEvidenceCutoff(ANCHOR_SEASON, at('2026-12-31T12:00:00Z'));
    expect(a).toEqual(b);

    const verified = syntheticVerifiedCalendar(2031);
    expect(resolveEvidenceCutoff(verified, at('2040-01-01T00:00:00Z').getTime()))
      .toEqual(resolveEvidenceCutoff(verified, at('2050-01-01T00:00:00Z').getTime()));
  });

  test('an unconfigured season yields no cutoff rather than a live-week fallback', () => {
    const cutoff = resolveArchiveEvidenceCutoff(1999, at('2026-11-01T12:00:00Z'));
    expect(cutoff.week).toBeNull();
    expect(cutoff.season).toBeNull();
  });

  test('an anchor-derived archive still yields no cutoff', () => {
    const cutoff = resolveArchiveEvidenceCutoff(2026, at('2027-06-01T12:00:00Z'));
    expect(cutoff.week).toBeNull();
    expect(cutoff.provenance).toBe('anchor_derived_cannot_verify_completion');
  });
});

describe('calendar fields do not claim to be observations', () => {
  test('no week window field is named as a real kickoff or completion instant', () => {
    const window = anchorCalendar().weeks[0];
    // `mondayNightDate` read as the actual MNF kickoff instant; for an
    // anchor-derived season it is not a real league time at all.
    expect(window).not.toHaveProperty('mondayNightDate');
    expect(window).toHaveProperty('finalGameWindowOpensAt');
  });

  test('the final game window opening precedes the week closing', () => {
    for (const window of anchorCalendar().weeks) {
      expect(new Date(window.finalGameWindowOpensAt).getTime())
        .toBeLessThan(new Date(window.endDate).getTime());
    }
  });
});

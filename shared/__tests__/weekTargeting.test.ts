/**
 * Fantasy #307 Phase A — the decision-target / evidence split, detection side.
 *
 * One "current week" number was doing two incompatible jobs: naming the week a
 * forward board should aim at, and standing in for how much football evidence
 * exists. The target is forward-looking and may legitimately rest on a
 * provisional anchor-derived signal; evidence extent is a property of an
 * admitted SOURCE and is asserted route-side from what the source declares —
 * never from this module's calendar arithmetic.
 *
 * What detection owns, and what these tests pin: the target's provenance
 * travels with it; completion-dependent claims stay null where completion
 * cannot be asserted; and a null target is never reconstructed as Week 1.
 */

import {
  COMPLETION_NOT_VERIFIED_COPY,
  getCurrentWeek,
  getWeekInfo,
  resolveSeasonPhase,
} from '../weekDetection';
import { getSeasonCalendar } from '../nflSeasonCalendar';

const at = (iso: string) => new Date(iso);

describe('target provenance travels with the target', () => {
  test('an anchor-derived target says so, on both accessors', () => {
    // Every configured season is currently anchor-derived, 2025 included: its
    // longhand week rows are an exact seven-day stride off the Week 1 anchor.
    const phase = resolveSeasonPhase(at('2025-10-01T12:00:00Z'));
    expect(phase.targetWeek).not.toBeNull();
    expect(phase.targetProvenance).toBe('anchor_derived');
    expect(phase.targetIsProvisional).toBe(true);

    const info = getCurrentWeek(at('2025-10-01T12:00:00Z'));
    expect(info.targetProvenance).toBe('anchor_derived');
    expect(info.targetIsProvisional).toBe(true);
  });

  test('no target means no provenance, not a fabricated one', () => {
    const stale = resolveSeasonPhase(at('2099-06-01T00:00:00Z'));
    expect(stale.configStatus).toBe('stale_calendar_config');
    expect(stale.targetWeek).toBeNull();
    expect(stale.targetProvenance).toBeNull();
    expect(stale.targetIsProvisional).toBe(false);
  });

  test('the preseason forward target is provisional, and still a real target', () => {
    // The split must not disable forward planning — that would be the mirror
    // failure of over-claiming evidence.
    const phase = resolveSeasonPhase(at('2026-08-09T12:00:00Z'));
    expect(phase.targetSeason).toBe(2026);
    expect(phase.targetWeek).toBe(1);
    expect(phase.targetIsProvisional).toBe(true);
  });
});

describe('the Tuesday window: a provisional target rolls, completion claims do not', () => {
  const calendar = getSeasonCalendar(2025)!;
  const week = calendar.weeks[4]; // Week 5
  const insideWindow = at(new Date(new Date(week.mondayNightDate).getTime() + 60 * 60 * 1000).toISOString());

  test('the week is completion_unverified, not completed', () => {
    expect(resolveSeasonPhase(insideWindow).weekStatus).toBe('completion_unverified');
  });

  test('the forward target rolls past the week with nothing left to decide', () => {
    const phase = resolveSeasonPhase(insideWindow);
    expect(phase.targetWeek).toBe(week.week + 1);
    expect(phase.targetIsProvisional).toBe(true);
  });

  test('completion-dependent claims are null while completion is unverified', () => {
    const info = getWeekInfo(week.week, 2025, insideWindow);
    expect(info).not.toBeNull();
    expect(info!.weekStatus).toBe('completion_unverified');
    expect(info!.gamesCompleted).toBeNull();
    expect(info!.mondayNightCompleted).toBeNull();
  });

  test('the copy constant never implies completion', () => {
    expect(COMPLETION_NOT_VERIFIED_COPY).toBe('Completion not verified.');
    expect(COMPLETION_NOT_VERIFIED_COPY).not.toMatch(/\bcompleted\b|\bfinal\b/i);
  });
});

describe('Week 18 and the season boundary', () => {
  const calendar = getSeasonCalendar(2025)!;
  const week18 = calendar.weeks[calendar.weeks.length - 1];

  test('after the final week closes there is no Week 19 invented', () => {
    const afterFinalWeek = at(new Date(new Date(week18.endDate).getTime() + 60 * 60 * 1000).toISOString());
    const phase = resolveSeasonPhase(afterFinalWeek);
    expect(phase.regularSeasonWeek).toBeNull();
    // Postseason: the forward target is the NEXT season's Week 1 (configured)
    // or null — never week 19 of the finished season.
    expect(phase.targetWeek === null || phase.targetWeek === 1).toBe(true);
    if (phase.targetWeek === 1) expect(phase.targetSeason).toBe(2026);
  });

  test('a null target is not reconstructed as Week 1 or the current week', () => {
    // The `?? 1` fallback was the same class of defect as the old clamp to
    // Week 18: it manufactured a week number the calendar refused to produce,
    // and downstream treated the invention as detection. Zero cannot be
    // mistaken for a real NFL week, and week=0 requests fail closed.
    const pastEveryConfiguredSeason = at('2099-06-01T00:00:00Z');
    const phase = resolveSeasonPhase(pastEveryConfiguredSeason);
    expect(phase.configStatus).toBe('stale_calendar_config');
    expect(phase.targetWeek).toBeNull();

    const info = getCurrentWeek(pastEveryConfiguredSeason);
    expect(info.currentWeek).toBe(0);
    expect(info.currentWeek).not.toBe(1);
    expect(info.currentWeek).not.toBe(18);
  });
});

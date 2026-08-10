/**
 * NFL season calendar configuration (presentation source of truth).
 *
 * This module exists so that season/week/phase state is *data driven* rather
 * than pinned to a single hardcoded season. It is the presentation-side
 * counterpart to the ingestion season config; see `checkSeasonConfigAgreement`
 * in `shared/weekDetection.ts` for the reconciliation guard that keeps the two
 * from silently disagreeing.
 *
 * Honesty rules baked into this file:
 *
 * - A season whose real week-by-week schedule has been ingested is marked
 *   `scheduleSource: 'explicit_schedule'`.
 * - A season for which we only know the Week 1 kickoff anchor is marked
 *   `scheduleSource: 'anchor_derived'`. Consumers that need genuine per-game
 *   scheduling MUST check this flag rather than assuming week windows are
 *   authoritative. Phase detection (offseason/preseason/regular/postseason) is
 *   the only thing anchor-derived windows are trusted for.
 *
 * Adding a season = adding one entry here. No detection code changes.
 */

export type NflScheduleSource = 'explicit_schedule' | 'anchor_derived';

export interface NflWeekWindow {
  week: number;
  /** Thursday kickoff. */
  startDate: string;
  /** Tuesday after MNF — the point at which the week is "completed". */
  endDate: string;
  mondayNightDate: string;
}

export interface NflSeasonCalendar {
  season: number;
  scheduleSource: NflScheduleSource;
  /** Start of the preseason window (approximately the Hall of Fame game). */
  preseasonStart: string;
  /** End of this season's postseason, i.e. the Super Bowl. */
  postseasonEnd: string;
  regularSeasonWeeks: number;
  weeks: NflWeekWindow[];
}

/**
 * Nominal weekly cadence offsets, reused to derive week windows for seasons
 * where only the Week 1 anchor is known. These are league-cadence conventions,
 * not observations of a real schedule.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const WEEK_STRIDE_MS = 7 * DAY_MS;
/** Thursday 20:00Z → the following Wednesday 04:00Z. */
const WEEK_END_OFFSET_MS = 5 * DAY_MS + 8 * HOUR_MS;
/** Thursday 20:00Z → Tuesday 01:15Z (MNF ~8:15pm ET). */
const MONDAY_NIGHT_OFFSET_MS = 4 * DAY_MS + 5 * HOUR_MS + 15 * 60 * 1000;

/**
 * Derive week windows from a Week 1 Thursday kickoff anchor.
 *
 * These are cadence approximations, adequate for phase/week-boundary detection
 * and nothing else. The owning calendar entry must declare
 * `scheduleSource: 'anchor_derived'` so consumers can tell.
 */
export function deriveWeekWindowsFromAnchor(
  week1StartIso: string,
  regularSeasonWeeks: number,
): NflWeekWindow[] {
  const anchor = new Date(week1StartIso).getTime();
  if (Number.isNaN(anchor)) {
    throw new Error(`Invalid Week 1 anchor: ${week1StartIso}`);
  }

  return Array.from({ length: regularSeasonWeeks }, (_, index) => {
    const startMs = anchor + index * WEEK_STRIDE_MS;
    return {
      week: index + 1,
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(startMs + WEEK_END_OFFSET_MS).toISOString(),
      mondayNightDate: new Date(startMs + MONDAY_NIGHT_OFFSET_MS).toISOString(),
    };
  });
}

/** 2025 regular-season week windows, on the nominal Thursday/Sunday/Monday cadence. */
const NFL_2025_WEEKS: NflWeekWindow[] = [
  { week: 1, startDate: '2025-09-04T20:00:00Z', endDate: '2025-09-10T04:00:00Z', mondayNightDate: '2025-09-09T01:15:00Z' },
  { week: 2, startDate: '2025-09-11T20:00:00Z', endDate: '2025-09-17T04:00:00Z', mondayNightDate: '2025-09-16T01:15:00Z' },
  { week: 3, startDate: '2025-09-18T20:00:00Z', endDate: '2025-09-24T04:00:00Z', mondayNightDate: '2025-09-23T01:15:00Z' },
  { week: 4, startDate: '2025-09-25T20:00:00Z', endDate: '2025-10-01T04:00:00Z', mondayNightDate: '2025-09-30T01:15:00Z' },
  { week: 5, startDate: '2025-10-02T20:00:00Z', endDate: '2025-10-08T04:00:00Z', mondayNightDate: '2025-10-07T01:15:00Z' },
  { week: 6, startDate: '2025-10-09T20:00:00Z', endDate: '2025-10-15T04:00:00Z', mondayNightDate: '2025-10-14T01:15:00Z' },
  { week: 7, startDate: '2025-10-16T20:00:00Z', endDate: '2025-10-22T04:00:00Z', mondayNightDate: '2025-10-21T01:15:00Z' },
  { week: 8, startDate: '2025-10-23T20:00:00Z', endDate: '2025-10-29T04:00:00Z', mondayNightDate: '2025-10-28T01:15:00Z' },
  { week: 9, startDate: '2025-10-30T20:00:00Z', endDate: '2025-11-05T04:00:00Z', mondayNightDate: '2025-11-04T01:15:00Z' },
  { week: 10, startDate: '2025-11-06T20:00:00Z', endDate: '2025-11-12T04:00:00Z', mondayNightDate: '2025-11-11T01:15:00Z' },
  { week: 11, startDate: '2025-11-13T20:00:00Z', endDate: '2025-11-19T04:00:00Z', mondayNightDate: '2025-11-18T01:15:00Z' },
  { week: 12, startDate: '2025-11-20T20:00:00Z', endDate: '2025-11-26T04:00:00Z', mondayNightDate: '2025-11-25T01:15:00Z' },
  { week: 13, startDate: '2025-11-27T20:00:00Z', endDate: '2025-12-03T04:00:00Z', mondayNightDate: '2025-12-02T01:15:00Z' },
  { week: 14, startDate: '2025-12-04T20:00:00Z', endDate: '2025-12-10T04:00:00Z', mondayNightDate: '2025-12-09T01:15:00Z' },
  { week: 15, startDate: '2025-12-11T20:00:00Z', endDate: '2025-12-17T04:00:00Z', mondayNightDate: '2025-12-16T01:15:00Z' },
  { week: 16, startDate: '2025-12-18T20:00:00Z', endDate: '2025-12-24T04:00:00Z', mondayNightDate: '2025-12-23T01:15:00Z' },
  { week: 17, startDate: '2025-12-25T20:00:00Z', endDate: '2025-12-31T04:00:00Z', mondayNightDate: '2025-12-30T01:15:00Z' },
  { week: 18, startDate: '2026-01-01T20:00:00Z', endDate: '2026-01-07T04:00:00Z', mondayNightDate: '2026-01-06T01:15:00Z' },
];

/**
 * 2026 Week 1 kickoff anchor.
 *
 * The NFL opens on the Thursday following Labor Day; Labor Day 2026 is
 * September 7, giving a September 10 opener. This is a *configured anchor*, not
 * an ingested schedule — hence `scheduleSource: 'anchor_derived'`. Replace this
 * entry with `explicit_schedule` weeks once the real 2026 schedule is ingested.
 */
const NFL_2026_WEEK_1_ANCHOR = '2026-09-10T20:00:00Z';

export const NFL_SEASON_CALENDARS: NflSeasonCalendar[] = [
  {
    season: 2025,
    // NOT an ingested schedule, despite the rows being written out longhand.
    // Every week is the Week 1 anchor plus an exact seven-day stride (verified:
    // zero deviation across all 18), every week carries the same nominal
    // 01:15Z Monday slot, and Week 18 carries one too even though the real
    // Week 18 has no Monday night game. Labelling that `explicit_schedule`
    // contradicts this module's own definition and hands consumers false
    // provenance. It is anchor-derived until a real schedule is ingested.
    scheduleSource: 'anchor_derived',
    preseasonStart: '2025-07-31T00:00:00Z',
    postseasonEnd: '2026-02-09T04:00:00Z',
    regularSeasonWeeks: 18,
    weeks: NFL_2025_WEEKS,
  },
  {
    season: 2026,
    scheduleSource: 'anchor_derived',
    preseasonStart: '2026-07-30T00:00:00Z',
    postseasonEnd: '2027-02-15T04:00:00Z',
    regularSeasonWeeks: 18,
    weeks: deriveWeekWindowsFromAnchor(NFL_2026_WEEK_1_ANCHOR, 18),
  },
];

export function getSeasonCalendar(season: number): NflSeasonCalendar | null {
  return NFL_SEASON_CALENDARS.find((calendar) => calendar.season === season) ?? null;
}

/** Seasons this build can describe, newest last. */
export function getConfiguredSeasons(): number[] {
  return NFL_SEASON_CALENDARS.map((calendar) => calendar.season).sort((a, b) => a - b);
}

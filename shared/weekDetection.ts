/**
 * NFL season / week / phase detection.
 *
 * Replaces the previous single-season implementation, which hardcoded the 2025
 * schedule and — once that schedule ended — returned `{ season: 2025,
 * currentWeek: 18 }` forever. That made the live Rankings surface present
 * "2025, through week 18" as current state throughout 2026 (Fantasy #307).
 *
 * The calendar now lives in `shared/nflSeasonCalendar.ts` and this module only
 * interprets it. Two ideas are kept strictly separate:
 *
 * - **current phase** — where the league actually is right now
 *   (offseason / preseason / regular season week N / postseason);
 * - **target week** — the week a forward-looking ranking should be about.
 *
 * On 2026-08-09 those are "2026 · Preseason" and "Target: Week 1" respectively.
 * Collapsing them is what produced the original defect, so nothing in this file
 * reports a target week as if it were the current week.
 *
 * When the calendar runs out (i.e. real time has moved past every configured
 * season) detection fails **loudly** via `configStatus: 'stale_calendar_config'`
 * rather than clamping to the last known week.
 */

import {
  NFL_SEASON_CALENDARS,
  NflScheduleSource,
  NflSeasonCalendar,
  NflWeekWindow,
  getConfiguredSeasons,
  getSeasonCalendar,
} from './nflSeasonCalendar';

export type NflPhase = 'offseason' | 'preseason' | 'regular_season' | 'postseason';
export type NflWeekStatus = 'not_started' | 'in_progress' | 'completed';
export type SeasonConfigStatus = 'ok' | 'stale_calendar_config';

export interface SeasonPhaseInfo {
  /** The season the current phase belongs to. During the 2026 offseason this is 2026. */
  season: number;
  phase: NflPhase;
  /** Human label for the phase alone, e.g. "Preseason". */
  phaseLabel: string;
  /** Combined label, e.g. "2026 · Preseason" or "2025 · Week 12". */
  seasonPhaseLabel: string;

  /** Regular-season week number, or null when not in the regular season. */
  regularSeasonWeek: number | null;
  weekStatus: NflWeekStatus | null;

  /** Season/week a forward ranking should target. Null only when config is stale. */
  targetSeason: number | null;
  targetWeek: number | null;
  /** e.g. "Target: Week 1". Null when there is no resolvable target. */
  targetLabel: string | null;

  /**
   * Whether the target week's timing comes from an ingested schedule or from a
   * configured Week 1 anchor. Consumers needing real per-game times must check this.
   */
  scheduleSource: NflScheduleSource | null;

  configStatus: SeasonConfigStatus;
  configNote: string | null;
  configuredSeasons: number[];
  asOf: string;
}

/**
 * Backward-compatible shape for existing consumers of `getCurrentWeek()`.
 *
 * `currentWeek` remains a number so callers that use it as a query parameter
 * keep working, but outside the regular season it is the **target** week.
 * `regularSeasonWeek` is the honest, nullable value; prefer it plus `phase`.
 */
export interface WeekInfo {
  currentWeek: number;
  season: number;
  weekStatus: NflWeekStatus;
  mondayNightCompleted: boolean;
  weekStartDate: string;
  weekEndDate: string;
  nextWeekStartDate?: string;
  gamesCompleted: number;
  totalGames: number;

  // Phase-aware additions (Fantasy #307 Phase A).
  phase: NflPhase;
  phaseLabel: string;
  seasonPhaseLabel: string;
  regularSeasonWeek: number | null;
  targetSeason: number | null;
  targetWeek: number | null;
  targetLabel: string | null;
  scheduleSource: NflScheduleSource | null;
  configStatus: SeasonConfigStatus;
  configNote: string | null;
}

const TOTAL_GAMES_PER_WEEK = 16;

const PHASE_LABELS: Record<NflPhase, string> = {
  offseason: 'Offseason',
  preseason: 'Preseason',
  regular_season: 'Regular Season',
  postseason: 'Postseason',
};

function ms(iso: string): number {
  return new Date(iso).getTime();
}

function calendarsBySeason(): NflSeasonCalendar[] {
  return [...NFL_SEASON_CALENDARS].sort((a, b) => a.season - b.season);
}

function lastWeek(calendar: NflSeasonCalendar): NflWeekWindow {
  return calendar.weeks[calendar.weeks.length - 1];
}

function weekStatusAt(window: NflWeekWindow, nowMs: number): NflWeekStatus {
  if (nowMs < ms(window.startDate)) return 'not_started';
  if (nowMs < ms(window.mondayNightDate)) return 'in_progress';
  return 'completed';
}

/**
 * Find the regular-season week containing `nowMs`.
 *
 * Weeks have a gap between `endDate` (Wednesday) and the next `startDate`
 * (Thursday). Time inside that gap belongs to the upcoming week as
 * `not_started` — the previous implementation let it fall through, which is one
 * of the paths that reached the clamped Week 18 branch.
 */
function findRegularSeasonWeek(calendar: NflSeasonCalendar, nowMs: number): NflWeekWindow | null {
  for (const window of calendar.weeks) {
    if (nowMs < ms(window.startDate)) {
      // Inside the inter-week gap (or just before kickoff) — this week is next up.
      return window;
    }
    if (nowMs < ms(window.endDate)) {
      return window;
    }
  }
  return null;
}

function buildPhaseInfo(input: {
  season: number;
  phase: NflPhase;
  regularSeasonWeek: number | null;
  weekStatus: NflWeekStatus | null;
  targetSeason: number | null;
  targetWeek: number | null;
  scheduleSource: NflScheduleSource | null;
  configStatus?: SeasonConfigStatus;
  configNote?: string | null;
  nowIso: string;
}): SeasonPhaseInfo {
  const phaseLabel = PHASE_LABELS[input.phase];
  const seasonPhaseLabel =
    input.phase === 'regular_season' && input.regularSeasonWeek !== null
      ? `${input.season} · Week ${input.regularSeasonWeek}`
      : `${input.season} · ${phaseLabel}`;

  return {
    season: input.season,
    phase: input.phase,
    phaseLabel,
    seasonPhaseLabel,
    regularSeasonWeek: input.regularSeasonWeek,
    weekStatus: input.weekStatus,
    targetSeason: input.targetSeason,
    targetWeek: input.targetWeek,
    targetLabel: input.targetWeek === null ? null : `Target: Week ${input.targetWeek}`,
    scheduleSource: input.scheduleSource,
    configStatus: input.configStatus ?? 'ok',
    configNote: input.configNote ?? null,
    configuredSeasons: getConfiguredSeasons(),
    asOf: input.nowIso,
  };
}

/**
 * Resolve the current NFL phase and the forward-looking target week.
 */
export function resolveSeasonPhase(currentDate?: Date): SeasonPhaseInfo {
  const now = currentDate ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const calendars = calendarsBySeason();

  for (let i = 0; i < calendars.length; i++) {
    const calendar = calendars[i];
    const preseasonStartMs = ms(calendar.preseasonStart);
    const week1StartMs = ms(calendar.weeks[0].startDate);
    const regularSeasonEndMs = ms(lastWeek(calendar).endDate);
    const postseasonEndMs = ms(calendar.postseasonEnd);

    // Offseason belonging to this season: after the previous season's postseason
    // ended (or from the beginning of time for the first configured season) and
    // before this season's preseason opens.
    const previous = calendars[i - 1];
    const offseasonStartMs = previous ? ms(previous.postseasonEnd) : Number.NEGATIVE_INFINITY;
    if (nowMs >= offseasonStartMs && nowMs < preseasonStartMs) {
      return buildPhaseInfo({
        season: calendar.season,
        phase: 'offseason',
        regularSeasonWeek: null,
        weekStatus: null,
        targetSeason: calendar.season,
        targetWeek: 1,
        scheduleSource: calendar.scheduleSource,
        nowIso,
      });
    }

    if (nowMs >= preseasonStartMs && nowMs < week1StartMs) {
      return buildPhaseInfo({
        season: calendar.season,
        phase: 'preseason',
        regularSeasonWeek: null,
        weekStatus: null,
        targetSeason: calendar.season,
        targetWeek: 1,
        scheduleSource: calendar.scheduleSource,
        nowIso,
      });
    }

    if (nowMs >= week1StartMs && nowMs < regularSeasonEndMs) {
      const window = findRegularSeasonWeek(calendar, nowMs);
      if (window) {
        const status = weekStatusAt(window, nowMs);
        // Once a week is complete the forward target rolls to the next week;
        // after the final week it rolls to the postseason (no target week).
        const targetWeek =
          status === 'completed'
            ? window.week < calendar.regularSeasonWeeks
              ? window.week + 1
              : null
            : window.week;
        return buildPhaseInfo({
          season: calendar.season,
          phase: 'regular_season',
          regularSeasonWeek: window.week,
          weekStatus: status,
          targetSeason: targetWeek === null ? null : calendar.season,
          targetWeek,
          scheduleSource: calendar.scheduleSource,
          nowIso,
        });
      }
    }

    if (nowMs >= regularSeasonEndMs && nowMs < postseasonEndMs) {
      // No regular-season week is in play; the next forward target is the
      // following season's Week 1 when that season is configured.
      const next = calendars[i + 1];
      return buildPhaseInfo({
        season: calendar.season,
        phase: 'postseason',
        regularSeasonWeek: null,
        weekStatus: null,
        targetSeason: next ? next.season : null,
        targetWeek: next ? 1 : null,
        scheduleSource: next ? next.scheduleSource : calendar.scheduleSource,
        configNote: next
          ? null
          : `No calendar configured after ${calendar.season}; no forward target week is available.`,
        nowIso,
      });
    }
  }

  // Past every configured season. Fail loudly instead of clamping to the last
  // known week — clamping is the original #307 defect.
  const newest = calendars[calendars.length - 1];
  return buildPhaseInfo({
    season: newest.season + 1,
    phase: 'offseason',
    regularSeasonWeek: null,
    weekStatus: null,
    targetSeason: null,
    targetWeek: null,
    scheduleSource: null,
    configStatus: 'stale_calendar_config',
    configNote:
      `NFL season calendar ends after ${newest.season}. ` +
      `Add the next season to shared/nflSeasonCalendar.ts; season/week state is unavailable until then.`,
    nowIso,
  });
}

/**
 * Estimate completed games within an in-progress week.
 */
function estimateGamesCompleted(currentDate: Date, window: NflWeekWindow): number {
  const startTime = ms(window.startDate);
  const mondayNightTime = ms(window.mondayNightDate);
  const currentTime = currentDate.getTime();

  if (currentTime < startTime) return 0;
  if (currentTime >= mondayNightTime) return TOTAL_GAMES_PER_WEEK;

  const dayOfWeek = currentDate.getUTCDay();
  const hour = currentDate.getUTCHours();

  if (dayOfWeek === 4) return hour >= 20 ? 1 : 0; // Thursday
  if (dayOfWeek === 5 || dayOfWeek === 6) return 1; // Friday–Saturday: TNF only
  if (dayOfWeek === 0) {
    // Sunday
    if (hour < 17) return 1;
    if (hour < 21) return 8;
    return 12;
  }
  if (dayOfWeek === 1) return 13; // Monday, pre-MNF
  return 0;
}

function windowFor(season: number, week: number | null): NflWeekWindow | null {
  if (week === null) return null;
  const calendar = getSeasonCalendar(season);
  return calendar?.weeks.find((w) => w.week === week) ?? null;
}

/**
 * Backward-compatible current-week accessor.
 *
 * Prefer `resolveSeasonPhase()` for new code — `currentWeek` here is the target
 * week outside the regular season, which is exactly the conflation #307 exists
 * to remove. The phase fields on the result carry the honest state.
 */
export function getCurrentWeek(currentDate?: Date): WeekInfo {
  const now = currentDate ?? new Date();
  const phase = resolveSeasonPhase(now);

  const displaySeason = phase.phase === 'regular_season' ? phase.season : phase.targetSeason ?? phase.season;
  const displayWeek = phase.regularSeasonWeek ?? phase.targetWeek ?? 1;
  const window = windowFor(displaySeason, displayWeek);

  const weekStatus: NflWeekStatus =
    phase.weekStatus ?? (window ? weekStatusAt(window, now.getTime()) : 'not_started');
  const mondayNightCompleted = window ? now.getTime() >= ms(window.mondayNightDate) : false;
  const calendar = getSeasonCalendar(displaySeason);
  const nextWindow = calendar?.weeks.find((w) => w.week === displayWeek + 1);

  return {
    currentWeek: displayWeek,
    season: displaySeason,
    weekStatus,
    mondayNightCompleted,
    weekStartDate: window?.startDate ?? '',
    weekEndDate: window?.endDate ?? '',
    nextWeekStartDate: nextWindow?.startDate,
    gamesCompleted: window
      ? mondayNightCompleted
        ? TOTAL_GAMES_PER_WEEK
        : estimateGamesCompleted(now, window)
      : 0,
    totalGames: TOTAL_GAMES_PER_WEEK,

    phase: phase.phase,
    phaseLabel: phase.phaseLabel,
    seasonPhaseLabel: phase.seasonPhaseLabel,
    regularSeasonWeek: phase.regularSeasonWeek,
    targetSeason: phase.targetSeason,
    targetWeek: phase.targetWeek,
    targetLabel: phase.targetLabel,
    scheduleSource: phase.scheduleSource,
    configStatus: phase.configStatus,
    configNote: phase.configNote,
  };
}

/**
 * Week info for an explicit season/week, or null when that week is not configured.
 */
export function getWeekInfo(week: number, season?: number, currentDate?: Date): WeekInfo | null {
  const now = currentDate ?? new Date();
  const resolvedSeason = season ?? resolveSeasonPhase(now).season;
  const calendar = getSeasonCalendar(resolvedSeason);
  const window = calendar?.weeks.find((w) => w.week === week);
  if (!calendar || !window) return null;

  const status = weekStatusAt(window, now.getTime());
  const mondayNightCompleted = now.getTime() >= ms(window.mondayNightDate);
  const phase = resolveSeasonPhase(now);
  const nextWindow = calendar.weeks.find((w) => w.week === week + 1);

  return {
    currentWeek: week,
    season: resolvedSeason,
    weekStatus: status,
    mondayNightCompleted,
    weekStartDate: window.startDate,
    weekEndDate: window.endDate,
    nextWeekStartDate: nextWindow?.startDate,
    gamesCompleted: mondayNightCompleted ? TOTAL_GAMES_PER_WEEK : estimateGamesCompleted(now, window),
    totalGames: TOTAL_GAMES_PER_WEEK,

    phase: phase.phase,
    phaseLabel: phase.phaseLabel,
    seasonPhaseLabel: phase.seasonPhaseLabel,
    regularSeasonWeek: phase.regularSeasonWeek,
    targetSeason: phase.targetSeason,
    targetWeek: phase.targetWeek,
    targetLabel: phase.targetLabel,
    scheduleSource: calendar.scheduleSource,
    configStatus: phase.configStatus,
    configNote: phase.configNote,
  };
}

/**
 * Risers/fallers need the previous week to be complete within the same season.
 */
export function isRisersFallersDataAvailable(week: number, season?: number, currentDate?: Date): boolean {
  if (week < 2) return false;
  const previous = getWeekInfo(week - 1, season, currentDate);
  return previous?.weekStatus === 'completed';
}

/**
 * Best week to show risers/fallers for, or null when no completed week exists
 * in the current season (e.g. offseason/preseason).
 */
export function getBestRisersFallersWeek(currentDate?: Date): number | null {
  const phase = resolveSeasonPhase(currentDate);
  if (phase.phase !== 'regular_season' || phase.regularSeasonWeek === null) return null;

  const week = phase.regularSeasonWeek;
  if (phase.weekStatus === 'completed' && week >= 2) return week;
  if (week >= 2 && isRisersFallersDataAvailable(week, phase.season, currentDate)) return week - 1;
  return null;
}

/**
 * Guard against the ingestion season config and the presentation calendar
 * silently disagreeing (Fantasy #307 Phase A acceptance criterion).
 *
 * `ingestionSeason` is the value ingestion paths are pinned to — e.g. the
 * `TIBER_SEASON` / `CURRENT_SEASON` config. Presentation uses the season that
 * owns the current phase.
 */
export interface SeasonConfigAgreement {
  agrees: boolean;
  ingestionSeason: number | null;
  presentationSeason: number;
  reason: string | null;
}

export function checkSeasonConfigAgreement(
  ingestionSeason: number | null | undefined,
  currentDate?: Date,
): SeasonConfigAgreement {
  const phase = resolveSeasonPhase(currentDate);
  const presentationSeason = phase.season;

  if (ingestionSeason === null || ingestionSeason === undefined) {
    return {
      agrees: false,
      ingestionSeason: null,
      presentationSeason,
      reason: 'No ingestion season configured; cannot verify agreement with presentation season.',
    };
  }

  if (ingestionSeason !== presentationSeason) {
    return {
      agrees: false,
      ingestionSeason,
      presentationSeason,
      reason:
        `Ingestion season ${ingestionSeason} does not match presentation season ${presentationSeason} ` +
        `(${phase.seasonPhaseLabel}).`,
    };
  }

  return { agrees: true, ingestionSeason, presentationSeason, reason: null };
}

/** Debug helper retained for the existing `/api/current-week?debug=true` path. */
export function debugWeekDetection(testDate?: string): WeekInfo {
  const testDateTime = testDate ? new Date(testDate) : new Date();
  return getCurrentWeek(testDateTime);
}

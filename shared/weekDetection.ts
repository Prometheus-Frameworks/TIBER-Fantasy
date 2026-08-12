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
/**
 * `completion_unverified` is the interval between the Monday kickoff and the
 * configured week end. We have no per-game completion signal, so we know the
 * week is not verifiably final and we do NOT know that games are still being
 * played. Reporting `in_progress` there asserted the latter, which is a claim
 * we cannot support — the mirror image of the original defect.
 */
export type NflWeekStatus = 'not_started' | 'in_progress' | 'completion_unverified' | 'completed';
export type SeasonConfigStatus = 'ok' | 'stale_calendar_config';

/**
 * Where a target week's timing comes from.
 *
 * `verified_schedule` — the season's real week-by-week schedule was ingested.
 * `anchor_derived`   — only the Week 1 kickoff anchor is known and every other
 *                      boundary is cadence arithmetic off it.
 *
 * An anchor-derived target is a **provisional scheduling signal**. It is enough
 * to say "the board should be aiming at Week N" and never enough to say that
 * any game kicked off, that a week completed, or that a specific number of
 * games finished. It may drive forward-looking requests only while this
 * provenance travels with it.
 */
export type TargetProvenance = 'verified_schedule' | 'anchor_derived';

/**
 * Copy for any surface that cannot assert completion. This build has no
 * per-game finalization source at all, so no copy anywhere should imply that
 * games or weeks are known to be final.
 */
export const COMPLETION_NOT_VERIFIED_COPY = 'Completion not verified.';

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
   * `scheduleSource` restated as target provenance, so a consumer reading the
   * target does not have to know that `explicit_schedule` is the trustworthy
   * one. Null exactly when there is no target.
   */
  targetProvenance: TargetProvenance | null;
  /** True when the target rests on anchor arithmetic rather than an ingested schedule. */
  targetIsProvisional: boolean;

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
  /**
   * `null` while completion is unverified. This is not a boolean we can always
   * answer: between the Monday kickoff and the week end we have no signal
   * either way, and emitting `false` asserted the game was still running.
   */
  mondayNightCompleted: boolean | null;
  weekStartDate: string;
  weekEndDate: string;
  nextWeekStartDate?: string;
  /** `null` while completion is unverified — see `mondayNightCompleted`. */
  gamesCompleted: number | null;
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
  // Additive (Fantasy #307 Phase A): the target's provenance travels with it.
  // No pre-existing field changes name, type or nullability.
  targetProvenance: TargetProvenance | null;
  targetIsProvisional: boolean;
  configStatus: SeasonConfigStatus;
  configNote: string | null;
  /**
   * Seasons this build can describe, additive alongside `configStatus`
   * (Fantasy #307 correction round 4). Present regardless of whether the
   * live calendar is stale: a stale live phase still names which archives a
   * caller may explicitly request, distinct from "which season is the
   * current live target" (which `configStatus` governs).
   */
  configuredSeasons: number[];
}

const TOTAL_GAMES_PER_WEEK = 16;
/**
 * Nominal elapsed time from kickoff to a final whistle. Used only to keep the
 * games-completed estimate from counting a game that is still being played;
 * it is a cadence convention, not an observation of any real game.
 */
const GAME_DURATION_HOURS = 3;

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

function weekStatusAt(
  window: NflWeekWindow,
  nowMs: number,
  scheduleSource: NflScheduleSource,
): NflWeekStatus {
  if (nowMs < ms(window.startDate)) return 'not_started';
  // Three intervals, because there are three genuinely different states:
  //   startDate .. MNF kickoff  — games are scheduled and running: in_progress
  //   MNF kickoff .. endDate    — the last game may or may not have finished
  //   endDate ..                — the scheduled window has elapsed
  //
  // The middle interval is the honest one. `mondayNightDate` is a kickoff, so
  // treating it as completion published results that did not exist; a fixed
  // duration estimate only narrowed that window. But calling the interval
  // `in_progress` is equally a claim — that football is still being played —
  // and we cannot support it either. It is uncertainty, and it is typed as such.
  if (nowMs < ms(window.mondayNightDate)) return 'in_progress';
  if (nowMs < ms(window.endDate)) return 'completion_unverified';
  // Past the closing boundary. Whether that means COMPLETED depends on what
  // the boundary is: an ingested schedule's week end is a real league
  // boundary, but an anchor-derived window is cadence arithmetic that the
  // calendar's own contract says is suitable for phase detection only. Both
  // configured seasons are currently anchor-derived, so without a real
  // finalization source, completion stays unverified — reporting 'completed'
  // here is what let both current-week endpoints publish
  // `mondayNightCompleted: true` and a 16-game count from arithmetic.
  return scheduleSource === 'explicit_schedule' ? 'completed' : 'completion_unverified';
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
    targetProvenance:
      input.targetWeek === null || input.scheduleSource === null
        ? null
        : input.scheduleSource === 'explicit_schedule' ? 'verified_schedule' : 'anchor_derived',
    targetIsProvisional: input.targetWeek !== null && input.scheduleSource === 'anchor_derived',
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
        const status = weekStatusAt(window, nowMs, calendar.scheduleSource);
        // The forward target is decoupled from result finalization.
        //
        // Start/sit, waivers and the Rankings board are forward-planning
        // surfaces: once this week's last game has kicked off there is nothing
        // further to decide about it, so the target rolls then. Whether this
        // week's RESULTS may be published is a separate question answered by
        // `weekStatus`, and it stays gated to the configured week end.
        //
        // Tying the target to finalization made every downstream consumer wait
        // for evidence none of them needed.
        const targetRolls = status === 'completed' || status === 'completion_unverified';
        const targetWeek =
          targetRolls
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
  // Kickoff is not completion, and neither is it evidence of a specific count.
  // From the Monday kickoff to the week end the caller gets `null` from
  // getCurrentWeek/getWeekInfo rather than a number; this helper is only
  // consulted for the observable part of the week.
  if (currentTime >= ms(window.endDate)) return TOTAL_GAMES_PER_WEEK;
  if (currentTime >= mondayNightTime) return TOTAL_GAMES_PER_WEEK - 1;

  // Every boundary below is a *completion* boundary, measured from this week's
  // own Thursday kickoff anchor. Two defects are being removed at once:
  //
  //  - the ladder stepped at KICKOFF times, so a game counted as completed the
  //    instant it started (20:00Z Thursday reported one game done while it was
  //    being played; 17:00Z Sunday reported eight);
  //  - it bucketed by UTC weekday, so the early hours of UTC Monday — still
  //    Sunday evening in the US, with the 4pm ET slate live — reported 13.
  //
  // Offsets from the anchor are timezone-free and use the same basis as the
  // rest of this module. They remain nominal-cadence approximations over an
  // anchor-derived calendar: flex scheduling, international kickoffs and
  // overrun all move them. That is precisely why the caller emits `null`
  // rather than a number for the part of the week this cannot describe.
  const hoursSinceKickoff = (currentTime - startTime) / (60 * 60 * 1000);

  // Thursday 20:00Z + 3h.
  if (hoursSinceKickoff < GAME_DURATION_HOURS) return 0;
  // Sunday early slate (17:00Z, i.e. anchor + 69h) finishes at anchor + 72h.
  if (hoursSinceKickoff < 72) return 1;
  // Sunday late slate (~21:00Z, anchor + 73h) finishes at anchor + 76h.
  if (hoursSinceKickoff < 76) return 8;
  // Sunday night (~01:20Z Monday, anchor + 77h) finishes at anchor + 80h.
  if (hoursSinceKickoff < 80) return 12;
  // Everything but Monday night. MNF itself is handled by the branches above,
  // which key off the calendar's own Monday-night timestamp.
  return 13;
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
  // No `?? 1`. Reconstructing a null target as Week 1 is the same class of
  // defect as the old clamp to Week 18: it manufactures a week number the
  // calendar refused to produce, and every downstream consumer then treats
  // the invention as detection. When there is no target, `currentWeek` is 0 —
  // a value that cannot be mistaken for a real NFL week — and `configStatus`
  // and `targetWeek` carry the real answer.
  const displayWeek = phase.regularSeasonWeek ?? phase.targetWeek ?? 0;
  const window = windowFor(displaySeason, displayWeek);
  const calendar = getSeasonCalendar(displaySeason);

  const weekStatus: NflWeekStatus =
    phase.weekStatus ??
    (window && calendar ? weekStatusAt(window, now.getTime(), calendar.scheduleSource) : 'not_started');
  const mondayNightCompleted = window
    ? (weekStatus === 'completion_unverified' ? null : now.getTime() >= ms(window.endDate))
    : false;
  const nextWindow = calendar?.weeks.find((w) => w.week === displayWeek + 1);

  return {
    currentWeek: displayWeek,
    season: displaySeason,
    weekStatus,
    mondayNightCompleted,
    weekStartDate: window?.startDate ?? '',
    weekEndDate: window?.endDate ?? '',
    nextWeekStartDate: nextWindow?.startDate,
    gamesCompleted:
      weekStatus === 'completion_unverified'
        ? null
        : window
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
    targetProvenance: phase.targetProvenance,
    targetIsProvisional: phase.targetIsProvisional,
    configStatus: phase.configStatus,
    configNote: phase.configNote,
    configuredSeasons: phase.configuredSeasons,
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

  const status = weekStatusAt(window, now.getTime(), calendar.scheduleSource);
  const mondayNightCompleted =
    status === 'completion_unverified' ? null : now.getTime() >= ms(window.endDate);
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
    gamesCompleted:
      status === 'completion_unverified'
        ? null
        : mondayNightCompleted ? TOTAL_GAMES_PER_WEEK : estimateGamesCompleted(now, window),
    totalGames: TOTAL_GAMES_PER_WEEK,

    phase: phase.phase,
    phaseLabel: phase.phaseLabel,
    seasonPhaseLabel: phase.seasonPhaseLabel,
    regularSeasonWeek: phase.regularSeasonWeek,
    targetSeason: phase.targetSeason,
    targetWeek: phase.targetWeek,
    targetLabel: phase.targetLabel,
    scheduleSource: calendar.scheduleSource,
    targetProvenance: phase.targetProvenance,
    targetIsProvisional: phase.targetIsProvisional,
    configStatus: phase.configStatus,
    configNote: phase.configNote,
    configuredSeasons: phase.configuredSeasons,
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
 * `TIBER_SEASON` / `INGESTION_DEFAULT_SEASON` config. Presentation uses the
 * season that owns the current phase.
 */
export interface SeasonConfigAgreement {
  agrees: boolean;
  ingestionSeason: number | null;
  /** Legacy numeric field retained for rolling clients; stale state may contain the internal sentinel. */
  presentationSeason: number;
  /** Truthful phase season, null when the configured live calendar is stale. */
  resolvedPresentationSeason?: number | null;
  reason: string | null;
}

export function checkSeasonConfigAgreement(
  ingestionSeason: number | null | undefined,
  currentDate?: Date,
): SeasonConfigAgreement {
  const phase = resolveSeasonPhase(currentDate);
  // Past the governed calendar, `phase.season` is newest+1 solely as an
  // internal stale sentinel. It is not a presentation season fact.
  const presentationSeason = phase.season;
  const resolvedPresentationSeason = phase.configStatus === 'ok' ? phase.season : null;

  if (resolvedPresentationSeason === null) {
    return {
      agrees: false,
      ingestionSeason: ingestionSeason ?? null,
      presentationSeason,
      resolvedPresentationSeason: null,
      reason: 'Presentation season is unavailable because the NFL season calendar is stale.',
    };
  }

  if (ingestionSeason === null || ingestionSeason === undefined) {
    return {
      agrees: false,
      ingestionSeason: null,
      presentationSeason,
      resolvedPresentationSeason,
      reason: 'No ingestion season configured; cannot verify agreement with presentation season.',
    };
  }

  if (ingestionSeason !== presentationSeason) {
    return {
      agrees: false,
      ingestionSeason,
      presentationSeason,
      resolvedPresentationSeason,
      reason:
        `Ingestion season ${ingestionSeason} does not match presentation season ${presentationSeason} ` +
        `(${phase.seasonPhaseLabel}).`,
    };
  }

  return {
    agrees: true,
    ingestionSeason,
    presentationSeason,
    resolvedPresentationSeason,
    reason: null,
  };
}

/** Debug helper retained for the existing `/api/current-week?debug=true` path. */
export function debugWeekDetection(testDate?: string): WeekInfo {
  const testDateTime = testDate ? new Date(testDate) : new Date();
  return getCurrentWeek(testDateTime);
}

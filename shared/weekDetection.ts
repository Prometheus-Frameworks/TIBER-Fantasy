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
 * Week N-1's games finished.
 */
export type TargetProvenance = 'verified_schedule' | 'anchor_derived';

/**
 * Why an evidence cutoff is or is not available.
 *
 * `verified_completed_week` is the only value that admits results. Everything
 * else means: there is no week whose completion we can support, so downstream
 * must not admit results as though there were.
 */
export type EvidenceProvenance =
  | 'verified_completed_week'
  | 'no_completed_week'
  | 'completion_unverified'
  | 'anchor_derived_cannot_verify_completion'
  | 'stale_calendar_config';

/** Copy for a state where completion cannot be asserted. */
export const COMPLETION_NOT_VERIFIED_COPY = 'Completion not verified.';

/**
 * The split that Fantasy #307 Phase A exists to make.
 *
 * A single "current week" number was being used for two incompatible jobs:
 *
 *  - **decision target** — the week the forward board, start/sit and waiver
 *    surfaces should be aiming at. Forward-looking, and legitimately allowed to
 *    roll on a provisional, anchor-derived signal.
 *  - **evidence cutoff** — the last week whose results may be admitted. This
 *    requires *verified completion* and can never be satisfied by a kickoff
 *    boundary or by anchor arithmetic.
 *
 * Conflating them let an anchor-derived calendar date admit results for games
 * that had not been played. They are separate fields with separate provenance,
 * and the evidence side fails closed to `null`.
 */
export interface WeekTargeting {
  contractVersion: 'week-targeting-v1';

  /** Forward-looking. May be provisional; see `decisionTargetProvenance`. */
  decisionTargetSeason: number | null;
  decisionTargetWeek: number | null;
  decisionTargetProvenance: TargetProvenance | null;
  /**
   * True when the target rests on anchor arithmetic rather than an ingested
   * schedule. Such a target may drive forward-looking requests **only** while
   * this flag travels with it and the UI does not imply completion.
   */
  decisionTargetIsProvisional: boolean;

  /**
   * Last week whose results may be admitted. `null` whenever completion cannot
   * be verified — which includes every anchor-derived season.
   */
  evidenceThroughSeason: number | null;
  evidenceThroughWeek: number | null;
  evidenceProvenance: EvidenceProvenance;

  /** False whenever `evidenceThroughWeek` is null. */
  completionVerified: boolean;
  /** Copy safe to render. Never implies completion when it is unverified. */
  completionCopy: string | null;
}

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

  /**
   * `scheduleSource` restated as target provenance, so a consumer reading the
   * target does not have to know that `explicit_schedule` is the trustworthy
   * one. Null exactly when there is no target.
   */
  targetProvenance: TargetProvenance | null;
  /** True when the target rests on anchor arithmetic. */
  targetIsProvisional: boolean;

  /**
   * The evidence cutoff — the last week whose results may be admitted.
   *
   * Deliberately NOT the target. Null whenever completion cannot be verified,
   * which includes anchor-derived seasons and the `completion_unverified`
   * interval. Downstream must fail closed on null rather than substituting the
   * target or the current week.
   */
  evidenceThroughSeason: number | null;
  evidenceThroughWeek: number | null;
  evidenceProvenance: EvidenceProvenance;

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

  // The decision-target / evidence-cutoff split (Fantasy #307 Phase A).
  // Added, not substituted: every pre-existing field keeps its name and type,
  // so an existing consumer is unaffected while a new one can read the honest
  // values. `resolveWeekTargeting()` is the preferred entry point.
  targetProvenance: TargetProvenance | null;
  targetIsProvisional: boolean;
  evidenceThroughSeason: number | null;
  evidenceThroughWeek: number | null;
  evidenceProvenance: EvidenceProvenance;

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
  // Three intervals, because there are three genuinely different states:
  //   startDate .. MNF kickoff  — games are scheduled and running: in_progress
  //   MNF kickoff .. endDate    — the last game may or may not have finished
  //   endDate ..                — verifiably final
  //
  // The middle interval is the honest one. `finalGameWindowOpensAt` is a kickoff, so
  // treating it as completion published results that did not exist; a fixed
  // duration estimate only narrowed that window. But calling the interval
  // `in_progress` is equally a claim — that football is still being played —
  // and we cannot support it either. It is uncertainty, and it is typed as such.
  if (nowMs < ms(window.finalGameWindowOpensAt)) return 'in_progress';
  if (nowMs < ms(window.endDate)) return 'completion_unverified';
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

function targetProvenanceOf(source: NflScheduleSource | null): TargetProvenance | null {
  if (source === null) return null;
  return source === 'explicit_schedule' ? 'verified_schedule' : 'anchor_derived';
}

/**
 * The latest week whose results may be admitted, and why.
 *
 * The rule is deliberately strict, because this is the value that gates whether
 * football results reach a consumer:
 *
 *  - An `anchor_derived` season can never supply one. Its week boundaries are
 *    arithmetic off a single anchor, so "this week ended" is a statement about
 *    a calculation, not about football.
 *  - Within a verified schedule, only a week past its closing boundary counts.
 *    `completion_unverified` — after the final game window opens but before the
 *    week closes — is explicitly not a completed week.
 *
 * Returning `null` is a real answer: it means no week's results may be admitted.
 * Callers must not substitute the target or the current week for it.
 */
export function resolveEvidenceCutoff(
  calendar: NflSeasonCalendar | undefined,
  nowMs: number,
): { season: number | null; week: number | null; provenance: EvidenceProvenance } {
  if (!calendar) {
    return { season: null, week: null, provenance: 'no_completed_week' };
  }
  if (calendar.scheduleSource !== 'explicit_schedule') {
    return {
      season: null,
      week: null,
      provenance: 'anchor_derived_cannot_verify_completion',
    };
  }

  let latestCompleted: number | null = null;
  let sawUnverified = false;
  for (const window of calendar.weeks) {
    const status = weekStatusAt(window, nowMs);
    if (status === 'completed') latestCompleted = window.week;
    else if (status === 'completion_unverified') sawUnverified = true;
  }

  if (latestCompleted === null) {
    return {
      season: null,
      week: null,
      provenance: sawUnverified ? 'completion_unverified' : 'no_completed_week',
    };
  }
  return { season: calendar.season, week: latestCompleted, provenance: 'verified_completed_week' };
}

/**
 * Evidence cutoff for an explicitly requested season.
 *
 * A historical archive's cutoff is a property of **that season**, not of the
 * live clock. Reading the current-season week into an archive request was how a
 * 2024 board ended up cut off at a 2026 week number.
 */
export function resolveArchiveEvidenceCutoff(
  season: number,
  currentDate?: Date,
): { season: number | null; week: number | null; provenance: EvidenceProvenance } {
  const now = currentDate ?? new Date();
  return resolveEvidenceCutoff(getSeasonCalendar(season) ?? undefined, now.getTime());
}

function buildPhaseInfo(input: {
  season: number;
  phase: NflPhase;
  regularSeasonWeek: number | null;
  weekStatus: NflWeekStatus | null;
  targetSeason: number | null;
  targetWeek: number | null;
  scheduleSource: NflScheduleSource | null;
  /**
   * Calendar the EVIDENCE would come from — the phase-owning season, not the
   * forward target's. Omitted only when the config is stale.
   */
  evidenceCalendar?: NflSeasonCalendar;
  configStatus?: SeasonConfigStatus;
  configNote?: string | null;
  nowMs: number;
  nowIso: string;
}): SeasonPhaseInfo {
  const evidence = input.configStatus === 'stale_calendar_config'
    ? { season: null, week: null, provenance: 'stale_calendar_config' as EvidenceProvenance }
    : resolveEvidenceCutoff(input.evidenceCalendar, input.nowMs);
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
    targetProvenance: input.targetWeek === null ? null : targetProvenanceOf(input.scheduleSource),
    targetIsProvisional: input.targetWeek !== null && input.scheduleSource === 'anchor_derived',
    // The evidence cutoff belongs to the season the EVIDENCE would come from —
    // the phase-owning season — not the forward target season.
    evidenceThroughSeason: evidence.season,
    evidenceThroughWeek: evidence.week,
    evidenceProvenance: evidence.provenance,
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
        evidenceCalendar: calendar,
        nowMs,
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
        evidenceCalendar: calendar,
        nowMs,
        nowIso,
      });
    }

    if (nowMs >= week1StartMs && nowMs < regularSeasonEndMs) {
      const window = findRegularSeasonWeek(calendar, nowMs);
      if (window) {
        const status = weekStatusAt(window, nowMs);
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
          evidenceCalendar: calendar,
          nowMs,
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
        evidenceCalendar: calendar,
        nowMs,
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
    nowMs,
    nowIso,
  });
}

/**
 * The decision-target / evidence-cutoff split, as one typed value.
 *
 * This is the contract consumers should request. Handing a surface a single
 * week number forces it to guess which of the two jobs that number is for, and
 * every such guess so far has resolved toward admitting results.
 */
export function resolveWeekTargeting(currentDate?: Date): WeekTargeting {
  const phase = resolveSeasonPhase(currentDate);
  const completionVerified = phase.evidenceThroughWeek !== null;

  return {
    contractVersion: 'week-targeting-v1',
    decisionTargetSeason: phase.targetSeason,
    decisionTargetWeek: phase.targetWeek,
    decisionTargetProvenance: phase.targetProvenance,
    decisionTargetIsProvisional: phase.targetIsProvisional,
    evidenceThroughSeason: phase.evidenceThroughSeason,
    evidenceThroughWeek: phase.evidenceThroughWeek,
    evidenceProvenance: phase.evidenceProvenance,
    completionVerified,
    completionCopy: completionVerified
      ? `Complete through Week ${phase.evidenceThroughWeek}.`
      : COMPLETION_NOT_VERIFIED_COPY,
  };
}

/**
 * Estimate completed games within an in-progress week.
 */
function estimateGamesCompleted(currentDate: Date, window: NflWeekWindow): number {
  const startTime = ms(window.startDate);
  const finalGameWindowTime = ms(window.finalGameWindowOpensAt);
  const currentTime = currentDate.getTime();

  if (currentTime < startTime) return 0;
  // Kickoff is not completion, and neither is it evidence of a specific count.
  // From the Monday kickoff to the week end the caller gets `null` from
  // getCurrentWeek/getWeekInfo rather than a number; this helper is only
  // consulted for the observable part of the week.
  if (currentTime >= ms(window.endDate)) return TOTAL_GAMES_PER_WEEK;
  if (currentTime >= finalGameWindowTime) return TOTAL_GAMES_PER_WEEK - 1;

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
  // No `?? 1`. Reconstructing a null target as Week 1 is the same class of
  // defect as the old clamp to Week 18: it manufactures a week number the
  // calendar refused to produce, and every consumer downstream then treats the
  // invention as detection. When there is no target, `currentWeek` is 0 — a
  // value that cannot be mistaken for a real NFL week — and `configStatus` /
  // `targetWeek` carry the real answer.
  const displayWeek = phase.regularSeasonWeek ?? phase.targetWeek ?? 0;
  const window = windowFor(displaySeason, displayWeek);
  const displayCalendar = getSeasonCalendar(displaySeason);
  // Anchor-derived weeks are cadence arithmetic; a game count derived from them
  // would be a fabricated observation, not an estimate of anything observed.
  const canEstimateGames = displayCalendar?.scheduleSource === 'explicit_schedule';

  const weekStatus: NflWeekStatus =
    phase.weekStatus ?? (window ? weekStatusAt(window, now.getTime()) : 'not_started');
  const mondayNightCompleted = window
    ? (weekStatus === 'completion_unverified' ? null : now.getTime() >= ms(window.endDate))
    : false;
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
    gamesCompleted:
      weekStatus === 'completion_unverified' || !canEstimateGames
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
    evidenceThroughSeason: phase.evidenceThroughSeason,
    evidenceThroughWeek: phase.evidenceThroughWeek,
    evidenceProvenance: phase.evidenceProvenance,
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
  const mondayNightCompleted =
    status === 'completion_unverified' ? null : now.getTime() >= ms(window.endDate);
  const phase = resolveSeasonPhase(now);
  const archiveCutoff = resolveEvidenceCutoff(calendar, now.getTime());
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
      status === 'completion_unverified' || calendar.scheduleSource !== 'explicit_schedule'
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
    // The cutoff for an EXPLICIT season is that season's own, never the live
    // current-season week. Reading the live week into a historical request is
    // how a 2024 board ended up cut off at a 2026 week number.
    evidenceThroughSeason: archiveCutoff.season,
    evidenceThroughWeek: archiveCutoff.week,
    evidenceProvenance: archiveCutoff.provenance,
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

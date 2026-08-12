import { useQuery } from '@tanstack/react-query';
import type { NflWeekStatus } from '@shared/weekDetection';

export type NflPhase = 'offseason' | 'preseason' | 'regular_season' | 'postseason';

interface WeekInfo {
  currentWeek: number;
  season: number;
  /**
   * Imported rather than re-declared. This union was written out by hand and
   * silently drifted when the server gained `completion_unverified`, so the
   * client's type claimed a state the API could actually send did not exist —
   * and any consumer narrowing on it fell through. Binding it to the server's
   * own type makes the next such addition a compile error here.
   */
  weekStatus: NflWeekStatus;
  mondayNightCompleted: boolean | null;
  weekStartDate: string;
  weekEndDate: string;
  nextWeekStartDate?: string;
  gamesCompleted: number | null;
  totalGames: number;
  /** Phase-aware target week. Null outside the regular season / when config is stale. */
  upcomingWeek: number | null;
  success: boolean;

  // Phase fields (Fantasy #307 Phase A).
  phase: NflPhase;
  phaseLabel: string;
  seasonPhaseLabel: string;
  regularSeasonWeek: number | null;
  targetSeason: number | null;
  targetWeek: number | null;
  targetLabel: string | null;
  scheduleSource: 'explicit_schedule' | 'anchor_derived' | null;
  // The target's provenance travels with it (Fantasy #307 Phase A).
  targetProvenance: 'verified_schedule' | 'anchor_derived' | null;
  targetIsProvisional: boolean;
  configStatus: 'ok' | 'stale_calendar_config';
  configNote: string | null;
  /** Absent on an older server; the hook treats that as `[]`, never a guess. */
  configuredSeasons?: number[];
}

/**
 * Rendered wherever completion cannot be asserted — which, with no per-game
 * finalization source in this build, is everywhere completion would matter.
 */
export const COMPLETION_NOT_VERIFIED_COPY = 'Completion not verified.';

export function useCurrentNFLWeek() {
  const { data, isLoading, error } = useQuery<WeekInfo>({
    queryKey: ['/api/system/current-week'],
    queryFn: async () => {
      const response = await fetch('/api/system/current-week');
      if (!response.ok) {
        throw new Error('Failed to fetch current week');
      }
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    // --- Legacy accessors -------------------------------------------------
    // Unchanged semantics (including the pre-existing year fallback) so the
    // dozen-plus existing consumers keep compiling and behaving as before.
    // #307 Phase A scope is the Rankings/current-week surface; migrating these
    // other pages onto the nullable phase fields below is deliberate follow-up.
    // `?? 0`, not `|| 1`: when the server reports that no week is resolvable
    // it now sends 0, and `|| 1` would quietly reconstruct the invented Week 1
    // this PR removes. Zero keeps the legacy number type while being
    // impossible to mistake for a real NFL week, and week=0 requests fail
    // closed server-side instead of fabricating a board.
    currentWeek: data?.currentWeek ?? 0,
    upcomingWeek: data?.upcomingWeek ?? data?.currentWeek ?? 0,
    season: data?.season || new Date().getFullYear(),
    weekStatus: data?.weekStatus || 'not_started',
    // Legacy accessor keeps its boolean shape for existing consumers, but a
    // null (completion unverified) must not be coerced into "not completed".
    mondayNightCompleted: data?.mondayNightCompleted ?? null,

    // --- Honest, phase-aware state (Fantasy #307) -------------------------
    // Null until the server actually reports it — no client-side guessing.
    //
    // A stale calendar must also yield null. `getCurrentWeek()` keeps returning
    // a number there for the legacy accessors above, but that number is the
    // *invented* next year — surfacing it as resolved phase-aware state is what
    // let /tiers send an explicit season and bypass the route's fail-closed path.
    resolvedSeason:
      data?.configStatus === 'stale_calendar_config' ? null : data?.season ?? null,
    phase: data?.phase ?? null,
    phaseLabel: data?.phaseLabel ?? null,
    seasonPhaseLabel: data?.seasonPhaseLabel ?? null,
    regularSeasonWeek: data?.regularSeasonWeek ?? null,
    targetSeason: data?.targetSeason ?? null,
    targetWeek: data?.targetWeek ?? null,
    targetLabel: data?.targetLabel ?? null,
    scheduleSource: data?.scheduleSource ?? null,
    // A provisional target may drive forward-looking requests, but only while
    // this flag travels with it and the UI does not imply completion.
    targetProvenance: data?.targetProvenance ?? null,
    targetIsProvisional: data?.targetIsProvisional ?? false,
    configStatus: data?.configStatus ?? null,
    configNote: data?.configNote ?? null,
    // The seasons a caller may explicitly select, independent of whether the
    // live calendar is stale. An older server that predates this field is
    // read as `[]` — no synthesized fallback, since a guessed season list
    // could let an unconfigured value slip into a request.
    configuredSeasons: data?.configuredSeasons ?? [],

    isLoading,
    error,
    weekInfo: data,
  };
}

import { useQuery } from '@tanstack/react-query';

export type NflPhase = 'offseason' | 'preseason' | 'regular_season' | 'postseason';

interface WeekInfo {
  currentWeek: number;
  season: number;
  weekStatus: 'not_started' | 'in_progress' | 'completion_unverified' | 'completed';
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

  // The decision-target / evidence-cutoff split (Fantasy #307 Phase A).
  targetProvenance: 'verified_schedule' | 'anchor_derived' | null;
  targetIsProvisional: boolean;
  evidenceThroughSeason: number | null;
  evidenceThroughWeek: number | null;
  evidenceProvenance:
    | 'verified_completed_week'
    | 'no_completed_week'
    | 'completion_unverified'
    | 'anchor_derived_cannot_verify_completion'
    | 'stale_calendar_config';

  configStatus: 'ok' | 'stale_calendar_config';
  configNote: string | null;
}

/** Rendered wherever completion cannot be asserted. */
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
    currentWeek: data?.currentWeek || 1,
    upcomingWeek: data?.upcomingWeek || data?.currentWeek || 1,
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

    // --- Forward target vs evidence cutoff (Fantasy #307 Phase A) ---------
    // A provisional target may drive forward-looking requests, but only while
    // `targetIsProvisional` travels with it. The evidence cutoff is separate
    // and fails closed to null, so no surface can accidentally read a
    // scheduling signal as permission to show results.
    targetProvenance: data?.targetProvenance ?? null,
    targetIsProvisional: data?.targetIsProvisional ?? false,
    evidenceThroughSeason: data?.evidenceThroughSeason ?? null,
    evidenceThroughWeek: data?.evidenceThroughWeek ?? null,
    evidenceProvenance: data?.evidenceProvenance ?? null,
    completionVerified: (data?.evidenceThroughWeek ?? null) !== null,
    // Never implies completion when it is unverified. `gamesCompleted` and
    // `mondayNightCompleted` are null in that state, so copy derived from them
    // would otherwise read as "0 games completed".
    completionCopy:
      (data?.evidenceThroughWeek ?? null) !== null
        ? `Complete through Week ${data?.evidenceThroughWeek}.`
        : COMPLETION_NOT_VERIFIED_COPY,

    configStatus: data?.configStatus ?? null,
    configNote: data?.configNote ?? null,

    isLoading,
    error,
    weekInfo: data,
  };
}

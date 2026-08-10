import { useQuery } from '@tanstack/react-query';

export type NflPhase = 'offseason' | 'preseason' | 'regular_season' | 'postseason';

interface WeekInfo {
  currentWeek: number;
  season: number;
  weekStatus: 'not_started' | 'in_progress' | 'completed';
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
  configStatus: 'ok' | 'stale_calendar_config';
  configNote: string | null;
}

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
    configStatus: data?.configStatus ?? null,
    configNote: data?.configNote ?? null,

    isLoading,
    error,
    weekInfo: data,
  };
}

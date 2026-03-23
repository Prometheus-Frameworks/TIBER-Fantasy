import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import { TeamResearchApiError, TeamResearchResponse, readTeamResearchQuery } from '@/lib/teamResearch';
import { TeamResearchWorkspaceView } from '@/components/data-lab/TeamResearchWorkspaceView';

async function fetchTeamResearch(season: string, team?: string | null): Promise<TeamResearchResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }
  if (team) {
    params.set('team', team);
  }

  const response = await fetch(`/api/data-lab/team-research?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as TeamResearchApiError;
  }

  return payload as TeamResearchResponse;
}

export default function TeamResearchLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const fallbackSeason = String(currentSeason);
  const [locationSearch, setLocationSearch] = useState(typeof window !== 'undefined' ? window.location.search : '');

  useEffect(() => {
    const handlePopState = () => setLocationSearch(window.location.search);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const queryState = useMemo(() => readTeamResearchQuery(locationSearch, fallbackSeason), [fallbackSeason, locationSearch]);

  const query = useQuery<TeamResearchResponse, TeamResearchApiError>({
    queryKey: ['/api/data-lab/team-research', queryState.season, queryState.team],
    queryFn: () => fetchTeamResearch(queryState.season, queryState.team),
    retry: false,
  });

  const availableSeasons = query.data?.data.availableSeasons?.length
    ? query.data.data.availableSeasons
    : [Number(queryState.season)].filter((value) => Number.isFinite(value));

  return (
    <TeamResearchWorkspaceView
      season={queryState.season}
      availableSeasons={availableSeasons}
      data={query.data?.data ?? null}
      isLoading={query.isLoading}
      errorMessage={query.error?.error ?? null}
      onSeasonChange={(nextSeason) => {
        const params = new URLSearchParams(locationSearch);
        params.set('season', nextSeason);
        const nextHref = params.toString() ? `/tiber-data-lab/team-research?${params.toString()}` : '/tiber-data-lab/team-research';
        window.history.pushState({}, '', nextHref);
        setLocationSearch(window.location.search);
      }}
    />
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import { PlayerResearchApiError, PlayerResearchResponse, readPlayerResearchQuery } from '@/lib/playerResearch';
import { PlayerResearchWorkspaceView } from '@/components/data-lab/PlayerResearchWorkspaceView';

async function fetchPlayerResearch(season: string, playerId?: string | null, playerName?: string | null): Promise<PlayerResearchResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }
  if (playerId) {
    params.set('playerId', playerId);
  }
  if (playerName) {
    params.set('playerName', playerName);
  }

  const response = await fetch(`/api/data-lab/player-research?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as PlayerResearchApiError;
  }

  return payload as PlayerResearchResponse;
}

export default function PlayerResearchLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const fallbackSeason = String(currentSeason);
  const [locationSearch, setLocationSearch] = useState(typeof window !== 'undefined' ? window.location.search : '');

  useEffect(() => {
    const handlePopState = () => setLocationSearch(window.location.search);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const queryState = useMemo(
    () => readPlayerResearchQuery(locationSearch, fallbackSeason),
    [fallbackSeason, locationSearch],
  );

  const query = useQuery<PlayerResearchResponse, PlayerResearchApiError>({
    queryKey: ['/api/data-lab/player-research', queryState.season, queryState.playerId, queryState.playerName],
    queryFn: () => fetchPlayerResearch(queryState.season, queryState.playerId, queryState.playerName),
    retry: false,
  });

  const availableSeasons = query.data?.data.availableSeasons?.length
    ? query.data.data.availableSeasons
    : [Number(queryState.season)].filter((value) => Number.isFinite(value));

  return (
    <PlayerResearchWorkspaceView
      season={queryState.season}
      availableSeasons={availableSeasons}
      data={query.data?.data ?? null}
      isLoading={query.isLoading}
      errorMessage={query.error?.error ?? null}
      onSeasonChange={(nextSeason) => {
        const params = new URLSearchParams(locationSearch);
        params.set('season', nextSeason);
        const nextQuery = params.toString();
        const nextHref = nextQuery ? `/tiber-data-lab/player-research?${nextQuery}` : '/tiber-data-lab/player-research';
        window.history.pushState({}, '', nextHref);
        setLocationSearch(window.location.search);
      }}
    />
  );
}

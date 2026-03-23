import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import {
  DataLabCommandCenterApiError,
  DataLabCommandCenterResponse,
  buildDataLabCommandCenterHref,
  readDataLabCommandCenterQuery,
} from '@/lib/dataLabCommandCenter';
import { DataLabCommandCenterView } from '@/components/data-lab/DataLabCommandCenterView';

async function fetchDataLabCommandCenter(season: string): Promise<DataLabCommandCenterResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }

  const response = await fetch(`/api/data-lab/command-center?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as DataLabCommandCenterApiError;
  }

  return payload as DataLabCommandCenterResponse;
}

export default function DataLabCommandCenterLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const fallbackSeason = String(currentSeason);
  const [locationSearch, setLocationSearch] = useState(typeof window !== 'undefined' ? window.location.search : '');

  useEffect(() => {
    const handlePopState = () => setLocationSearch(window.location.search);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const queryState = useMemo(() => readDataLabCommandCenterQuery(locationSearch, fallbackSeason), [fallbackSeason, locationSearch]);

  const query = useQuery<DataLabCommandCenterResponse, DataLabCommandCenterApiError>({
    queryKey: ['/api/data-lab/command-center', queryState.season],
    queryFn: () => fetchDataLabCommandCenter(queryState.season),
    retry: false,
  });

  const availableSeasons = query.data?.data.availableSeasons?.length
    ? query.data.data.availableSeasons
    : [Number(queryState.season)].filter((value) => Number.isFinite(value));

  return (
    <DataLabCommandCenterView
      season={queryState.season}
      availableSeasons={availableSeasons}
      data={query.data?.data ?? null}
      isLoading={query.isLoading}
      errorMessage={query.error?.error ?? null}
      onSeasonChange={(nextSeason) => {
        const href = buildDataLabCommandCenterHref({ season: nextSeason });
        window.history.pushState({}, '', href);
        setLocationSearch(window.location.search);
      }}
    />
  );
}

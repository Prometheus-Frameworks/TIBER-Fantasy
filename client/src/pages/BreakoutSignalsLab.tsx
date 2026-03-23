import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import {
  BreakoutSignalsApiError,
  BreakoutSignalsResponse,
  getBreakoutSignalsErrorMessage,
} from '@/lib/breakoutSignals';
import { BreakoutSignalsView } from '@/components/data-lab/BreakoutSignalsView';

async function fetchBreakoutSignals(season?: string): Promise<BreakoutSignalsResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }

  const response = await fetch(`/api/data-lab/breakout-signals${params.size ? `?${params.toString()}` : ''}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as BreakoutSignalsApiError;
  }

  return payload as BreakoutSignalsResponse;
}

export default function BreakoutSignalsLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const [season, setSeason] = useState<string>('');

  const query = useQuery<BreakoutSignalsResponse, BreakoutSignalsApiError>({
    queryKey: ['/api/data-lab/breakout-signals', season],
    queryFn: () => fetchBreakoutSignals(season || undefined),
    retry: false,
  });

  const effectiveSeason = useMemo(() => {
    if (query.data?.data.season) {
      return String(query.data.data.season);
    }

    return season || String(currentSeason);
  }, [currentSeason, query.data?.data.season, season]);

  const availableSeasons = query.data?.data.availableSeasons?.length
    ? query.data.data.availableSeasons
    : [Number(effectiveSeason)].filter((value) => Number.isFinite(value));

  return (
    <BreakoutSignalsView
      season={effectiveSeason}
      availableSeasons={availableSeasons}
      rows={query.data?.data.rows ?? []}
      bestRecipeSummary={query.data?.data.bestRecipeSummary ?? null}
      isLoading={query.isLoading}
      errorMessage={query.error ? getBreakoutSignalsErrorMessage(query.error) : null}
      errorCode={query.error?.code ?? null}
      onSeasonChange={setSeason}
    />
  );
}

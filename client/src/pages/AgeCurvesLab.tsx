import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import { readDataLabPlayerCarryParams } from '@/lib/dataLabPromotedModules';
import { AgeCurveLabApiError, AgeCurveLabResponse, getAgeCurveLabErrorMessage } from '@/lib/ageCurves';
import { AgeCurvesView } from '@/components/data-lab/AgeCurvesView';

async function fetchAgeCurvesLab(season?: string): Promise<AgeCurveLabResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }

  const response = await fetch(`/api/data-lab/age-curves${params.size ? `?${params.toString()}` : ''}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as AgeCurveLabApiError;
  }

  return payload as AgeCurveLabResponse;
}

export default function AgeCurvesLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const initialPlayerContext = useMemo(
    () => readDataLabPlayerCarryParams(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );
  const [season, setSeason] = useState(initialPlayerContext.season ?? '');

  const query = useQuery<AgeCurveLabResponse, AgeCurveLabApiError>({
    queryKey: ['/api/data-lab/age-curves', season],
    queryFn: () => fetchAgeCurvesLab(season || undefined),
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
    <AgeCurvesView
      season={effectiveSeason}
      availableSeasons={availableSeasons}
      rows={query.data?.data.rows ?? []}
      isLoading={query.isLoading}
      error={query.error ? { ...query.error, error: getAgeCurveLabErrorMessage(query.error) } : null}
      sourceProvider={query.data?.data.source.provider ?? null}
      sourceMode={query.data?.data.source.mode ?? null}
      sourceLocation={query.data?.data.source.location ?? query.error?.operator?.configuredSource ?? null}
      defaultExpandedPlayerKey={initialPlayerContext.playerId ?? null}
      initialPlayerContext={initialPlayerContext}
      onSeasonChange={setSeason}
    />
  );
}

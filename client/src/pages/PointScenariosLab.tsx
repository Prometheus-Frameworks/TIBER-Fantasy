import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import { readDataLabPlayerCarryParams } from '@/lib/dataLabPromotedModules';
import {
  PointScenarioLabApiError,
  PointScenarioLabResponse,
  buildPointScenarioRowKey,
  getPointScenarioLabErrorMessage,
} from '@/lib/pointScenarios';
import { PointScenariosView } from '@/components/data-lab/PointScenariosView';

async function fetchPointScenarioLab(season?: string): Promise<PointScenarioLabResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }

  const response = await fetch(`/api/data-lab/point-scenarios${params.size ? `?${params.toString()}` : ''}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as PointScenarioLabApiError;
  }

  return payload as PointScenarioLabResponse;
}

export default function PointScenariosLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const [season, setSeason] = useState('');
  const initialPlayerContext = useMemo(
    () => readDataLabPlayerCarryParams(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );

  const query = useQuery<PointScenarioLabResponse, PointScenarioLabApiError>({
    queryKey: ['/api/data-lab/point-scenarios', season],
    queryFn: () => fetchPointScenarioLab(season || undefined),
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

  const defaultSelectedScenarioKey = useMemo(() => {
    if (!initialPlayerContext.playerId && !initialPlayerContext.playerName) {
      return null;
    }

    const match = (query.data?.data.rows ?? []).find((row) =>
      initialPlayerContext.playerId
        ? row.playerId === initialPlayerContext.playerId
        : row.playerName.toLowerCase() === (initialPlayerContext.playerName ?? '').toLowerCase(),
    );

    return match ? buildPointScenarioRowKey(match) : null;
  }, [initialPlayerContext.playerId, initialPlayerContext.playerName, query.data?.data.rows]);

  return (
    <PointScenariosView
      season={effectiveSeason}
      availableSeasons={availableSeasons}
      rows={query.data?.data.rows ?? []}
      isLoading={query.isLoading}
      error={query.error ? { ...query.error, error: getPointScenarioLabErrorMessage(query.error) } : null}
      sourceProvider={query.data?.data.source.provider ?? null}
      sourceMode={query.data?.data.source.mode ?? null}
      defaultSelectedScenarioKey={defaultSelectedScenarioKey}
      initialPlayerContext={initialPlayerContext}
      onSeasonChange={setSeason}
    />
  );
}

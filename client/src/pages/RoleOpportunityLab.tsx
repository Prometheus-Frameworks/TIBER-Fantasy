import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import { readDataLabPlayerCarryParams } from '@/lib/dataLabPromotedModules';
import {
  RoleOpportunityLabApiError,
  RoleOpportunityLabResponse,
  getRoleOpportunityLabErrorMessage,
} from '@/lib/roleOpportunity';
import { RoleOpportunityView } from '@/components/data-lab/RoleOpportunityView';

async function fetchRoleOpportunityLab(season?: string): Promise<RoleOpportunityLabResponse> {
  const params = new URLSearchParams();
  if (season) {
    params.set('season', season);
  }

  const response = await fetch(`/api/data-lab/role-opportunity${params.size ? `?${params.toString()}` : ''}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload as RoleOpportunityLabApiError;
  }

  return payload as RoleOpportunityLabResponse;
}

export default function RoleOpportunityLab() {
  const { season: currentSeason } = useCurrentNFLWeek();
  const [season, setSeason] = useState('');
  const initialPlayerContext = useMemo(
    () => readDataLabPlayerCarryParams(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );

  const query = useQuery<RoleOpportunityLabResponse, RoleOpportunityLabApiError>({
    queryKey: ['/api/data-lab/role-opportunity', season],
    queryFn: () => fetchRoleOpportunityLab(season || undefined),
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

  const scopeLabel = query.data?.data.week != null
    ? `Week ${query.data.data.week}`
    : (query.data?.data.seasonScopeMarker ?? 'Season scope');

  return (
    <RoleOpportunityView
      season={effectiveSeason}
      availableSeasons={availableSeasons}
      rows={query.data?.data.rows ?? []}
      isLoading={query.isLoading}
      error={query.error ? { ...query.error, error: getRoleOpportunityLabErrorMessage(query.error) } : null}
      sourceProvider={query.data?.data.source.provider ?? null}
      sourceMode={query.data?.data.source.mode ?? null}
      scopeLabel={scopeLabel}
      defaultExpandedPlayerId={initialPlayerContext.playerId ?? null}
      initialPlayerContext={initialPlayerContext}
      onSeasonChange={setSeason}
    />
  );
}

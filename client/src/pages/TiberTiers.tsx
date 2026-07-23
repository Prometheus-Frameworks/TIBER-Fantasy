import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Crown, Info, RefreshCw, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';
import { CoreResearchQuickLinks } from '@/components/data-lab/CoreResearchQuickLinks';
import {
  Position,
  RankingsV2Item,
  resolveRankingsSourceView,
  resolveTiersHeadline,
  resolveTiersViewState,
  validateRankingsV2WeeklyResponse,
  TIERS_GENERIC_ERROR_MESSAGE,
  TIERS_LOADING_LABEL,
} from './tiberTiersV2Mapper';

type SortDirection = 'asc' | 'desc';

export interface TiersApiResponse {
  asOf: string;
  sourceStack: Array<{ layer?: string | null; asOf?: string | null }>;
  trust?: {
    sampleNote?: string | null;
    stabilityNote?: string | null;
  } | null;
  items: RankingsV2Item[];
}

function tierClass(tier: string) {
  const cls: Record<string, string> = {
    T1: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/60',
    T2: 'bg-teal-900/50 text-teal-300 border-teal-700/60',
    T3: 'bg-amber-900/50 text-amber-300 border-amber-700/60',
    T4: 'bg-orange-900/50 text-orange-300 border-orange-700/60',
    T5: 'bg-red-900/50 text-red-300 border-red-700/60',
  };
  return cls[tier] ?? 'bg-slate-800 text-slate-300 border-slate-700';
}

function TrajectoryIcon({ trajectory }: { trajectory?: string | null }) {
  if (trajectory === 'rising') return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trajectory === 'declining') return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-slate-500" />;
}

export interface TiberTiersViewProps {
  season: number;
  asOfWeek: number;
  position: Position;
  onPositionChange: (position: Position) => void;
  sortDirection: SortDirection;
  onToggleSortDirection: () => void;
  data: TiersApiResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRefetch: () => void;
}

// The presentational half of /tiers: all rendering/state-resolution logic lives here so it
// can be exercised directly in tests without a live network request, QueryClient, or router —
// TiberTiers (below) owns only the data fetching and wires its result into this component.
export function TiberTiersView({
  season,
  asOfWeek,
  position,
  onPositionChange,
  sortDirection,
  onToggleSortDirection,
  data,
  isLoading,
  isError,
  isFetching,
  onRefetch,
}: TiberTiersViewProps) {
  const players = useMemo(() => {
    const list = [...(data?.items ?? [])];
    list.sort((a, b) => {
      const left = a.score ?? 0;
      const right = b.score ?? 0;
      return sortDirection === 'desc' ? right - left : left - right;
    });
    return list;
  }, [data?.items, sortDirection]);

  const getPillarNote = (item: RankingsV2Item, pillar: string) =>
    item.explanation.pillarNotes.find((note) => note.pillar === pillar)?.note ?? null;

  const isCacheUncomputed = data?.trust?.stabilityNote === 'forge_cache_empty_uncomputed';
  const sourceView = resolveRankingsSourceView(data?.sourceStack);
  const viewState = resolveTiersViewState({ isLoading, isError, isCacheUncomputed, playersCount: players.length });
  const showMetaLine = viewState === 'data' || viewState === 'empty';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#0a0e1a] text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Crown className="h-8 w-8 text-purple-400" />
                Tiber Tiers
              </h1>
              <p className="text-slate-400 mt-1 text-sm md:text-base">
                {resolveTiersHeadline(sourceView.layer)} ({season}, through week {asOfWeek}).
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onRefetch}
              disabled={isFetching}
              className="border-slate-700 bg-slate-900/60"
              data-testid="refresh-tiers"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(['WR', 'RB', 'TE', 'QB'] as Position[]).map((pos) => (
              <button
                key={pos}
                onClick={() => onPositionChange(pos)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  position === pos ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                data-testid={`position-${pos.toLowerCase()}`}
              >
                {pos}
              </button>
            ))}

            <button
              onClick={onToggleSortDirection}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 text-slate-300 border border-slate-700"
              data-testid="toggle-sort-alpha"
            >
              {sourceView.expectedLabel} {sortDirection === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          {showMetaLine && (
            <div className="text-xs text-slate-400 flex items-center gap-2 mb-4">
              <Info className="h-3.5 w-3.5" />
              <span>{players.length} players</span>
              {data?.asOf && <span>• as of {new Date(data.asOf).toLocaleString()}</span>}
              <span>• Source: {sourceView.sourceNote}</span>
            </div>
          )}

          <div className="bg-[#141824] border border-gray-800 rounded-xl overflow-hidden">
            {viewState === 'loading' ? (
              <div className="p-10 text-center text-slate-400">{TIERS_LOADING_LABEL}</div>
            ) : viewState === 'error' ? (
              <div className="p-10 text-center">
                <div className="flex items-center justify-center gap-2 text-lg font-semibold text-red-400 mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  Unable to load rankings
                </div>
                <p className="text-slate-400 text-sm">{TIERS_GENERIC_ERROR_MESSAGE}</p>
                <Button
                  variant="outline"
                  onClick={onRefetch}
                  className="mt-4 border-slate-700 bg-slate-900/60"
                  data-testid="retry-tiers"
                >
                  Retry
                </Button>
              </div>
            ) : viewState === 'unavailable' ? (
              <div className="p-10 text-center">
                <div className="text-lg font-semibold text-amber-300 mb-2">Rankings are not available yet</div>
                {/* Public, read-only copy only — no operator/admin mutation instructions here. */}
                <p className="text-slate-400 text-sm">FORGE grades for this filter have not been computed yet. Please check back shortly.</p>
              </div>
            ) : viewState === 'empty' ? (
              <div className="p-10 text-center text-slate-400">No players match this filter yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]" data-testid="tiers-table">
                  <thead className="bg-[#0a0e1a] text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-3 text-center">#</th>
                      <th className="py-3 px-3 text-left">Player</th>
                      <th className="py-3 px-3 text-center">Team</th>
                      <th className="py-3 px-3 text-center">Pos</th>
                      <th className="py-3 px-3 text-center">{sourceView.expectedLabel}</th>
                      <th className="py-3 px-3 text-center">{sourceView.valueLabel}</th>
                      <th className="py-3 px-3 text-center">Floor</th>
                      <th className="py-3 px-3 text-center">Ceiling</th>
                      <th className="py-3 px-3 text-center">Confidence Band</th>
                      <th className="py-3 px-3 text-left">Weekly Outlook</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, idx) => {
                      const confidenceBand = player.tier ?? getPillarNote(player, 'confidence_band');
                      const floor = getPillarNote(player, 'floor');
                      const ceiling = getPillarNote(player, 'ceiling');
                      return (
                        <tr key={player.playerId} className="border-t border-gray-800 hover:bg-slate-900/25">
                          <td className="py-3 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Link href={`/player/${player.playerId}`} className="text-white hover:text-purple-400 text-sm font-medium">
                                {player.playerName}
                              </Link>
                              <TrajectoryIcon trajectory={player.uiMeta?.trajectory} />
                            </div>
                            <CoreResearchQuickLinks
                              season={String(season)}
                              playerId={player.playerId}
                              playerName={player.playerName}
                              team={player.team ?? null}
                              compact
                              className="mt-2"
                            />
                          </td>
                          <td className="py-3 px-3 text-center text-slate-300">{player.team ?? 'FA'}</td>
                          <td className="py-3 px-3 text-center text-slate-300">{player.position ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-100">{player.score?.toFixed(1) ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-100">{player.value?.toFixed(1) ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-300">{floor ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono text-slate-300">{ceiling ?? '-'}</td>
                          <td className="py-3 px-3 text-center">
                            {confidenceBand ? <Badge className={`${tierClass(confidenceBand)} border`}>{confidenceBand}</Badge> : <span className="text-slate-600">-</span>}
                          </td>
                          <td className="py-3 px-3 text-left text-xs text-slate-300">{player.explanation.placementSummary ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default function TiberTiers() {
  // Rankings surface status: CANONICAL (current public rankings UI).
  // Rankings v2 migration note: future public ranking payloads should align to
  // server/contracts/rankingsV2.ts through /api/rankings/v2/weekly.
  const [position, setPosition] = useState<Position>('WR');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { currentWeek, season } = useCurrentNFLWeek();
  const asOfWeek = currentWeek || 17;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<TiersApiResponse>({
    queryKey: ['/api/rankings/v2/weekly', season, position, asOfWeek],
    queryFn: async () => {
      const url = `/api/rankings/v2/weekly?season=${season}&position=${position}&asOfWeek=${asOfWeek}&limit=75`;
      const res = await fetch(url);
      if (!res.ok) {
        // Malformed/failed upstream responses must surface as a genuine error, not
        // silently resolve into an empty rankings list that renders as "no players".
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to fetch weekly rankings (HTTP ${res.status}).`);
      }
      // A 2xx status does not guarantee a well-formed body — validate before handing it
      // to the UI, so a malformed successful response also throws into the error state
      // instead of silently rendering as a genuine empty ranking.
      return validateRankingsV2WeeklyResponse(await res.json()) as unknown as TiersApiResponse;
    },
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    // The technical failure detail is for developers, not end users — log it here instead
    // of rendering it, so the UI's error copy stays generic while debugging stays possible.
    if (isError) console.error('[TiberTiers] weekly rankings request failed:', error);
  }, [isError, error]);

  return (
    <TiberTiersView
      season={season}
      asOfWeek={asOfWeek}
      position={position}
      onPositionChange={setPosition}
      sortDirection={sortDirection}
      onToggleSortDirection={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
      data={data}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      onRefetch={() => refetch()}
    />
  );
}

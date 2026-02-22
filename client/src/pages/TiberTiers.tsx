import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Crown, Info, RefreshCw, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';

type Position = 'QB' | 'RB' | 'WR' | 'TE';
type SortDirection = 'asc' | 'desc';

interface TiersApiPlayer {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string | null;
  rank: number;
  alpha: number;
  rawAlpha?: number | null;
  tier: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  tierNumeric: number;
  subscores: {
    volume?: number | null;
    efficiency?: number | null;
    teamContext?: number | null;
    stability?: number | null;
    dynastyContext?: number | null;
  };
  trajectory?: 'rising' | 'flat' | 'declining' | null;
  confidence?: number | null;
  gamesPlayed?: number | null;
  footballLensIssues?: string[] | null;
  lensAdjustment?: number | null;
  productionStats?: {
    targets?: number | null;
    touches?: number | null;
  };
}

interface TiersApiResponse {
  season: number;
  asOfWeek: number;
  position: Position | 'ALL';
  computedAt?: string;
  version?: string;
  count: number;
  fallback?: boolean;
  message?: string;
  players: TiersApiPlayer[];
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

export default function TiberTiers() {
  const [position, setPosition] = useState<Position>('WR');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { currentWeek } = useCurrentNFLWeek();

  const season = 2025;
  const asOfWeek = currentWeek || 17;

  const { data, isLoading, refetch, isFetching } = useQuery<TiersApiResponse>({
    queryKey: ['/api/forge/tiers', season, position, asOfWeek],
    queryFn: async () => {
      const url = `/api/forge/tiers?season=${season}&position=${position}&asOfWeek=${asOfWeek}&limit=75`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch FORGE tiers cache');
      return res.json();
    },
    staleTime: 60_000,
  });

  const players = useMemo(() => {
    const list = [...(data?.players ?? [])];
    list.sort((a, b) => (sortDirection === 'desc' ? b.alpha - a.alpha : a.alpha - b.alpha));
    return list;
  }, [data?.players, sortDirection]);

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
                Canonical FORGE Alpha ranks ({season}, through week {asOfWeek}).
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
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
                onClick={() => setPosition(pos)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  position === pos ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                data-testid={`position-${pos.toLowerCase()}`}
              >
                {pos}
              </button>
            ))}

            <button
              onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-slate-300 border border-slate-700"
              data-testid="toggle-sort-alpha"
            >
              Alpha {sortDirection === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2 mb-4">
            <Info className="h-3.5 w-3.5" />
            <span>{players.length} players</span>
            {data?.computedAt && <span>• computed {new Date(data.computedAt).toLocaleString()}</span>}
            {data?.version && <span>• {data.version}</span>}
          </div>

          <div className="bg-[#141824] border border-gray-800 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center text-slate-400">Loading FORGE tiers...</div>
            ) : data?.fallback ? (
              <div className="p-10 text-center">
                <div className="text-lg font-semibold text-amber-300 mb-2">FORGE grades are being computed...</div>
                <p className="text-slate-400 text-sm">{data.message ?? 'Please run POST /api/forge/compute-grades and refresh this page.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px]" data-testid="tiers-table">
                  <thead className="bg-[#0a0e1a] text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-3 text-center">#</th>
                      <th className="py-3 px-3 text-left">Player</th>
                      <th className="py-3 px-3 text-center">Tier</th>
                      <th className="py-3 px-3 text-center">Alpha</th>
                      <th className="py-3 px-3 text-center">Pillars (V / E / C / S)</th>
                      <th className="py-3 px-3 text-center">Vol</th>
                      <th className="py-3 px-3 text-center">Confidence</th>
                      <th className="py-3 px-3 text-center">Issues</th>
                      <th className="py-3 px-3 text-center">GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, idx) => {
                      const vol = player.position === 'RB' ? player.productionStats?.touches : player.productionStats?.targets;
                      return (
                        <tr key={player.playerId} className="border-t border-gray-800 hover:bg-slate-900/25">
                          <td className="py-3 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Link href={`/player/${player.playerId}`} className="text-white hover:text-purple-400 text-sm font-medium">
                                {player.playerName}
                              </Link>
                              <span className="text-xs text-slate-500">{player.nflTeam || 'FA'}</span>
                              <TrajectoryIcon trajectory={player.trajectory} />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge className={`${tierClass(player.tier)} border`}>{player.tier}</Badge>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold" title="Alpha Score">{player.alpha.toFixed(1)}</td>
                          <td className="py-3 px-3 text-center text-xs font-mono text-slate-300" title="Volume / Efficiency / Team Context / Stability">
                            {(player.subscores.volume ?? 0).toFixed(0)} / {(player.subscores.efficiency ?? 0).toFixed(0)} / {(player.subscores.teamContext ?? 0).toFixed(0)} / {(player.subscores.stability ?? 0).toFixed(0)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-blue-300" title={player.position === 'RB' ? 'Total Touches' : 'Total Targets'}>{vol ?? '-'}</td>
                          <td className="py-3 px-3 text-center font-mono" title="Confidence Score">{player.confidence?.toFixed(0) ?? '-'}</td>
                          <td className="py-3 px-3 text-center" title="Football Lens Issues">
                            {player.footballLensIssues?.length ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-900/50 border border-amber-700/60 text-amber-300 text-xs">
                                    <AlertTriangle className="h-3 w-3" />
                                    {player.footballLensIssues.length}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm bg-slate-800 border-slate-700">
                                  <div className="text-xs space-y-1">
                                    {player.footballLensIssues.map((issue) => (
                                      <div key={`${player.playerId}-${issue}`} className="text-slate-200">{issue}</div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400" title="Games Played">{player.gamesPlayed ?? '-'}</td>
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

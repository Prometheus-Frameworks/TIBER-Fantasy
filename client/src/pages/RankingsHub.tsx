import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Home, TrendingUp, ArrowUpDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Position = 'WR' | 'RB' | 'TE' | 'QB';

interface ForgePlayer {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string;
  alpha: number;
  alphaBase?: number;
  rawAlpha?: number;
  confidence?: number;
  trajectory?: 'rising' | 'flat' | 'declining';
  gamesPlayed: number;
  sosRos?: number;
  sosNext3?: number;
  sosPlayoffs?: number;
  sosMultiplier?: number;
  subScores?: {
    volume: number;
    efficiency: number;
    roleLeverage: number;
    stability: number;
    contextFit: number;
  };
}

interface ForgeBatchResponse {
  success: boolean;
  scores: ForgePlayer[];
  meta: {
    position: string;
    limit: number;
    season: number;
    week: number;
    count: number;
  };
}

function getAlphaColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-emerald-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function getAlphaBg(score: number): string {
  if (score >= 80) return 'bg-green-500/10';
  if (score >= 60) return 'bg-emerald-500/10';
  if (score >= 40) return 'bg-yellow-500/10';
  if (score >= 20) return 'bg-orange-500/10';
  return 'bg-red-500/10';
}

function getSosBadge(multiplier: number | undefined): { label: string; color: string; bg: string } {
  if (multiplier == null) return { label: '—', color: 'text-slate-500', bg: 'bg-slate-700/30' };
  if (multiplier >= 1.06) return { label: '++', color: 'text-green-400', bg: 'bg-green-900/40' };
  if (multiplier >= 1.03) return { label: '+', color: 'text-emerald-400', bg: 'bg-emerald-900/30' };
  if (multiplier >= 0.98) return { label: '=', color: 'text-slate-400', bg: 'bg-slate-700/50' };
  if (multiplier >= 0.95) return { label: '-', color: 'text-orange-400', bg: 'bg-orange-900/30' };
  return { label: '--', color: 'text-red-400', bg: 'bg-red-900/40' };
}

function getTrajectoryIcon(trajectory?: string): string {
  if (trajectory === 'rising') return '↗';
  if (trajectory === 'declining') return '↘';
  return '→';
}

function getTrajectoryColor(trajectory?: string): string {
  if (trajectory === 'rising') return 'text-green-400';
  if (trajectory === 'declining') return 'text-red-400';
  return 'text-slate-400';
}

type SortField = 'alpha' | 'playerName' | 'team' | 'sosRos';
type SortOrder = 'asc' | 'desc';

export default function RankingsHub() {
  const [position, setPosition] = useState<Position>('WR');
  const [sortField, setSortField] = useState<SortField>('alpha');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { data, isLoading, error, refetch } = useQuery<ForgeBatchResponse>({
    queryKey: ['/api/forge/batch', position],
    queryFn: async () => {
      const res = await fetch(`/api/forge/batch?position=${position}&limit=100&season=2025&week=17`);
      if (!res.ok) throw new Error('Failed to fetch rankings');
      return res.json();
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedPlayers = [...(data?.scores || [])].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;
    
    switch (sortField) {
      case 'alpha':
        aVal = a.alpha ?? 0;
        bVal = b.alpha ?? 0;
        break;
      case 'playerName':
        aVal = a.playerName.toLowerCase();
        bVal = b.playerName.toLowerCase();
        break;
      case 'team':
        aVal = a.nflTeam ?? '';
        bVal = b.nflTeam ?? '';
        break;
      case 'sosRos':
        aVal = a.sosRos ?? 0;
        bVal = b.sosRos ?? 0;
        break;
      default:
        aVal = a.alpha ?? 0;
        bVal = b.alpha ?? 0;
    }
    
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
    }
    return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th 
      className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Header */}
      <header className="bg-[#141824] border-b border-gray-800 px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white px-2 sm:px-3" data-testid="link-home">
                <Home className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">TIBER</span>
              </Button>
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
              <h1 className="text-base sm:text-xl font-bold">FORGE Rankings</h1>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
            className="border-gray-700 text-gray-300 hover:text-white px-2 sm:px-3"
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Position Tabs */}
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6">
          {(['WR', 'RB', 'TE', 'QB'] as Position[]).map((pos) => (
            <button
              key={pos}
              data-testid={`tab-${pos.toLowerCase()}`}
              onClick={() => setPosition(pos)}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-semibold transition-all ${
                position === pos
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#141824] text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Info Banner - Hidden on mobile, shown on sm+ */}
        <div className="hidden sm:block bg-blue-900/20 border border-blue-700/30 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm text-blue-300">
            <strong>FORGE Alpha (0-100)</strong>: Unified player score combining volume, efficiency, role leverage, stability, and context. 
            SoS adjustment applies a 0.90-1.10 multiplier based on remaining schedule difficulty.
          </p>
        </div>

        {/* Table */}
        {error ? (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">Failed to load rankings: {error.message}</p>
          </div>
        ) : (
          <div className="bg-[#141824] border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="rankings-table">
                <thead className="bg-[#0a0e1a]">
                  <tr>
                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider w-8 sm:w-12">
                      #
                    </th>
                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('playerName')}>
                      <div className="flex items-center gap-1">
                        Player
                        {sortField === 'playerName' && <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="hidden sm:table-cell px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('team')}>
                      <div className="flex items-center gap-1">
                        Team
                        {sortField === 'team' && <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('alpha')}>
                      <div className="flex items-center gap-1">
                        Alpha
                        {sortField === 'alpha' && <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="hidden md:table-cell px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Trend
                    </th>
                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('sosRos')}>
                      <div className="flex items-center gap-1">
                        SoS
                        {sortField === 'sosRos' && <span className="text-blue-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="hidden md:table-cell px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      GP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {isLoading ? (
                    [...Array(10)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-2 sm:px-3 py-2 sm:py-4"><div className="h-4 bg-slate-700 rounded w-4 sm:w-6"></div></td>
                        <td className="px-2 sm:px-3 py-2 sm:py-4"><div className="h-4 bg-slate-700 rounded w-20 sm:w-32"></div></td>
                        <td className="hidden sm:table-cell px-2 sm:px-3 py-2 sm:py-4"><div className="h-4 bg-slate-700 rounded w-10"></div></td>
                        <td className="px-2 sm:px-3 py-2 sm:py-4"><div className="h-4 bg-slate-700 rounded w-10 sm:w-12"></div></td>
                        <td className="hidden md:table-cell px-2 sm:px-3 py-2 sm:py-4"><div className="h-4 bg-slate-700 rounded w-8"></div></td>
                        <td className="px-2 sm:px-3 py-2 sm:py-4"><div className="h-4 bg-slate-700 rounded w-6 sm:w-8"></div></td>
                        <td className="hidden md:table-cell px-2 sm:px-3 py-2 sm:py-4"><div className="h-4 bg-slate-700 rounded w-6"></div></td>
                      </tr>
                    ))
                  ) : (
                    sortedPlayers.map((player, idx) => {
                      const sosBadge = getSosBadge(player.sosMultiplier);
                      return (
                        <tr 
                          key={player.playerId} 
                          className="hover:bg-slate-800/50 transition-colors"
                          data-testid={`row-${player.playerId}`}
                        >
                          <td className="px-2 sm:px-3 py-2 sm:py-3 text-slate-500 font-mono text-xs sm:text-sm">
                            {idx + 1}
                          </td>
                          <td className="px-2 sm:px-3 py-2 sm:py-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                              <span className="font-medium text-white text-sm sm:text-base">{player.playerName}</span>
                              <span className="sm:hidden text-[10px] text-slate-500">{player.nflTeam || '—'}</span>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-2 sm:px-3 py-2 sm:py-3">
                            <span className="text-slate-400 text-sm">{player.nflTeam || '—'}</span>
                          </td>
                          <td className="px-2 sm:px-3 py-2 sm:py-3">
                            <Tooltip>
                              <TooltipTrigger>
                                <span className={`font-bold font-mono text-sm sm:text-lg ${getAlphaColor(player.alpha)} ${getAlphaBg(player.alpha)} px-1.5 sm:px-2 py-0.5 rounded`}>
                                  {player.alpha.toFixed(1)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-800 border-slate-600">
                                <div className="text-xs space-y-1">
                                  <div>Base: {player.alphaBase?.toFixed(1) ?? '—'}</div>
                                  <div>Raw: {player.rawAlpha?.toFixed(1) ?? '—'}</div>
                                  <div>Confidence: {player.confidence ?? '—'}%</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="hidden md:table-cell px-2 sm:px-3 py-2 sm:py-3">
                            <span className={`text-lg ${getTrajectoryColor(player.trajectory)}`}>
                              {getTrajectoryIcon(player.trajectory)}
                            </span>
                          </td>
                          <td className="px-2 sm:px-3 py-2 sm:py-3">
                            {player.sosRos != null ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded ${sosBadge.bg} ${sosBadge.color}`}>
                                    {sosBadge.label}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-800 border-slate-600">
                                  <div className="text-xs space-y-1">
                                    <div className="font-semibold">Schedule Difficulty</div>
                                    <div>RoS: {player.sosRos?.toFixed(1)}</div>
                                    <div>Next 3: {player.sosNext3?.toFixed(1) ?? '—'}</div>
                                    <div>Playoffs: {player.sosPlayoffs?.toFixed(1) ?? '—'}</div>
                                    <div>Multiplier: {player.sosMultiplier?.toFixed(3)}</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="hidden md:table-cell px-2 sm:px-3 py-2 sm:py-3 text-slate-400 text-sm">
                            {player.gamesPlayed}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend - Simplified on mobile */}
        <div className="mt-4 sm:mt-6 bg-[#141824] border border-gray-800 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-wrap gap-3 sm:gap-6 text-[10px] sm:text-xs text-slate-400">
            <div className="flex gap-2 sm:gap-4">
              <span><span className="text-green-400 font-bold">80+</span> Elite</span>
              <span><span className="text-emerald-400 font-bold">60+</span> Strong</span>
              <span><span className="text-yellow-400 font-bold">40+</span> Avg</span>
            </div>
            <div className="hidden sm:block border-l border-slate-600 pl-4">
              SoS: <span className="text-green-400 font-bold">++</span>/<span className="text-emerald-400 font-bold">+</span> Easy |
              <span className="text-slate-400 font-bold ml-1">=</span> Neutral |
              <span className="text-orange-400 font-bold ml-1">-</span>/<span className="text-red-400 font-bold">--</span> Hard
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'wouter';
import { fetchForgeBatch } from '../api/forge';
import type { ForgeScore } from '../types/forge';

interface WRSandboxPlayer {
  playerId: string;
  canonicalId: string;
  playerName: string;
  team: string;
  gamesPlayed: number;
  targets: number;
  fantasyPoints: number;
  pointsPerTarget: number;
  samplePenalty: number;
  adjustedEfficiency: number;
  volumeIndex: number;
  productionIndex: number;
  efficiencyIndex: number;
  stabilityIndex: number;
  alphaScore: number;
  injuryStatus: string | null;
  injuryType: string | null;
  roleScore: number | null;
  roleTier: string | null;
  weightedTargetsPerGame: number | null;
  boomRate: number | null;
  bustRate: number | null;
}

interface SandboxResponse {
  success: boolean;
  players: WRSandboxPlayer[];
  season: number;
  count: number;
}

interface WRRow extends WRSandboxPlayer {
  forgeAlpha?: number;
  forgeConfidence?: number;
  forgeTrajectory?: string;
}

type SortField = 'playerName' | 'team' | 'alphaScore' | 'targets' | 'fantasyPoints' | 'gamesPlayed';
type SortOrder = 'asc' | 'desc';

export default function WRRankings() {
  const [sortField, setSortField] = useState<SortField>('alphaScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [minDisagreement, setMinDisagreement] = useState<number>(10);
  const [onlyDisagreements, setOnlyDisagreements] = useState<boolean>(false);
  
  const [forgeByPlayerId, setForgeByPlayerId] = useState<Record<string, ForgeScore>>({});
  const [forgeLoading, setForgeLoading] = useState(false);
  const [forgeError, setForgeError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<SandboxResponse>({
    queryKey: ['/api/admin/wr-rankings-sandbox', { season: 2025 }],
    queryFn: () => fetch('/api/admin/wr-rankings-sandbox?season=2025').then(res => res.json()),
  });

  useEffect(() => {
    const loadForge = async () => {
      try {
        setForgeLoading(true);
        setForgeError(null);
        const res = await fetchForgeBatch({ position: 'WR', limit: 500 });
        const map: Record<string, ForgeScore> = {};
        for (const s of res.scores) {
          map[s.playerId] = s;
        }
        setForgeByPlayerId(map);
      } catch (err: any) {
        setForgeError(err.message ?? 'Failed to load FORGE WR scores');
      } finally {
        setForgeLoading(false);
      }
    };

    loadForge();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const rows: WRRow[] = useMemo(() => {
    if (!data?.players) return [];
    
    return data.players.map((player) => {
      // Join on canonicalId since FORGE uses slug-based IDs
      const forge = forgeByPlayerId[player.canonicalId];
      return {
        ...player,
        forgeAlpha: forge?.alpha,
        forgeConfidence: forge?.confidence,
        forgeTrajectory: forge?.trajectory,
      };
    });
  }, [data, forgeByPlayerId]);

  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows;
    
    if (searchQuery.trim()) {
      const needle = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.playerName.toLowerCase().includes(needle) ||
        r.team.toLowerCase().includes(needle)
      );
    }

    if (onlyDisagreements) {
      filtered = filtered.filter(r => {
        if (r.forgeAlpha == null) return false;
        const delta = Math.abs(r.forgeAlpha - r.alphaScore);
        return delta >= minDisagreement;
      });
    }

    return filtered.slice().sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [rows, searchQuery, sortField, sortOrder, onlyDisagreements, minDisagreement]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
      data-testid={`sort-header-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-400' : 'text-slate-600'}`} />
      </div>
    </th>
  );

  const getAlphaColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-emerald-400';
    if (score >= 40) return 'text-yellow-400';
    if (score >= 20) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTrajectoryIcon = (trajectory?: string) => {
    if (trajectory === 'rising') return '↗';
    if (trajectory === 'declining') return '↘';
    return '→';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-700 rounded w-1/4"></div>
            <div className="h-12 bg-slate-700 rounded"></div>
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">Failed to load WR rankings data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors" data-testid="back-link">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white" data-testid="page-title">WR Rankings</h1>
              <p className="text-sm text-slate-400">Sandbox Alpha vs FORGE Alpha comparison</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {forgeError && (
              <span className="text-xs text-red-400" data-testid="forge-error">{forgeError}</span>
            )}
            {forgeLoading && (
              <span className="text-xs text-blue-400 flex items-center gap-1" data-testid="forge-loading">
                <RefreshCw className="h-3 w-3 animate-spin" /> Loading FORGE...
              </span>
            )}
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
              data-testid="refresh-button"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="Search by name or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            data-testid="search-input"
          />
          
          <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyDisagreements}
                onChange={(e) => setOnlyDisagreements(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                data-testid="checkbox-disagreements"
              />
              <span className="text-sm text-slate-300">Show only big disagreements</span>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Min |Δ|</span>
              <input
                type="number"
                value={minDisagreement}
                min={1}
                max={100}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinDisagreement(Number.isNaN(v) ? 0 : v);
                }}
                className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                data-testid="input-min-delta"
              />
            </label>
          </div>
        </div>

        <div className="bg-[#141824] rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="wr-rankings-table">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-12">#</th>
                  <SortHeader field="playerName" label="Player" />
                  <SortHeader field="team" label="Team" />
                  <SortHeader field="gamesPlayed" label="GP" />
                  <SortHeader field="targets" label="Tgt" />
                  <SortHeader field="fantasyPoints" label="FP" />
                  <SortHeader field="alphaScore" label="Sandbox α" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    FORGE α
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Δ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredAndSortedRows.map((row, idx) => {
                  const delta = row.forgeAlpha != null 
                    ? (row.forgeAlpha - row.alphaScore).toFixed(1) 
                    : null;
                  const deltaNum = delta ? parseFloat(delta) : 0;
                  
                  return (
                    <tr 
                      key={row.playerId} 
                      className="hover:bg-slate-700/30 transition-colors"
                      data-testid={`row-wr-${row.playerId}`}
                    >
                      <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white" data-testid={`player-name-${row.playerId}`}>
                            {row.playerName}
                          </span>
                          {row.injuryStatus && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded">
                              {row.injuryStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-400">{row.team}</td>
                      <td className="px-3 py-2 text-sm text-slate-400">{row.gamesPlayed}</td>
                      <td className="px-3 py-2 text-sm text-slate-400">{row.targets}</td>
                      <td className="px-3 py-2 text-sm text-slate-400">{row.fantasyPoints.toFixed(1)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-sm font-mono font-semibold ${getAlphaColor(row.alphaScore)}`} data-testid={`sandbox-alpha-${row.playerId}`}>
                          {row.alphaScore}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.forgeAlpha != null ? (
                          <span className={`text-sm font-mono font-semibold ${getAlphaColor(row.forgeAlpha)}`} data-testid={`forge-alpha-${row.playerId}`}>
                            {row.forgeAlpha.toFixed(1)}
                            <span className="ml-1 text-xs text-slate-500">{getTrajectoryIcon(row.forgeTrajectory)}</span>
                          </span>
                        ) : forgeLoading ? (
                          <span className="text-sm text-slate-500">…</span>
                        ) : (
                          <span className="text-sm text-slate-500" data-testid={`forge-alpha-missing-${row.playerId}`}>-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {delta != null ? (
                          <span 
                            className={`text-sm font-mono ${deltaNum > 0 ? 'text-green-400' : deltaNum < 0 ? 'text-red-400' : 'text-slate-500'}`}
                            data-testid={`delta-${row.playerId}`}
                          >
                            {deltaNum > 0 ? '+' : ''}{delta}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span data-testid="row-count">Showing {filteredAndSortedRows.length} of {rows.length} players</span>
              <span>FORGE scores: {Object.keys(forgeByPlayerId).length} loaded</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Legend</h3>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <div><span className="text-green-400 font-bold">80+</span> Elite</div>
            <div><span className="text-emerald-400 font-bold">60-79</span> Strong</div>
            <div><span className="text-yellow-400 font-bold">40-59</span> Average</div>
            <div><span className="text-orange-400 font-bold">20-39</span> Below Avg</div>
            <div><span className="text-red-400 font-bold">&lt;20</span> Poor</div>
            <div className="border-l border-slate-600 pl-4">
              <span className="mr-2">↗ Rising</span>
              <span className="mr-2">→ Flat</span>
              <span>↘ Declining</span>
            </div>
            <div className="border-l border-slate-600 pl-4">
              <span className="text-green-400">+Δ</span> = FORGE rates higher | 
              <span className="text-red-400 ml-1">-Δ</span> = FORGE rates lower
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

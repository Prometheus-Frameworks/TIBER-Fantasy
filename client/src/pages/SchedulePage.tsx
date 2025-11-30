import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, TrendingUp, TrendingDown, ArrowUpDown, Filter } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeamLogo } from '@/components/TeamLogo';

type Position = 'WR' | 'RB' | 'TE' | 'QB';
type SosWindow = 'ros' | 'next3' | 'playoffs';

interface PlayerSosData {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  alpha: number;
  alphaBase: number;
  sosRos: number;
  sosNext3: number;
  sosPlayoffs: number;
  sosMultiplier: number;
}

interface TeamPositionSos {
  team: string;
  position: string;
  sosRos: number;
  sosNext3: number;
  sosPlayoffs: number;
}

function getSosBadge(multiplier: number): { label: string; color: string; bg: string } {
  if (multiplier >= 1.06) return { label: '++', color: 'text-green-400', bg: 'bg-green-900/40' };
  if (multiplier >= 1.03) return { label: '+', color: 'text-emerald-400', bg: 'bg-emerald-900/30' };
  if (multiplier >= 0.98) return { label: '=', color: 'text-slate-400', bg: 'bg-slate-700/50' };
  if (multiplier >= 0.95) return { label: '-', color: 'text-orange-400', bg: 'bg-orange-900/30' };
  return { label: '--', color: 'text-red-400', bg: 'bg-red-900/40' };
}

function getSosColor(score: number): string {
  if (score >= 67) return 'text-green-400 bg-green-900/30';
  if (score >= 50) return 'text-emerald-400 bg-emerald-900/20';
  if (score >= 33) return 'text-yellow-400 bg-yellow-900/20';
  return 'text-red-400 bg-red-900/30';
}

function getSosCellColor(score: number): string {
  if (score >= 67) return 'bg-green-500/20 text-green-300';
  if (score >= 50) return 'bg-emerald-500/10 text-emerald-300';
  if (score >= 33) return 'bg-yellow-500/10 text-yellow-300';
  return 'bg-red-500/20 text-red-300';
}

function PlayerSosView() {
  const [position, setPosition] = useState<Position>('WR');
  const [sortField, setSortField] = useState<'alpha' | 'sosRos' | 'sosMultiplier'>('alpha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<'all' | 'boosted' | 'penalized'>('all');

  const { data, isLoading, error } = useQuery<{ success: boolean; scores: PlayerSosData[] }>({
    queryKey: ['/api/forge/preview', { position, season: 2025, limit: 200 }],
    queryFn: () => fetch(`/api/forge/preview?position=${position}&season=2025&limit=200`).then(r => r.json()),
  });

  const sortedPlayers = useMemo(() => {
    if (!data?.scores) return [];
    
    let filtered = data.scores.filter(p => p.sosRos != null && p.alpha != null);
    
    if (filterMode === 'boosted') {
      filtered = filtered.filter(p => p.sosMultiplier > 1.03);
    } else if (filterMode === 'penalized') {
      filtered = filtered.filter(p => p.sosMultiplier < 0.97);
    }

    return filtered.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [data?.scores, sortField, sortOrder, filterMode]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortHeader = ({ field, label }: { field: typeof sortField; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-400' : 'text-slate-600'}`} />
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Position</label>
          <Select value={position} onValueChange={(v) => setPosition(v as Position)}>
            <SelectTrigger className="w-24 bg-slate-800 border-slate-600" data-testid="select-position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as typeof filterMode)}>
            <SelectTrigger className="w-36 bg-slate-800 border-slate-600" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Players</SelectItem>
              <SelectItem value="boosted">Boosted Only</SelectItem>
              <SelectItem value="penalized">Penalized Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-slate-500 ml-auto">
          {sortedPlayers.length} players
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-slate-700/50" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm">Failed to load player data</div>
      )}

      {!isLoading && !error && (
        <div className="bg-[#141824] rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="player-sos-table">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-12">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Player</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Team</th>
                  <SortHeader field="alpha" label="Alpha" />
                  <SortHeader field="sosRos" label="SoS (RoS)" />
                  <SortHeader field="sosMultiplier" label="Multiplier" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Next 3</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Playoffs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sortedPlayers.map((player, idx) => {
                  const badge = getSosBadge(player.sosMultiplier);
                  return (
                    <tr 
                      key={player.playerId} 
                      className="hover:bg-slate-700/30 transition-colors"
                      data-testid={`row-player-${player.playerId}`}
                    >
                      <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-sm font-medium text-white">{player.playerName}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <TeamLogo team={player.nflTeam} size={18} />
                          <span className="text-sm text-slate-400">{player.nflTeam}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-sm font-mono font-semibold text-blue-400">
                              {player.alpha.toFixed(1)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <div>Base: {player.alphaBase.toFixed(1)}</div>
                              <div>After SoS: {player.alpha.toFixed(1)}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-sm font-mono px-2 py-0.5 rounded ${getSosColor(player.sosRos)}`}>
                          {player.sosRos.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${badge.bg} ${badge.color}`}>
                          {badge.label} {player.sosMultiplier.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-sm font-mono px-2 py-0.5 rounded ${getSosColor(player.sosNext3)}`}>
                          {player.sosNext3?.toFixed(1) ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-sm font-mono px-2 py-0.5 rounded ${getSosColor(player.sosPlayoffs)}`}>
                          {player.sosPlayoffs?.toFixed(1) ?? '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSosView() {
  const [window, setWindow] = useState<SosWindow>('ros');
  const [sortTeam, setSortTeam] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: TeamPositionSos[] }>({
    queryKey: ['/api/forge/sos/team-position'],
    queryFn: () => fetch('/api/forge/sos/team-position').then(r => r.json()),
  });

  const teamGrid = useMemo(() => {
    if (!data?.data) return [];
    
    const byTeam: Record<string, Record<string, TeamPositionSos>> = {};
    data.data.forEach(row => {
      if (!byTeam[row.team]) byTeam[row.team] = {};
      byTeam[row.team][row.position] = row;
    });

    const teams = Object.keys(byTeam).sort();
    return teams.map(team => ({
      team,
      QB: byTeam[team]['QB'],
      RB: byTeam[team]['RB'],
      WR: byTeam[team]['WR'],
      TE: byTeam[team]['TE'],
    }));
  }, [data?.data]);

  const getSosValue = (row: TeamPositionSos | undefined): number | null => {
    if (!row) return null;
    if (window === 'ros') return row.sosRos;
    if (window === 'next3') return row.sosNext3;
    return row.sosPlayoffs;
  };

  const windowLabels: Record<SosWindow, string> = {
    ros: 'Rest of Season',
    next3: 'Next 3 Weeks',
    playoffs: 'Playoffs (15-17)',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Window</label>
          <Select value={window} onValueChange={(v) => setWindow(v as SosWindow)}>
            <SelectTrigger className="w-44 bg-slate-800 border-slate-600" data-testid="select-window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ros">Rest of Season</SelectItem>
              <SelectItem value="next3">Next 3 Weeks</SelectItem>
              <SelectItem value="playoffs">Playoffs (15-17)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-slate-500 ml-auto">
          Higher score = easier schedule
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-slate-700/50" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm">Failed to load team SoS data</div>
      )}

      {!isLoading && !error && (
        <div className="bg-[#141824] rounded-lg border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="team-sos-grid">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Team</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">QB SoS</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">RB SoS</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">WR SoS</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">TE SoS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {teamGrid.map((row) => (
                  <tr 
                    key={row.team} 
                    className="hover:bg-slate-700/30 transition-colors"
                    data-testid={`row-team-${row.team}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={row.team} size={20} />
                        <span className="text-sm font-medium text-white">{row.team}</span>
                      </div>
                    </td>
                    {(['QB', 'RB', 'WR', 'TE'] as const).map(pos => {
                      const value = getSosValue(row[pos]);
                      return (
                        <td key={pos} className="px-3 py-2 text-center">
                          {value != null ? (
                            <span className={`text-sm font-mono px-3 py-1 rounded ${getSosCellColor(value)}`}>
                              {value.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500/30"></span> Easy (67+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500/20"></span> Above Avg (50-66)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-500/20"></span> Below Avg (33-49)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500/30"></span> Tough (&lt;33)
        </span>
      </div>
    </div>
  );
}

function SosImpactView() {
  const [position, setPosition] = useState<'all' | Position>('all');
  const [minAlphaBase, setMinAlphaBase] = useState(30);

  const positions: Position[] = ['QB', 'RB', 'WR', 'TE'];

  const queries = positions.map(pos => 
    useQuery<{ success: boolean; scores: PlayerSosData[] }>({
      queryKey: ['/api/forge/preview', { position: pos, season: 2025, limit: 200 }],
      queryFn: () => fetch(`/api/forge/preview?position=${pos}&season=2025&limit=200`).then(r => r.json()),
    })
  );

  const isLoading = queries.some(q => q.isLoading);
  const error = queries.some(q => q.error);

  const { winners, traps } = useMemo(() => {
    const allPlayers: (PlayerSosData & { impact: number })[] = [];

    queries.forEach((q) => {
      if (q.data?.scores) {
        q.data.scores.forEach(p => {
          if (p.alphaBase != null && p.alpha != null && p.alphaBase >= minAlphaBase) {
            const impact = p.alpha - p.alphaBase;
            if (position === 'all' || p.position === position) {
              allPlayers.push({ ...p, impact });
            }
          }
        });
      }
    });

    const sorted = allPlayers.sort((a, b) => b.impact - a.impact);
    
    return {
      winners: sorted.filter(p => p.impact > 0).slice(0, 20),
      traps: sorted.filter(p => p.impact < 0).sort((a, b) => a.impact - b.impact).slice(0, 20),
    };
  }, [queries.map(q => q.data), position, minAlphaBase]);

  const ImpactRow = ({ player, idx }: { player: PlayerSosData & { impact: number }; idx: number }) => {
    const badge = getSosBadge(player.sosMultiplier);
    const impactColor = player.impact > 0 ? 'text-green-400' : 'text-red-400';
    const impactSign = player.impact > 0 ? '+' : '';

    return (
      <tr className="hover:bg-slate-700/30 transition-colors" data-testid={`impact-row-${player.playerId}`}>
        <td className="px-3 py-2 text-sm text-slate-500">{idx + 1}</td>
        <td className="px-3 py-2 text-sm font-medium text-white">{player.playerName}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <TeamLogo team={player.nflTeam} size={16} />
            <span className="text-xs text-slate-400">{player.nflTeam}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-slate-500">{player.position}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-slate-400 font-mono">{player.alphaBase.toFixed(1)}</span>
            <span className="text-slate-500">→</span>
            <span className="text-blue-400 font-mono font-semibold">{player.alpha.toFixed(1)}</span>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className={`text-sm font-mono font-bold ${impactColor}`}>
            {impactSign}{player.impact.toFixed(1)}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={`text-sm font-mono px-2 py-0.5 rounded ${getSosColor(player.sosRos)}`}>
            {player.sosRos.toFixed(1)}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs font-bold px-2 py-1 rounded ${badge.bg} ${badge.color}`}>
            {badge.label}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Position</label>
          <Select value={position} onValueChange={(v) => setPosition(v as typeof position)}>
            <SelectTrigger className="w-24 bg-slate-800 border-slate-600" data-testid="select-impact-position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Min Alpha</label>
          <input
            type="number"
            min={0}
            max={100}
            value={minAlphaBase}
            onChange={(e) => setMinAlphaBase(Number(e.target.value))}
            className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            data-testid="input-min-alpha"
          />
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-slate-700/50" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm">Failed to load impact data</div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Schedule Winners</h3>
              <span className="text-xs text-slate-500">Players boosted by easy schedule</span>
            </div>
            <div className="bg-[#141824] rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="winners-table">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-8">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Player</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Team</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Pos</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Base → Final</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Impact</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">SoS</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {winners.map((p, i) => <ImpactRow key={p.playerId} player={p} idx={i} />)}
                    {winners.length === 0 && (
                      <tr><td colSpan={8} className="px-3 py-4 text-center text-slate-500 text-sm">No players with schedule boost</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-semibold text-white">Schedule Traps</h3>
              <span className="text-xs text-slate-500">Players penalized by hard schedule</span>
            </div>
            <div className="bg-[#141824] rounded-lg border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="traps-table">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-8">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Player</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Team</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Pos</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Base → Final</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Impact</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">SoS</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {traps.map((p, i) => <ImpactRow key={p.playerId} player={p} idx={i} />)}
                    {traps.length === 0 && (
                      <tr><td colSpan={8} className="px-3 py-4 text-center text-slate-500 text-sm">No players with schedule penalty</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-7 w-7 text-blue-400" />
            <h1 className="text-2xl font-bold">Schedule / Strength of Schedule</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Analyze how remaining schedule difficulty affects player rankings
          </p>
        </div>

        <Tabs defaultValue="players" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="players" className="data-[state=active]:bg-blue-600" data-testid="tab-players">
              <Users className="h-4 w-4 mr-2" />
              Player SoS
            </TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-blue-600" data-testid="tab-teams">
              <Calendar className="h-4 w-4 mr-2" />
              Team SoS
            </TabsTrigger>
            <TabsTrigger value="impact" className="data-[state=active]:bg-blue-600" data-testid="tab-impact">
              <TrendingUp className="h-4 w-4 mr-2" />
              Impact
            </TabsTrigger>
          </TabsList>

          <TabsContent value="players">
            <PlayerSosView />
          </TabsContent>

          <TabsContent value="teams">
            <TeamSosView />
          </TabsContent>

          <TabsContent value="impact">
            <SosImpactView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

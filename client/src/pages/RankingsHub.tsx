import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Home, TrendingUp, ArrowUpDown, RefreshCw, Shield, Star, Zap, X, Info, Target, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';

type Position = 'WR' | 'RB' | 'TE' | 'QB' | 'DST';

interface DefenseMetrics {
  baseAlpha: number;
  sackRate: number;
  pressureRate: number;
  intRate: number;
  turnoverRate: number;
  pointsAllowedPerDrive: number;
}

interface OpponentMetrics {
  turnoverWorthyRate: number;
  sackRateAllowed: number;
  pressureRateAllowed: number;
  pointsPerDrive: number;
  playsPerGame: number;
  qbIsRookie: boolean;
  olInjured: boolean;
}

interface MatchupBreakdown {
  turnoverBoost: number;
  sackBoost: number;
  pressureBoost: number;
  scoringBoost: number;
  rookieBonus: number;
  olInjuryBonus: number;
  totalBoost: number;
}

interface DSTRanking {
  rank: number;
  team: string;
  opponent: string;
  projectedPoints: number;
  alpha: number;
  boost: number;
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  turnoverRate?: number;
  sackRate?: number;
  pointsAllowed?: number;
  defenseMetrics?: DefenseMetrics;
  opponentMetrics?: OpponentMetrics;
  matchupBreakdown?: MatchupBreakdown;
}

interface DSTStreamerResponse {
  success: boolean;
  week: number;
  season: number;
  tiers: {
    T1: DSTRanking[];
    T2: DSTRanking[];
    T3: DSTRanking[];
    T4: DSTRanking[];
  };
  hiddenGem?: DSTRanking;
  rankings: DSTRanking[];
}

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

function getTierColor(tier: 'T1' | 'T2' | 'T3' | 'T4') {
  switch (tier) {
    case 'T1': return 'text-green-400 bg-green-900/30 border-green-700/50';
    case 'T2': return 'text-emerald-400 bg-emerald-900/30 border-emerald-700/50';
    case 'T3': return 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50';
    case 'T4': return 'text-orange-400 bg-orange-900/30 border-orange-700/50';
  }
}

function getBoostColor(boost: number) {
  if (boost >= 8) return 'text-green-400';
  if (boost >= 4) return 'text-emerald-400';
  if (boost >= 0) return 'text-slate-400';
  return 'text-red-400';
}

function getBoostBarColor(value: number) {
  if (value >= 4) return 'bg-green-500';
  if (value >= 2) return 'bg-emerald-500';
  if (value >= 0) return 'bg-slate-500';
  return 'bg-red-500';
}

function MetricRow({ label, value, format = 'number', highlight = false }: { label: string; value: number | boolean; format?: 'number' | 'percent' | 'boolean'; highlight?: boolean }) {
  let displayValue = '';
  if (format === 'percent') {
    displayValue = `${((value as number) * 100).toFixed(1)}%`;
  } else if (format === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else {
    displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);
  }
  
  return (
    <div className={`flex justify-between items-center py-1.5 px-2 rounded ${highlight ? 'bg-slate-700/30' : ''}`}>
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`font-mono text-sm ${highlight ? 'text-white font-semibold' : 'text-slate-300'}`}>{displayValue}</span>
    </div>
  );
}

function BoostBreakdownRow({ label, value, maxValue = 10 }: { label: string; value: number; maxValue?: number }) {
  const percentage = Math.min(100, Math.abs(value) / maxValue * 100);
  const isPositive = value >= 0;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-slate-400 text-sm">{label}</span>
        <span className={`font-mono text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${getBoostBarColor(value)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function DSTMatchupModal({ matchup, isOpen, onClose }: { matchup: DSTRanking | null; isOpen: boolean; onClose: () => void }) {
  if (!matchup) return null;
  
  const { defenseMetrics, opponentMetrics, matchupBreakdown } = matchup;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#141824] border-gray-700 max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dst-matchup-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className={`p-2 rounded-lg ${getTierColor(matchup.tier)}`}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="text-white">{matchup.team}</span>
              <span className="text-slate-400 mx-2">vs</span>
              <span className="text-slate-300">{matchup.opponent}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-700/30">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{matchup.alpha}</div>
              <div className="text-xs text-slate-400 uppercase">Alpha Score</div>
            </div>
            <div className="text-center">
              <span className={`text-lg font-bold px-3 py-1 rounded border ${getTierColor(matchup.tier)}`}>{matchup.tier}</span>
              <div className="text-xs text-slate-400 uppercase mt-1">Tier</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{matchup.projectedPoints}</div>
              <div className="text-xs text-slate-400 uppercase">Proj Pts</div>
            </div>
          </div>

          {defenseMetrics && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wide">
                <Shield className="h-4 w-4" />
                {matchup.team} Defense Strength
              </div>
              <div className="bg-[#0a0e1a] rounded-lg p-3 space-y-1 border border-gray-800">
                <MetricRow label="Base Alpha" value={defenseMetrics.baseAlpha} highlight />
                <MetricRow label="Turnover Rate" value={defenseMetrics.turnoverRate} format="percent" />
                <MetricRow label="Sack Rate" value={defenseMetrics.sackRate} format="percent" />
                <MetricRow label="Pressure Rate" value={defenseMetrics.pressureRate} format="percent" />
                <MetricRow label="INT Rate" value={defenseMetrics.intRate} format="percent" />
                <MetricRow label="Pts Allowed/Drive" value={defenseMetrics.pointsAllowedPerDrive} />
              </div>
            </div>
          )}

          {opponentMetrics && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-400 uppercase tracking-wide">
                <Target className="h-4 w-4" />
                {matchup.opponent} Offense Vulnerability
              </div>
              <div className="bg-[#0a0e1a] rounded-lg p-3 space-y-1 border border-gray-800">
                <MetricRow label="Turnover-Worthy Rate" value={opponentMetrics.turnoverWorthyRate} format="percent" />
                <MetricRow label="Sack Rate Allowed" value={opponentMetrics.sackRateAllowed} format="percent" />
                <MetricRow label="Pressure Rate Allowed" value={opponentMetrics.pressureRateAllowed} format="percent" />
                <MetricRow label="Points Per Drive" value={opponentMetrics.pointsPerDrive} />
                <MetricRow label="Plays Per Game" value={opponentMetrics.playsPerGame} />
                {opponentMetrics.qbIsRookie && (
                  <div className="flex items-center gap-2 py-1.5 px-2 bg-yellow-900/20 rounded border border-yellow-700/30 mt-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-yellow-400 text-sm font-medium">Rookie QB</span>
                  </div>
                )}
                {opponentMetrics.olInjured && (
                  <div className="flex items-center gap-2 py-1.5 px-2 bg-red-900/20 rounded border border-red-700/30 mt-2">
                    <Users className="h-4 w-4 text-red-400" />
                    <span className="text-red-400 text-sm font-medium">O-Line Injuries</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {matchupBreakdown && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                <Zap className="h-4 w-4" />
                Matchup Boost Breakdown
              </div>
              <div className="bg-[#0a0e1a] rounded-lg p-4 space-y-3 border border-gray-800">
                <BoostBreakdownRow label="Turnover Opportunity" value={matchupBreakdown.turnoverBoost} />
                <BoostBreakdownRow label="Sack Opportunity" value={matchupBreakdown.sackBoost} />
                <BoostBreakdownRow label="Pressure Factor" value={matchupBreakdown.pressureBoost} maxValue={5} />
                <BoostBreakdownRow label="Scoring Defense" value={matchupBreakdown.scoringBoost} maxValue={5} />
                {matchupBreakdown.rookieBonus > 0 && (
                  <BoostBreakdownRow label="Rookie QB Bonus" value={matchupBreakdown.rookieBonus} maxValue={5} />
                )}
                {matchupBreakdown.olInjuryBonus > 0 && (
                  <BoostBreakdownRow label="O-Line Injury Bonus" value={matchupBreakdown.olInjuryBonus} maxValue={5} />
                )}
                <div className="border-t border-gray-700 pt-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Total Matchup Boost</span>
                    <span className={`font-mono text-lg font-bold ${getBoostColor(matchupBreakdown.totalBoost)}`}>
                      {matchupBreakdown.totalBoost >= 0 ? '+' : ''}{matchupBreakdown.totalBoost}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400">
                Alpha = Base Defense ({defenseMetrics?.baseAlpha ?? '—'}) + Matchup Boost ({matchupBreakdown?.totalBoost ?? '—'}).
                Projected points estimated at Alpha / 9.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DSTStreamerTable({ data, isLoading, week }: { data?: DSTStreamerResponse; isLoading: boolean; week: number }) {
  const [selectedMatchup, setSelectedMatchup] = useState<DSTRanking | null>(null);
  if (isLoading) {
    return (
      <div className="bg-[#141824] border border-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin h-6 w-6 border-2 border-emerald-400 border-t-transparent rounded-full"></div>
          <span className="text-slate-400">Loading DST rankings for Week {week}...</span>
        </div>
      </div>
    );
  }

  if (!data?.rankings || data.rankings.length === 0) {
    return (
      <div className="bg-[#141824] border border-gray-800 rounded-xl p-8 text-center">
        <Shield className="h-12 w-12 mx-auto mb-4 text-slate-600" />
        <h3 className="text-lg font-semibold text-white mb-2">No DST Rankings Available</h3>
        <p className="text-slate-400">Schedule data for Week {week} may not be loaded yet.</p>
      </div>
    );
  }

  return (
    <>
      <DSTMatchupModal 
        matchup={selectedMatchup} 
        isOpen={!!selectedMatchup} 
        onClose={() => setSelectedMatchup(null)} 
      />
      
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/30 px-3 py-2 rounded-lg border border-slate-700/50">
          <Info className="h-4 w-4 text-blue-400" />
          <span>Click any matchup to see the full transparency breakdown</span>
        </div>
        
        {data.hiddenGem && (
          <div 
            className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/50 rounded-xl p-4 cursor-pointer hover:border-purple-400 transition-colors"
            onClick={() => setSelectedMatchup(data.hiddenGem!)}
            data-testid="hidden-gem-card"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/30 rounded-lg">
                <Star className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-purple-300 font-medium uppercase tracking-wide">Hidden Gem</div>
                <div className="text-lg font-bold text-white">
                  {data.hiddenGem.team} vs {data.hiddenGem.opponent}
                </div>
                <div className="text-sm text-purple-200">
                  Projected: {data.hiddenGem.projectedPoints} pts | Alpha: {data.hiddenGem.alpha} | Boost: +{data.hiddenGem.boost}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#141824] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="dst-rankings-table">
              <thead className="bg-[#0a0e1a]">
                <tr>
                  <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Defense</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">vs</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Tier</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Alpha</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Proj</th>
                  <th className="hidden sm:table-cell px-2 sm:px-3 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Boost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.rankings.map((dst) => (
                  <tr 
                    key={`${dst.team}-${dst.opponent}`} 
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer" 
                    onClick={() => setSelectedMatchup(dst)}
                    data-testid={`row-dst-${dst.team}`}
                  >
                    <td className="px-2 sm:px-3 py-2 sm:py-3 text-slate-500 font-mono text-xs sm:text-sm">{dst.rank}</td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-emerald-400" />
                        <span className="font-semibold text-white text-sm sm:text-base">{dst.team}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3 text-slate-400 text-sm">@ {dst.opponent}</td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <span className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded border ${getTierColor(dst.tier)}`}>
                        {dst.tier}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <span className={`font-bold font-mono text-sm sm:text-lg ${getAlphaColor(dst.alpha)} ${getAlphaBg(dst.alpha)} px-1.5 sm:px-2 py-0.5 rounded`}>
                        {dst.alpha}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-2 sm:py-3">
                      <span className="font-semibold text-white text-sm sm:text-base">{dst.projectedPoints}</span>
                      <span className="text-[10px] sm:text-xs text-slate-500 ml-1">pts</span>
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-3 py-2 sm:py-3">
                      <span className={`font-mono text-sm ${getBoostColor(dst.boost)}`}>
                        {dst.boost >= 0 ? '+' : ''}{dst.boost}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#141824] border border-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">T1 Smash</div>
            <div className="text-lg font-bold text-green-400">{data.tiers.T1.length}</div>
          </div>
          <div className="bg-[#141824] border border-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">T2 Solid</div>
            <div className="text-lg font-bold text-emerald-400">{data.tiers.T2.length}</div>
          </div>
          <div className="bg-[#141824] border border-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">T3 Playable</div>
            <div className="text-lg font-bold text-yellow-400">{data.tiers.T3.length}</div>
          </div>
          <div className="bg-[#141824] border border-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">T4 Avoid</div>
            <div className="text-lg font-bold text-orange-400">{data.tiers.T4.length}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function RankingsHub() {
  const [position, setPosition] = useState<Position>('WR');
  const [sortField, setSortField] = useState<SortField>('alpha');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const { currentWeek } = useCurrentNFLWeek();

  const { data, isLoading, error, refetch } = useQuery<ForgeBatchResponse>({
    queryKey: ['/api/forge/batch', position],
    queryFn: async () => {
      const res = await fetch(`/api/forge/batch?position=${position}&limit=100&season=2025&week=17`);
      if (!res.ok) throw new Error('Failed to fetch rankings');
      return res.json();
    },
    enabled: position !== 'DST',
  });

  const { data: dstData, isLoading: dstLoading, error: dstError, refetch: dstRefetch } = useQuery<DSTStreamerResponse>({
    queryKey: ['/api/data-lab/dst-streamer', currentWeek],
    queryFn: async () => {
      const res = await fetch(`/api/data-lab/dst-streamer?week=${currentWeek}&season=2025`);
      if (!res.ok) throw new Error('Failed to fetch DST rankings');
      return res.json();
    },
    enabled: position === 'DST',
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
            onClick={() => position === 'DST' ? dstRefetch() : refetch()}
            disabled={position === 'DST' ? dstLoading : isLoading}
            className="border-gray-700 text-gray-300 hover:text-white px-2 sm:px-3"
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${(position === 'DST' ? dstLoading : isLoading) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Position Tabs */}
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto pb-1">
          {(['WR', 'RB', 'TE', 'QB', 'DST'] as Position[]).map((pos) => (
            <button
              key={pos}
              data-testid={`tab-${pos.toLowerCase()}`}
              onClick={() => setPosition(pos)}
              className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-semibold transition-all whitespace-nowrap flex items-center gap-1 ${
                position === pos
                  ? pos === 'DST' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                  : 'bg-[#141824] text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {pos === 'DST' && <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              {pos}
            </button>
          ))}
        </div>

        {/* Info Banner - Hidden on mobile, shown on sm+ */}
        {position === 'DST' ? (
          <div className="hidden sm:block bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-emerald-300">
              <strong>DST Streamer (Week {currentWeek})</strong>: Matchup-based defense rankings combining base strength, opponent turnovers, sack vulnerability, and situational boosts.
              Higher projected points indicate more favorable streaming options.
            </p>
          </div>
        ) : (
          <div className="hidden sm:block bg-blue-900/20 border border-blue-700/30 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-blue-300">
              <strong>FORGE Alpha (0-100)</strong>: Unified player score combining volume, efficiency, role leverage, stability, and context. 
              SoS adjustment applies a 0.90-1.10 multiplier based on remaining schedule difficulty.
            </p>
          </div>
        )}

        {/* Table */}
        {(position === 'DST' ? dstError : error) ? (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">Failed to load rankings: {(position === 'DST' ? dstError : error)?.message}</p>
          </div>
        ) : position === 'DST' ? (
          <DSTStreamerTable 
            data={dstData} 
            isLoading={dstLoading} 
            week={currentWeek}
          />
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
            {position === 'DST' ? (
              <>
                <div className="flex gap-2 sm:gap-4">
                  <span><span className="text-green-400 font-bold">T1</span> Smash Play</span>
                  <span><span className="text-emerald-400 font-bold">T2</span> Solid</span>
                  <span><span className="text-yellow-400 font-bold">T3</span> Playable</span>
                  <span><span className="text-orange-400 font-bold">T4</span> Avoid</span>
                </div>
                <div className="hidden sm:block border-l border-slate-600 pl-4">
                  Boost: Matchup adjustment from base strength
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

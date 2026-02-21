import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, TrendingUp, Award, Activity, Target, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type Position = 'WR' | 'RB' | 'TE' | 'QB';
type Season = 2024 | 2025;

interface RoleBankPlayer {
  playerId: string;
  canonicalId?: string;
  sleeperId?: string;
  playerName: string;
  team: string | null;
  position?: Position;
  roleScore: number;
  roleTier?: string;
  tier?: string;
  gamesPlayed: number;
  targetsPerGame: number | null;
  carriesPerGame: number | null;
  opportunitiesPerGame: number | null;
  targetShareAvg: number | null;
  routesPerGame: number | null;
  pprPerTarget: number | null;
  pprPerOpportunity: number | null;
  redZoneTargetsPerGame: number | null;
  redZoneTouchesPerGame: number | null;
  alphaScore?: number;
  volumeIndex?: number;
  productionIndex?: number;
  efficiencyIndex?: number;
  stabilityIndex?: number;
  fantasyWRScore?: number;
  ppgIndex?: number;
  spiceIndex?: number;
  fantasyPointsPprPerGame?: number;
  pureRoleScore?: number | null;
  dropbacksPerGame?: number | null;
  rushAttemptsPerGame?: number | null;
  redZoneDropbacksPerGame?: number | null;
  redZoneRushesPerGame?: number | null;
  epaPerPlay?: number | null;
  cpoe?: number | null;
  sackRate?: number | null;
  passingAttempts?: number | null;
  passingYards?: number | null;
  passingTouchdowns?: number | null;
  interceptions?: number | null;
  rushingYards?: number | null;
  rushingTouchdowns?: number | null;
  volumeScore: number;
  consistencyScore: number | null;
  highValueUsageScore: number | null;
  momentumScore: number;
  efficiencyScore?: number | null;
  rushingScore?: number | null;
  flags: {
    cardioWr?: boolean | null;
    pureRusher?: boolean | null;
    passingDownBack?: boolean | null;
    breakoutWatch?: boolean | null;
    redZoneWeapon?: boolean | null;
    cardioTE?: boolean | null;
    konamiCode?: boolean | null;
    systemQB?: boolean | null;
    garbageTimeKing?: boolean | null;
  };
}

interface RoleBankResponse {
  season: number;
  position: Position;
  count: number;
  results: RoleBankPlayer[];
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'CO_ALPHA': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'SECONDARY': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'TERTIARY': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  'ROTATIONAL': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  'DEPTH': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  'UNKNOWN': { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
  'ELITE_WORKHORSE': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'HIGH_END_RB1': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  'MID_RB1': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'STRONG_RB2': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  'ROTATIONAL_RB': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  'LIMITED_USAGE': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  'ELITE_TE1': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'STRONG_TE1': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  'MID_TE1': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'HIGH_TE2': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  'STREAMER': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  'BLOCKING_TE': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  'ELITE_QB1': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'STRONG_QB1': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  'MID_QB1': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'HIGH_QB2': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  'STREAMING_QB': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  'BENCH_QB': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
};

function scoreColor(score: number): string {
  if (score >= 85) return 'text-purple-700 font-bold';
  if (score >= 70) return 'text-blue-700 font-bold';
  if (score >= 55) return 'text-gray-900 font-semibold';
  if (score >= 40) return 'text-gray-600 font-medium';
  return 'text-gray-400';
}

function pillarBar(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (value >= 90) return 'bg-purple-500';
  if (value >= 75) return 'bg-blue-500';
  if (value >= 60) return 'bg-emerald-500';
  if (value >= 45) return 'bg-amber-500';
  return 'bg-gray-300';
}

export default function RoleBankRankings() {
  const [position, setPosition] = useState<Position>('WR');
  const [season, setSeason] = useState<Season>(2025);
  const [selectedPlayer, setSelectedPlayer] = useState<RoleBankPlayer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'fantasy' | 'season'>('fantasy');

  const handlePositionChange = (newPosition: Position) => {
    setPosition(newPosition);
  };

  const { data, isLoading } = useQuery<RoleBankResponse>({
    queryKey: [viewMode === 'fantasy' ? '/api/fantasy-rankings' : '/api/role-bank', position, season, viewMode],
    queryFn: async () => {
      const endpoint = viewMode === 'fantasy' && position === 'WR'
        ? `/api/fantasy-rankings/${position}/${season}?limit=250`
        : `/api/role-bank/${position}/${season}?limit=250&sortBy=roleScore&order=desc`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      return {
        season: json.season,
        position: position,
        count: json.count,
        results: json.data || json.results
      };
    }
  });

  const handlePlayerClick = (player: RoleBankPlayer) => {
    setSelectedPlayer(player);
    setDetailDialogOpen(true);
  };

  const getTierStyle = (tier: string) => {
    return TIER_COLORS[tier] || TIER_COLORS['UNKNOWN'];
  };

  const formatNumber = (num: number | null | undefined, decimals = 1): string => {
    if (num === null || num === undefined) return '—';
    return num.toFixed(decimals);
  };

  const formatPercent = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '—';
    return `${(num * 100).toFixed(1)}%`;
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Role Banks</h1>
        <p className="text-sm text-gray-500 mt-1">
          Season-level role classification and scoring for {position} evaluation
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-3">
        <div className="flex border rounded overflow-hidden">
          {(['WR', 'RB', 'TE', 'QB'] as Position[]).map(pos => (
            <button
              key={pos}
              onClick={() => handlePositionChange(pos)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                position === pos
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              data-testid={`button-position-${pos.toLowerCase()}`}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="flex border rounded overflow-hidden">
          {([2024, 2025] as Season[]).map(yr => (
            <button
              key={yr}
              onClick={() => setSeason(yr)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                season === yr
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              data-testid={`button-season-${yr}`}
            >
              {yr}
            </button>
          ))}
        </div>

        <div className="flex border rounded overflow-hidden">
          <button
            onClick={() => setViewMode('fantasy')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'fantasy'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            data-testid="button-view-fantasy"
          >
            Fantasy Rankings
          </button>
          <button
            onClick={() => setViewMode('season')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'season'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            data-testid="button-view-season"
          >
            Season Roles
          </button>
        </div>
      </div>

      {data && (
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">{data.count}</span> {position} candidates with role classifications
        </p>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left border-b">
              <tr>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Player</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Team</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-16">
                  {viewMode === 'fantasy' ? 'Alpha' : 'Score'}
                </th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-12">GP</th>

                {viewMode === 'fantasy' && (
                  <>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">PPG</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Vol</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Prod</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Eff</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Stab</th>
                  </>
                )}

                {viewMode === 'season' && position === 'WR' && (
                  <>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Tgt/G</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Tgt Share</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Routes/G</th>
                  </>
                )}
                {viewMode === 'season' && position === 'RB' && (
                  <>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Opps/G</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Carries/G</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Tgt/G</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">PPR/Opp</th>
                  </>
                )}
                {viewMode === 'season' && position === 'TE' && (
                  <>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Tgt/G</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Tgt Share</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">PPR/Tgt</th>
                  </>
                )}
                {viewMode === 'season' && position === 'QB' && (
                  <>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">DB/G</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Rush/G</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">EPA/db</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Eff</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(12)].map((_, idx) => (
                  <tr key={idx} className="border-t">
                    <td colSpan={11} className="px-3 py-3">
                      <div className="h-6 bg-gray-100 rounded animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : (
                data?.results.map((player, idx) => {
                  const tierStyle = getTierStyle(player.roleTier || player.tier || 'UNKNOWN');
                  const displayScore = viewMode === 'fantasy' && player.alphaScore
                    ? player.alphaScore
                    : player.roleScore;
                  const displayTier = player.roleTier || player.tier || 'UNKNOWN';

                  return (
                    <tr
                      key={player.playerId}
                      onClick={() => handlePlayerClick(player)}
                      className="border-t hover:bg-orange-50/50 cursor-pointer transition-colors"
                      data-testid={`role-bank-row-${idx}`}
                    >
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-gray-900">{player.playerName}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {player.team || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}>
                          {displayTier}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono ${scoreColor(displayScore)}`}>
                        {formatNumber(displayScore, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-500 font-mono">{formatNumber(player.gamesPlayed, 0)}</td>

                      {viewMode === 'fantasy' && (
                        <>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">{formatNumber(player.fantasyPointsPprPerGame)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pillarBar(player.volumeIndex)}`} style={{ width: `${Math.min(player.volumeIndex || 0, 100)}%` }} />
                              </div>
                              <span className="font-mono text-gray-600 w-6 text-right">{formatNumber(player.volumeIndex, 0)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pillarBar(player.productionIndex)}`} style={{ width: `${Math.min(player.productionIndex || 0, 100)}%` }} />
                              </div>
                              <span className="font-mono text-gray-600 w-6 text-right">{formatNumber(player.productionIndex, 0)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pillarBar(player.efficiencyIndex)}`} style={{ width: `${Math.min(player.efficiencyIndex || 0, 100)}%` }} />
                              </div>
                              <span className="font-mono text-gray-600 w-6 text-right">{formatNumber(player.efficiencyIndex, 0)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pillarBar(player.stabilityIndex)}`} style={{ width: `${Math.min(player.stabilityIndex || 0, 100)}%` }} />
                              </div>
                              <span className="font-mono text-gray-600 w-6 text-right">{formatNumber(player.stabilityIndex, 0)}</span>
                            </div>
                          </td>
                        </>
                      )}

                      {viewMode === 'season' && position === 'WR' && (
                        <>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.targetsPerGame)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatPercent(player.targetShareAvg)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.routesPerGame)}</td>
                        </>
                      )}
                      {viewMode === 'season' && position === 'RB' && (
                        <>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.opportunitiesPerGame)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.carriesPerGame)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.targetsPerGame)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.pprPerOpportunity, 2)}</td>
                        </>
                      )}
                      {viewMode === 'season' && position === 'TE' && (
                        <>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.targetsPerGame)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatPercent(player.targetShareAvg)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.pprPerTarget, 2)}</td>
                        </>
                      )}
                      {viewMode === 'season' && position === 'QB' && (
                        <>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.dropbacksPerGame)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.rushAttemptsPerGame)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.epaPerPlay, 3)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(player.efficiencyScore, 0)}</td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {!isLoading && data?.results.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No {position} data available for {season} season
            </div>
          )}
        </div>
      </div>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl">
          {selectedPlayer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-3">
                  {selectedPlayer.playerName}
                  <Badge variant="outline" className={`${getTierStyle(selectedPlayer.roleTier || selectedPlayer.tier || 'UNKNOWN').bg} ${getTierStyle(selectedPlayer.roleTier || selectedPlayer.tier || 'UNKNOWN').text} border-none text-xs`}>
                    {selectedPlayer.roleTier || selectedPlayer.tier || 'UNKNOWN'}
                  </Badge>
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{selectedPlayer.team || 'FA'}</span>
                  <span>·</span>
                  <span>{selectedPlayer.position || position}</span>
                  <span>·</span>
                  <span>{season} Season</span>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-4">
                {position === 'QB' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: 'Role Score', value: selectedPlayer.roleScore, icon: <Award className="w-4 h-4 text-purple-500" /> },
                      { label: 'Volume', value: selectedPlayer.volumeScore, icon: <TrendingUp className="w-4 h-4 text-blue-500" /> },
                      { label: 'Rushing', value: selectedPlayer.rushingScore, icon: <Activity className="w-4 h-4 text-emerald-500" /> },
                      { label: 'Efficiency', value: selectedPlayer.efficiencyScore, icon: <Target className="w-4 h-4 text-orange-500" /> },
                      { label: 'Momentum', value: selectedPlayer.momentumScore, icon: <Zap className="w-4 h-4 text-amber-500" /> },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 border rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          {item.icon}
                          <span className="text-xs text-gray-500 uppercase font-medium">{item.label}</span>
                        </div>
                        <div className="text-xl font-bold text-gray-900">{formatNumber(item.value, 0)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Role Score', value: selectedPlayer.roleScore, icon: <Award className="w-4 h-4 text-purple-500" /> },
                      { label: 'Volume', value: selectedPlayer.volumeScore, icon: <TrendingUp className="w-4 h-4 text-blue-500" /> },
                      { label: 'Consistency', value: selectedPlayer.consistencyScore, icon: <Activity className="w-4 h-4 text-emerald-500" /> },
                      { label: 'Momentum', value: selectedPlayer.momentumScore, icon: <Zap className="w-4 h-4 text-amber-500" /> },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 border rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          {item.icon}
                          <span className="text-xs text-gray-500 uppercase font-medium">{item.label}</span>
                        </div>
                        <div className="text-xl font-bold text-gray-900">{formatNumber(item.value, 0)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-gray-50 border rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Season Stats</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Games Played</span>
                      <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.gamesPlayed, 0)}</span>
                    </div>

                    {position === 'QB' && (
                      <>
                        {selectedPlayer.dropbacksPerGame != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Dropbacks/Game</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.dropbacksPerGame, 1)}</span>
                          </div>
                        )}
                        {selectedPlayer.rushAttemptsPerGame != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rush Att/Game</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.rushAttemptsPerGame, 1)}</span>
                          </div>
                        )}
                        {selectedPlayer.passingYards != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pass Yards</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.passingYards, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.passingTouchdowns != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pass TDs</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.passingTouchdowns, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.interceptions != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">INTs</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.interceptions, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.epaPerPlay != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">EPA per Play</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.epaPerPlay, 3)}</span>
                          </div>
                        )}
                        {selectedPlayer.cpoe != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">CPOE</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.cpoe, 1)}</span>
                          </div>
                        )}
                        {selectedPlayer.sackRate != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Sack Rate</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.sackRate, 1)}%</span>
                          </div>
                        )}
                      </>
                    )}

                    {position !== 'QB' && (
                      <>
                        {selectedPlayer.targetsPerGame != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Targets/Game</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.targetsPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.carriesPerGame != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Carries/Game</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.carriesPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.opportunitiesPerGame != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Opportunities/Game</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.opportunitiesPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.targetShareAvg != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Target Share</span>
                            <span className="font-medium text-gray-900">{formatPercent(selectedPlayer.targetShareAvg)}</span>
                          </div>
                        )}
                        {selectedPlayer.routesPerGame != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Routes/Game</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.routesPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.pprPerTarget != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">PPR/Target</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.pprPerTarget, 2)}</span>
                          </div>
                        )}
                        {selectedPlayer.pprPerOpportunity != null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">PPR/Opportunity</span>
                            <span className="font-medium text-gray-900">{formatNumber(selectedPlayer.pprPerOpportunity, 2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {selectedPlayer.flags && Object.values(selectedPlayer.flags).some(v => v === true) && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Player Flags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlayer.flags.breakoutWatch && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Breakout Watch</Badge>
                      )}
                      {selectedPlayer.flags.cardioWr && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-300">Cardio WR</Badge>
                      )}
                      {selectedPlayer.flags.pureRusher && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-300">Pure Rusher</Badge>
                      )}
                      {selectedPlayer.flags.passingDownBack && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-300">Passing Down Back</Badge>
                      )}
                      {selectedPlayer.flags.redZoneWeapon && (
                        <Badge className="bg-red-100 text-red-700 border-red-300">Red Zone Weapon</Badge>
                      )}
                      {selectedPlayer.flags.cardioTE && (
                        <Badge className="bg-cyan-100 text-cyan-700 border-cyan-300">Cardio TE</Badge>
                      )}
                      {selectedPlayer.flags.konamiCode && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-300">Konami Code</Badge>
                      )}
                      {selectedPlayer.flags.systemQB && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-300">System QB</Badge>
                      )}
                      {selectedPlayer.flags.garbageTimeKing && (
                        <Badge className="bg-gray-100 text-gray-600 border-gray-300">Garbage Time King</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

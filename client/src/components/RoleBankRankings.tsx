import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, TrendingUp, Award, Activity, Target, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type Position = 'WR' | 'RB' | 'TE' | 'QB';
type Season = 2024 | 2025;

interface RoleBankPlayer {
  playerId: string;
  canonicalId: string;
  sleeperId: string;
  playerName: string;
  team: string | null;
  position: Position;
  roleScore: number;
  roleTier: string;
  gamesPlayed: number;
  // Position-specific metrics
  targetsPerGame: number | null;
  carriesPerGame: number | null;
  opportunitiesPerGame: number | null;
  targetShareAvg: number | null;
  routesPerGame: number | null;
  pprPerTarget: number | null;
  pprPerOpportunity: number | null;
  redZoneTargetsPerGame: number | null;
  redZoneTouchesPerGame: number | null;
  // QB-specific metrics
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
  // Scores
  volumeScore: number;
  consistencyScore: number | null;
  highValueUsageScore: number | null;
  momentumScore: number;
  efficiencyScore?: number | null;
  rushingScore?: number | null;
  // Flags
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
  // WR Tiers
  'CO_ALPHA': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
  'SECONDARY': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  'TERTIARY': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  'DEPTH': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
  'UNKNOWN': { bg: 'bg-gray-600/20', text: 'text-gray-500', border: 'border-gray-600/50' },
  
  // RB Tiers
  'ELITE_WORKHORSE': { bg: 'bg-purple-600/20', text: 'text-purple-400', border: 'border-purple-600/50' },
  'HIGH_END_RB1': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
  'MID_RB1': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  'STRONG_RB2': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  'ROTATIONAL_RB': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
  'LIMITED_USAGE': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
  
  // TE Tiers
  'ELITE_TE1': { bg: 'bg-purple-600/20', text: 'text-purple-400', border: 'border-purple-600/50' },
  'STRONG_TE1': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
  'MID_TE1': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  'HIGH_TE2': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  'STREAMER': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
  'BLOCKING_TE': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
  
  // QB Tiers
  'ELITE_QB1': { bg: 'bg-purple-600/20', text: 'text-purple-400', border: 'border-purple-600/50' },
  'STRONG_QB1': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/50' },
  'MID_QB1': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
  'HIGH_QB2': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  'STREAMING_QB': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
  'BENCH_QB': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
};

export default function RoleBankRankings() {
  const [position, setPosition] = useState<Position>('WR');
  const [season, setSeason] = useState<Season>(2025);
  const [selectedPlayer, setSelectedPlayer] = useState<RoleBankPlayer | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data, isLoading } = useQuery<RoleBankResponse>({
    queryKey: ['/api/role-bank', position, season],
    queryFn: async () => {
      const res = await fetch(`/api/role-bank/${position}/${season}?limit=250&sortBy=roleScore&order=desc`);
      if (!res.ok) throw new Error('Failed to fetch Role Bank data');
      return res.json();
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
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-blue-500/20 pb-4">
        <h2 className="text-2xl font-bold text-white tracking-wide">ROLE CONTEXT RANKINGS</h2>
        <p className="text-gray-400 mt-1 text-sm tracking-wide">
          Season-level analytical classification for {position} role evaluation
        </p>
        <div className="mt-3 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-300 tracking-wide">
            📊 <span className="font-semibold">Scores represent role strength (0–100), not fantasy points.</span> This measures how prominent a player's role is in their offense based on volume, consistency, and usage patterns.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Position Selector */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Position</label>
          <div className="flex gap-2">
            {(['WR', 'RB', 'TE', 'QB'] as Position[]).map(pos => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`px-6 py-2.5 rounded font-medium transition-all tracking-wide ${
                  position === pos
                    ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-[#0d0e11] text-gray-400 hover:text-gray-300 border border-gray-800/50 hover:border-gray-700'
                }`}
                data-testid={`button-position-${pos.toLowerCase()}`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Season Selector */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Season</label>
          <div className="flex gap-2">
            {([2024, 2025] as Season[]).map(yr => (
              <button
                key={yr}
                onClick={() => setSeason(yr)}
                className={`px-6 py-2.5 rounded font-medium transition-all tracking-wide ${
                  season === yr
                    ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/30 border border-green-500/50 text-white shadow-lg shadow-green-500/20'
                    : 'bg-[#0d0e11] text-gray-400 hover:text-gray-300 border border-gray-800/50 hover:border-gray-700'
                }`}
                data-testid={`button-season-${yr}`}
              >
                {formatNumber(yr, 0)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count */}
      {data && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="font-medium">{formatNumber(data.count, 0)}</span>
          <span>{position} candidates with role classifications</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#111217] border border-gray-800/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0d0e11] border-b border-gray-800/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Player</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Team</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tier</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">GP</th>
                
                {/* Position-specific columns */}
                {position === 'WR' && (
                  <>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Tgt/G</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Tgt Share</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Routes/G</th>
                  </>
                )}
                {position === 'RB' && (
                  <>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Opps/G</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Carries/G</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Tgt/G</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">PPR/Opp</th>
                  </>
                )}
                {position === 'TE' && (
                  <>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Tgt/G</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Tgt Share</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">PPR/Tgt</th>
                  </>
                )}
                {position === 'QB' && (
                  <>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">DB/G</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Rush Att/G</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">EPA/db</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Eff</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(10)].map((_, idx) => (
                  <tr key={idx} className="border-b border-gray-800/30">
                    <td colSpan={position === 'RB' || position === 'QB' ? 10 : 9} className="px-4 py-4">
                      <div className="h-8 bg-gray-700/30 rounded animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : (
                data?.results.map((player, idx) => {
                  const tierStyle = getTierStyle(player.roleTier);
                  return (
                    <tr
                      key={player.playerId}
                      onClick={() => handlePlayerClick(player)}
                      className="border-b border-gray-800/30 hover:bg-blue-500/5 cursor-pointer transition-colors"
                      data-testid={`role-bank-row-${idx}`}
                    >
                      <td className="px-4 py-3 text-gray-500 font-medium">{formatNumber(idx + 1, 0)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{player.playerName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-800/70 text-gray-300 rounded text-xs font-medium">
                          {player.team || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold border ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}>
                          {player.roleTier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-white">{formatNumber(player.roleScore, 0)}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.gamesPlayed, 0)}</td>
                      
                      {/* Position-specific data */}
                      {position === 'WR' && (
                        <>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.targetsPerGame)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatPercent(player.targetShareAvg)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.routesPerGame)}</td>
                        </>
                      )}
                      {position === 'RB' && (
                        <>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.opportunitiesPerGame)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.carriesPerGame)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.targetsPerGame)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.pprPerOpportunity, 2)}</td>
                        </>
                      )}
                      {position === 'TE' && (
                        <>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.targetsPerGame)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatPercent(player.targetShareAvg)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.pprPerTarget, 2)}</td>
                        </>
                      )}
                      {position === 'QB' && (
                        <>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.dropbacksPerGame)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.rushAttemptsPerGame)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.epaPerPlay, 3)}</td>
                          <td className="px-4 py-3 text-center text-gray-300">{formatNumber(player.efficiencyScore, 0)}</td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {!isLoading && data?.results.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No {position} data available for {formatNumber(season, 0)} season
            </div>
          )}
        </div>
      </div>

      {/* Player Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-[#141824] border-gray-800 text-white max-w-2xl">
          {selectedPlayer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  {selectedPlayer.playerName}
                  <Badge variant="outline" className={`${getTierStyle(selectedPlayer.roleTier).bg} ${getTierStyle(selectedPlayer.roleTier).text} border-none`}>
                    {selectedPlayer.roleTier}
                  </Badge>
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="px-2 py-1 bg-gray-800 rounded">{selectedPlayer.team || 'FA'}</span>
                  <span>•</span>
                  <span>{selectedPlayer.position}</span>
                  <span>•</span>
                  <span>{formatNumber(season, 0)} Season</span>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Role Score Breakdown */}
                {position === 'QB' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-purple-400" />
                        <div className="text-xs text-gray-500 uppercase">Role Score</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.roleScore, 0)}</div>
                    </div>
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <div className="text-xs text-gray-500 uppercase">Volume</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.volumeScore, 0)}</div>
                    </div>
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-green-400" />
                        <div className="text-xs text-gray-500 uppercase">Rushing</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.rushingScore, 0)}</div>
                    </div>
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-orange-400" />
                        <div className="text-xs text-gray-500 uppercase">Efficiency</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.efficiencyScore, 0)}</div>
                    </div>
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <div className="text-xs text-gray-500 uppercase">Momentum</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.momentumScore, 0)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-purple-400" />
                        <div className="text-xs text-gray-500 uppercase">Role Score</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.roleScore, 0)}</div>
                    </div>
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <div className="text-xs text-gray-500 uppercase">Volume</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.volumeScore, 0)}</div>
                    </div>
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-green-400" />
                        <div className="text-xs text-gray-500 uppercase">Consistency</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.consistencyScore, 0)}</div>
                    </div>
                    <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <div className="text-xs text-gray-500 uppercase">Momentum</div>
                      </div>
                      <div className="text-2xl font-bold text-white">{formatNumber(selectedPlayer.momentumScore, 0)}</div>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Season Stats</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Games Played</span>
                      <span className="text-white font-medium">{formatNumber(selectedPlayer.gamesPlayed, 0)}</span>
                    </div>
                    
                    {/* QB-specific stats */}
                    {position === 'QB' && (
                      <>
                        {selectedPlayer.dropbacksPerGame !== undefined && selectedPlayer.dropbacksPerGame !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Dropbacks/Game</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.dropbacksPerGame, 1)}</span>
                          </div>
                        )}
                        {selectedPlayer.rushAttemptsPerGame !== undefined && selectedPlayer.rushAttemptsPerGame !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rush Att/Game</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.rushAttemptsPerGame, 1)}</span>
                          </div>
                        )}
                        {selectedPlayer.passingAttempts !== undefined && selectedPlayer.passingAttempts !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pass Attempts</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.passingAttempts, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.passingYards !== undefined && selectedPlayer.passingYards !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pass Yards</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.passingYards, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.passingTouchdowns !== undefined && selectedPlayer.passingTouchdowns !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Pass TDs</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.passingTouchdowns, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.interceptions !== undefined && selectedPlayer.interceptions !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">INTs</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.interceptions, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.rushingYards !== undefined && selectedPlayer.rushingYards !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rush Yards</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.rushingYards, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.rushingTouchdowns !== undefined && selectedPlayer.rushingTouchdowns !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rush TDs</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.rushingTouchdowns, 0)}</span>
                          </div>
                        )}
                        {selectedPlayer.epaPerPlay !== undefined && selectedPlayer.epaPerPlay !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">EPA per Play</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.epaPerPlay, 3)}</span>
                          </div>
                        )}
                        {selectedPlayer.cpoe !== undefined && selectedPlayer.cpoe !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">CPOE</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.cpoe, 1)}</span>
                          </div>
                        )}
                        {selectedPlayer.sackRate !== undefined && selectedPlayer.sackRate !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Sack Rate</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.sackRate, 1)}%</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* WR/RB/TE stats */}
                    {position !== 'QB' && (
                      <>
                        {selectedPlayer.targetsPerGame !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Targets/Game</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.targetsPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.carriesPerGame !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Carries/Game</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.carriesPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.opportunitiesPerGame !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Opportunities/Game</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.opportunitiesPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.targetShareAvg !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Target Share</span>
                            <span className="text-white font-medium">{formatPercent(selectedPlayer.targetShareAvg)}</span>
                          </div>
                        )}
                        {selectedPlayer.routesPerGame !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Routes/Game</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.routesPerGame)}</span>
                          </div>
                        )}
                        {selectedPlayer.pprPerTarget !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">PPR/Target</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.pprPerTarget, 2)}</span>
                          </div>
                        )}
                        {selectedPlayer.pprPerOpportunity !== null && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">PPR/Opportunity</span>
                            <span className="text-white font-medium">{formatNumber(selectedPlayer.pprPerOpportunity, 2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Flags */}
                {Object.values(selectedPlayer.flags).some(v => v === true) && (
                  <div className="bg-[#0d0e11] border border-gray-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Player Flags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlayer.flags.breakoutWatch && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                          🎯 Breakout Watch
                        </Badge>
                      )}
                      {selectedPlayer.flags.cardioWr && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                          🏃 Cardio WR
                        </Badge>
                      )}
                      {selectedPlayer.flags.pureRusher && (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">
                          🏈 Pure Rusher
                        </Badge>
                      )}
                      {selectedPlayer.flags.passingDownBack && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                          📡 Passing Down Back
                        </Badge>
                      )}
                      {selectedPlayer.flags.redZoneWeapon && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                          🎯 Red Zone Weapon
                        </Badge>
                      )}
                      {selectedPlayer.flags.cardioTE && (
                        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                          🏃 Cardio TE
                        </Badge>
                      )}
                      {selectedPlayer.flags.konamiCode && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                          🎮 Konami Code
                        </Badge>
                      )}
                      {selectedPlayer.flags.systemQB && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                          ⚙️ System QB
                        </Badge>
                      )}
                      {selectedPlayer.flags.garbageTimeKing && (
                        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
                          🗑️ Garbage Time King
                        </Badge>
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

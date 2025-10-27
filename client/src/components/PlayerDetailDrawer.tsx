import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Activity, Target, Zap, Users, Trophy } from 'lucide-react';

interface PlayerDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nflfastrId: string;
  playerName: string;
  team: string;
  position: string;
  week: number;
  season: number;
}

interface TiberScoreData {
  success: boolean;
  data: {
    tiberScore: number;
    tier: string;
    breakdown: {
      firstDownScore: number;
      epaScore: number;
      usageScore: number;
      tdScore: number;
      teamScore: number;
    };
    metrics: {
      firstDownRate: number;
      totalFirstDowns: number;
      epaPerPlay: number;
      snapPercentAvg: number;
      snapTrend: string;
      tdRate: number;
      teamOffenseRank: number;
    };
    gameLog?: {
      opponent: string | null;
      gameDate: Date | null;
      gamesPlayed?: number;
      fantasyPoints: number;
      passing: {
        attempts: number;
        completions: number;
        yards: number;
        touchdowns: number;
        interceptions: number;
      };
      rushing: {
        attempts: number;
        yards: number;
        touchdowns: number;
      };
      receiving: {
        receptions: number;
        targets: number;
        yards: number;
        touchdowns: number;
      };
    } | null;
  };
}

export default function PlayerDetailDrawer({
  isOpen,
  onClose,
  nflfastrId,
  playerName,
  team,
  position,
  week,
  season,
}: PlayerDetailDrawerProps) {
  const [mode, setMode] = useState<'weekly' | 'season'>('weekly');
  
  const { data: tiberData, isLoading } = useQuery<TiberScoreData>({
    queryKey: ['/api/tiber/score', nflfastrId, week, season, mode],
    queryFn: async () => {
      const res = await fetch(`/api/tiber/score/${nflfastrId}?week=${week}&season=${season}&mode=${mode}`);
      if (!res.ok) throw new Error('Failed to fetch TIBER score');
      return res.json();
    },
    enabled: isOpen && !!nflfastrId,
  });

  const getTierColor = (tier: string) => {
    if (tier === 'breakout') return 'text-green-400 bg-green-500/20 border-green-500/30';
    if (tier === 'regression') return 'text-red-400 bg-red-500/20 border-red-500/30';
    return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    return 'text-red-400';
  };

  const renderBreakdownItem = (label: string, score: number, icon: React.ReactNode, maxScore: number = 20) => {
    const percentage = (score / maxScore) * 100;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-gray-400">{icon}</div>
            <span className="text-sm text-gray-300">{label}</span>
          </div>
          <span className={`font-bold text-sm ${getScoreColor(score * 5)}`}>
            {score.toFixed(1)}/{maxScore}
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              score >= maxScore * 0.8 ? 'bg-green-500' :
              score >= maxScore * 0.6 ? 'bg-blue-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-[#0a0e1a] border-l border-gray-800 overflow-y-auto">
        <SheetHeader className="border-b border-red-500/10 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-2xl font-bold text-white tracking-wide">
                {playerName}
              </SheetTitle>
              <SheetDescription className="text-gray-400 mt-1">
                {team} • {position} • Week {week}, {season}
              </SheetDescription>
            </div>
            {tiberData && (
              <div className={`px-3 py-2 rounded-lg font-bold text-2xl border ${getTierColor(tiberData.data.tier)}`}>
                {tiberData.data.tiberScore}
              </div>
            )}
          </div>
          
          {/* Mode Toggle */}
          <div className="mt-4">
            <Tabs value={mode} onValueChange={(value) => setMode(value as 'weekly' | 'season')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 border border-gray-700/50">
                <TabsTrigger 
                  value="weekly" 
                  data-testid="tab-weekly"
                  className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400 data-[state=active]:border-blue-500/50"
                >
                  Week {week} Only
                </TabsTrigger>
                <TabsTrigger 
                  value="season" 
                  data-testid="tab-season"
                  className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 data-[state=active]:border-purple-500/50"
                >
                  Season Total
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 bg-gray-800/50" />
            <Skeleton className="h-32 bg-gray-800/50" />
            <Skeleton className="h-40 bg-gray-800/50" />
          </div>
        ) : tiberData && tiberData.data ? (
          <div className="space-y-6">
            {/* TIBER Score Breakdown */}
            {tiberData.data.breakdown && (
            <div className="bg-[#111217] border border-gray-800/50 rounded-xl p-5 space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="text-red-400" size={16} />
                TIBER Score Breakdown
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Each component contributes to the overall TIBER score (max 100)
              </p>
              <div className="space-y-4">
                {renderBreakdownItem(
                  'First Down Efficiency', 
                  tiberData.data.breakdown.firstDownScore,
                  <Target size={16} />,
                  20
                )}
                {renderBreakdownItem(
                  'EPA Impact', 
                  tiberData.data.breakdown.epaScore,
                  <TrendingUp size={16} />,
                  20
                )}
                {renderBreakdownItem(
                  'Usage/Opportunity', 
                  tiberData.data.breakdown.usageScore,
                  <Zap size={16} />,
                  20
                )}
                {renderBreakdownItem(
                  'Touchdown Upside', 
                  tiberData.data.breakdown.tdScore,
                  <TrendingUp size={16} />,
                  20
                )}
                {renderBreakdownItem(
                  'Team Offense Context', 
                  tiberData.data.breakdown.teamScore,
                  <Users size={16} />,
                  20
                )}
              </div>
            </div>
            )}

            {/* Key Metrics */}
            {tiberData.data.metrics && (
            <div className="bg-[#111217] border border-gray-800/50 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Key Metrics ({mode === 'weekly' ? `Week ${week}` : 'Season Total'})</span>
                <span className={`text-xs px-2 py-1 rounded ${mode === 'weekly' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                  {mode === 'weekly' ? 'Single Week' : 'Cumulative'}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">First Down Rate</p>
                  <p className="text-lg font-bold text-white">
                    {(tiberData.data.metrics.firstDownRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">First Downs</p>
                  <p className="text-lg font-bold text-white">
                    {tiberData.data.metrics.totalFirstDowns}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">EPA per Play</p>
                  <p className="text-lg font-bold text-white">
                    {tiberData.data.metrics.epaPerPlay?.toFixed(3) || 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Snap %</p>
                  <p className="text-lg font-bold text-white flex items-center gap-1">
                    {tiberData.data.metrics.snapPercentAvg.toFixed(1)}%
                    {tiberData.data.metrics.snapTrend === 'up' && (
                      <TrendingUp size={14} className="text-green-400" />
                    )}
                    {tiberData.data.metrics.snapTrend === 'down' && (
                      <TrendingDown size={14} className="text-red-400" />
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">TD Rate</p>
                  <p className="text-lg font-bold text-white">
                    {(tiberData.data.metrics.tdRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Team Off. Rank</p>
                  <p className="text-lg font-bold text-white">
                    #{tiberData.data.metrics.teamOffenseRank}
                  </p>
                </div>
              </div>
            </div>
            )}

            {/* Game Log Section */}
            {tiberData.data.gameLog && (
            <div className="bg-[#111217] border border-gray-800/50 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Trophy className="text-yellow-400" size={16} />
                {mode === 'weekly' ? `Week ${week} Game Log` : `Season Stats (Weeks 1-${week})`}
              </h3>
              
              {/* Opponent and Fantasy Points */}
              <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-800/50">
                {mode === 'weekly' && tiberData.data.gameLog.opponent && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Opponent</p>
                    <p className="text-lg font-bold text-white">
                      vs {tiberData.data.gameLog.opponent}
                    </p>
                  </div>
                )}
                {mode === 'season' && tiberData.data.gameLog.gamesPlayed && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Games Played</p>
                    <p className="text-lg font-bold text-white">
                      {tiberData.data.gameLog.gamesPlayed}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Fantasy Points (PPR)</p>
                  <p className="text-lg font-bold text-green-400">
                    {tiberData.data.gameLog.fantasyPoints?.toFixed(1) || '0.0'}
                  </p>
                </div>
              </div>

              {/* Position-Specific Stats */}
              {position === 'QB' && tiberData.data.gameLog.passing.attempts > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Passing</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">CMP/ATT</p>
                      <p className="text-sm font-bold text-white">
                        {tiberData.data.gameLog.passing.completions}/{tiberData.data.gameLog.passing.attempts}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">YDS</p>
                      <p className="text-sm font-bold text-white">{tiberData.data.gameLog.passing.yards}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">TD/INT</p>
                      <p className="text-sm font-bold text-white">
                        {tiberData.data.gameLog.passing.touchdowns}/{tiberData.data.gameLog.passing.interceptions}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(position === 'WR' || position === 'TE') && tiberData.data.gameLog.receiving.targets > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Receiving</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">TGT</p>
                      <p className="text-sm font-bold text-white">{tiberData.data.gameLog.receiving.targets}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">REC</p>
                      <p className="text-sm font-bold text-white">{tiberData.data.gameLog.receiving.receptions}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">YDS</p>
                      <p className="text-sm font-bold text-white">{tiberData.data.gameLog.receiving.yards}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">TD</p>
                      <p className="text-sm font-bold text-green-400">{tiberData.data.gameLog.receiving.touchdowns}</p>
                    </div>
                  </div>
                </div>
              )}

              {position === 'RB' && (
                <div className="space-y-4">
                  {tiberData.data.gameLog.rushing.attempts > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rushing</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">ATT</p>
                          <p className="text-sm font-bold text-white">{tiberData.data.gameLog.rushing.attempts}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">YDS</p>
                          <p className="text-sm font-bold text-white">{tiberData.data.gameLog.rushing.yards}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">TD</p>
                          <p className="text-sm font-bold text-green-400">{tiberData.data.gameLog.rushing.touchdowns}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {tiberData.data.gameLog.receiving.targets > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Receiving</h4>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">TGT</p>
                          <p className="text-sm font-bold text-white">{tiberData.data.gameLog.receiving.targets}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">REC</p>
                          <p className="text-sm font-bold text-white">{tiberData.data.gameLog.receiving.receptions}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">YDS</p>
                          <p className="text-sm font-bold text-white">{tiberData.data.gameLog.receiving.yards}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">TD</p>
                          <p className="text-sm font-bold text-green-400">{tiberData.data.gameLog.receiving.touchdowns}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Why This Score? */}
            <div className="bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/20 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
                Why {tiberData.data.tiberScore}?
              </h3>
              <div className="text-sm text-gray-300 space-y-2 leading-relaxed">
                {tiberData.data.tier === 'breakout' && (
                  <p>
                    <strong className="text-green-400">Breakout Signal:</strong> High efficiency across multiple categories. 
                    This player is producing at an elite level with {tiberData.data.metrics?.firstDownRate ? (tiberData.data.metrics.firstDownRate * 100).toFixed(0) : 'N/A'}% 
                    first down rate and strong EPA impact.
                  </p>
                )}
                {tiberData.data.tier === 'stable' && (
                  <p>
                    <strong className="text-blue-400">Steady Performance:</strong> Consistent production with balanced metrics. 
                    Reliable weekly contributor with solid opportunity share.
                  </p>
                )}
                {tiberData.data.tier === 'regression' && (
                  <p>
                    <strong className="text-red-400">Concern Alert:</strong> Below-average efficiency or usage metrics. 
                    Monitor for improvement before starting with confidence.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No TIBER data available for this player
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-800/50 text-center">
          <p className="text-xs text-gray-600 tracking-wide">
            TIBER v1.0 — Tactical Index for Breakout Efficiency & Regression
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

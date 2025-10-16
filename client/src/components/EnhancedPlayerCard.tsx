import { X, TrendingUp, TrendingDown, Minus, Calendar, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface PlayerSearchResult {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam: string;
}

interface TiberHistoryResponse {
  success: boolean;
  data: {
    nflfastrId: string;
    season: number;
    history: Array<{
      week: number;
      tiberScore: number;
      tier: string;
      firstDownRate: number;
      epaPerPlay: number;
    }>;
    summary: {
      totalWeeks: number;
      currentScore: number;
      currentTier: string;
      trend: 'up' | 'down' | 'stable';
      trendValue: number;
      lastThreeWeeks: Array<{
        week: number;
        score: number;
        tier: string;
      }>;
    };
  };
}

interface ROSMatchupResponse {
  success: boolean;
  data: {
    player: {
      canonicalId: string;
      fullName: string;
      position: string;
      team: string;
    };
    season: number;
    matchups: Array<{
      week: number;
      opponent: string;
      isHome: boolean;
      dvpRating: string;
      rankVsPosition: number | null;
      avgPtsAllowed: number | null;
    }>;
    summary: {
      totalGames: number;
      eliteMatchups: number;
      goodMatchups: number;
      toughMatchups: number;
    };
  };
}

interface PlayerIdentityResponse {
  success: boolean;
  data: {
    canonicalId: string;
    fullName: string;
    position: string;
    nflTeam: string;
    externalIds?: {
      sleeper?: string;
      nfl_data_py?: string;
      espn?: string;
      yahoo?: string;
    };
  };
}

interface EnhancedPlayerCardProps {
  player: PlayerSearchResult;
  onClose: () => void;
}

export default function EnhancedPlayerCard({ player, onClose }: EnhancedPlayerCardProps) {
  // Fetch NFLfastR ID mapping
  const { data: identityData } = useQuery<PlayerIdentityResponse>({
    queryKey: [`/api/player-identity/player/${player.canonicalId}`],
  });

  const nflfastrId = identityData?.data?.externalIds?.nfl_data_py;

  // Fetch TIBER history (weeks 1-6)
  const { data: tiberHistory, isLoading: tiberLoading } = useQuery<TiberHistoryResponse>({
    queryKey: [`/api/tiber/history/${nflfastrId}`],
    enabled: !!nflfastrId,
  });

  // Fetch ROS matchups (weeks 7-18)
  const { data: rosMatchups, isLoading: matchupsLoading } = useQuery<ROSMatchupResponse>({
    queryKey: [`/api/matchup/ros/${player.canonicalId}`],
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'breakout': return 'text-green-400';
      case 'regression': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getDvPColor = (rating: string) => {
    switch (rating) {
      case 'elite-matchup': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'neutral': return 'bg-gray-500';
      case 'tough': return 'bg-orange-500';
      case 'avoid': return 'bg-red-500';
      default: return 'bg-gray-600';
    }
  };

  const getDvPLabel = (rating: string) => {
    switch (rating) {
      case 'elite-matchup': return 'Elite';
      case 'good': return 'Good';
      case 'neutral': return 'Neutral';
      case 'tough': return 'Tough';
      case 'avoid': return 'Avoid';
      default: return 'Unknown';
    }
  };

  return (
    <Card className="bg-[#1e2330] border-gray-700 p-6 max-w-5xl mx-auto" data-testid="enhanced-player-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-white text-xl">
            {player.position}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{player.fullName}</h2>
            <p className="text-gray-400">{player.nflTeam} • {player.position}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#141824] rounded-lg transition-colors"
          data-testid="button-close-player-card"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      </div>

      {/* TIBER Trend Chart - Weeks 1-6 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-100">TIBER Trend (Weeks 1-6)</h3>
        </div>
        
        {tiberLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : tiberHistory?.data ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tiberHistory.data.history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="week" 
                  stroke="#9CA3AF"
                  label={{ value: 'Week', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  label={{ value: 'TIBER Score', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e2330', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <ReferenceLine y={50} stroke="#6B7280" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="tiberScore" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Last 3 Weeks Summary */}
            <div className="mt-4 p-4 bg-[#141824] rounded-lg">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Last 3 Weeks Performance</h4>
              <div className="flex items-center gap-4">
                {tiberHistory.data.summary.lastThreeWeeks.map((week) => (
                  <div key={week.week} className="flex-1 text-center">
                    <div className="text-xs text-gray-500 mb-1">Week {week.week}</div>
                    <div className={`text-2xl font-bold ${getTierColor(week.tier)}`}>
                      {week.score}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">{week.tier}</div>
                  </div>
                ))}
                <div className="flex-1 text-center border-l border-gray-700 pl-4">
                  <div className="text-xs text-gray-500 mb-1">Trend</div>
                  <div className="flex items-center justify-center gap-2">
                    {tiberHistory.data.summary.trend === 'up' && <TrendingUp className="w-6 h-6 text-green-400" />}
                    {tiberHistory.data.summary.trend === 'down' && <TrendingDown className="w-6 h-6 text-red-400" />}
                    {tiberHistory.data.summary.trend === 'stable' && <Minus className="w-6 h-6 text-gray-400" />}
                    <span className={`text-xl font-bold ${
                      tiberHistory.data.summary.trend === 'up' ? 'text-green-400' :
                      tiberHistory.data.summary.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {tiberHistory.data.summary.trend === 'stable' ? '~' : 
                       tiberHistory.data.summary.trendValue > 0 ? '+' : ''}{tiberHistory.data.summary.trendValue}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-8">No TIBER history available</div>
        )}
      </div>

      {/* ROS Matchup Schedule - Weeks 7-18 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-100">Rest of Season Schedule (Weeks 7-18)</h3>
        </div>

        {matchupsLoading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        ) : rosMatchups?.data ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="p-3 bg-[#141824] rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-100">{rosMatchups.data.summary.totalGames}</div>
                <div className="text-xs text-gray-500">Total Games</div>
              </div>
              <div className="p-3 bg-[#141824] rounded-lg text-center">
                <div className="text-2xl font-bold text-green-400">{rosMatchups.data.summary.eliteMatchups}</div>
                <div className="text-xs text-gray-500">Elite Matchups</div>
              </div>
              <div className="p-3 bg-[#141824] rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-400">{rosMatchups.data.summary.goodMatchups}</div>
                <div className="text-xs text-gray-500">Good Matchups</div>
              </div>
              <div className="p-3 bg-[#141824] rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-400">{rosMatchups.data.summary.toughMatchups}</div>
                <div className="text-xs text-gray-500">Tough Matchups</div>
              </div>
            </div>

            {/* Matchup Calendar */}
            <div className="grid grid-cols-6 gap-2">
              {rosMatchups.data.matchups.map((matchup) => (
                <div
                  key={matchup.week}
                  className="p-3 bg-[#141824] rounded-lg hover:bg-[#1a1f2e] transition-colors"
                  data-testid={`matchup-week-${matchup.week}`}
                >
                  <div className="text-xs text-gray-500 mb-1">Week {matchup.week}</div>
                  <div className="text-sm font-semibold text-gray-100 mb-1">
                    {matchup.isHome ? 'vs' : '@'} {matchup.opponent}
                  </div>
                  <Badge className={`${getDvPColor(matchup.dvpRating)} text-white text-xs`}>
                    {getDvPLabel(matchup.dvpRating)}
                  </Badge>
                  {matchup.rankVsPosition && (
                    <div className="text-xs text-gray-500 mt-1">Rank: #{matchup.rankVsPosition}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-8">No ROS matchup data available</div>
        )}
      </div>
    </Card>
  );
}

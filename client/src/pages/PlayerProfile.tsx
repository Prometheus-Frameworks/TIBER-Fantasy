import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { ArrowLeft, TrendingUp, BarChart3, Target, Shield, Zap } from 'lucide-react';

interface PlayerRating {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  overall_rating: number;
  positional_rank: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  components: {
    talent: number;
    opportunity: number;
    consistency: number;
    upside: number;
    floor: number;
  };
  format_ratings: {
    redraft: number;
    dynasty: number;
    half_ppr: number;
    full_ppr: number;
    superflex: number;
  };
  age_adjusted_value: number;
  breakout_probability: number;
  last_updated: string;
}

interface GameLog {
  player_id: string;
  player_name: string;
  week: number;
  opponent: string;
  stats: {
    pass_yds?: number;
    pass_tds?: number;
    rush_yds?: number;
    rush_tds?: number;
    rec?: number;
    rec_yds?: number;
    rec_tds?: number;
  };
  fantasy_points: number;
  game_date: string;
}

interface Projection {
  player_id: string;
  player_name: string;
  week: number;
  position: string;
  projected_stats: {
    pass_yds?: number;
    pass_tds?: number;
    rush_yds?: number;
    rush_tds?: number;
    rec?: number;
    rec_yds?: number;
    rec_tds?: number;
  };
  projected_points: number;
  confidence: number;
  last_updated: string;
}

const PlayerProfile: React.FC = () => {
  const params = useParams();
  const playerId = params.id as string;

  const { data: ratingData, isLoading: ratingLoading } = useQuery<{ok: boolean, data: PlayerRating}>({
    queryKey: [`/api/ratings/player/${playerId}`],
    retry: 2,
    enabled: !!playerId,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<{ok: boolean, data: GameLog[], count: number}>({
    queryKey: [`/api/logs/player/${playerId}`],
    retry: 2,
    enabled: !!playerId,
  });

  const { data: projectionsData, isLoading: projectionsLoading } = useQuery<{ok: boolean, data: Projection[], count: number}>({
    queryKey: [`/api/projections/player/${playerId}`],
    retry: 2,
    enabled: !!playerId,
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'S': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'talent': return <Target className="h-4 w-4" />;
      case 'opportunity': return <BarChart3 className="h-4 w-4" />;
      case 'consistency': return <Shield className="h-4 w-4" />;
      case 'upside': return <Zap className="h-4 w-4" />;
      case 'floor': return <Shield className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const isLoading = ratingLoading || logsLoading || projectionsLoading;
  const player = ratingData?.data;
  const gameLogs = logsData?.data || [];
  const projections = projectionsData?.data || [];

  if (!playerId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">Invalid Player</h3>
            <p className="text-red-600 dark:text-red-300">No player ID provided in the URL.</p>
            <Link href="/rankings">
              <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                Back to Rankings
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
              <div className="h-48 bg-gray-200 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-400 mb-2">
              Player Not Found
            </h3>
            <p className="text-orange-600 dark:text-orange-300">
              No rating data available for player ID: {playerId}
            </p>
            <p className="text-sm text-orange-500 dark:text-orange-400 mt-2">
              This player may not be in our ratings database yet.
            </p>
            <Link href="/rankings">
              <button className="mt-4 inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Rankings
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/rankings">
            <button className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Rankings
            </button>
          </Link>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {player.player_name}
                </h1>
                <div className="flex items-center space-x-3 mt-2">
                  <span className="text-lg text-gray-600 dark:text-gray-300">
                    {player.position} • {player.team}
                  </span>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${getTierColor(player.tier)}`}>
                    Tier {player.tier}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    #{player.positional_rank} {player.position}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {player.overall_rating}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Overall Rating
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Component Ratings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {Object.entries(player.components).map(([component, value]) => (
            <div key={component} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getComponentIcon(component)}
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {component}
                  </h3>
                </div>
                <TrendingUp className={`h-4 w-4 ${value >= 80 ? 'text-green-500' : value >= 60 ? 'text-yellow-500' : 'text-gray-400'}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full ${value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-gray-400'}`}
                  style={{ width: `${value}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Format Ratings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Format Ratings</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(player.format_ratings).map(([format, rating]) => (
              <div key={format} className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {rating}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {format.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Game Logs & Projections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Game Logs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Game Logs ({gameLogs.length})
            </h3>
            {gameLogs.length > 0 ? (
              <div className="space-y-3">
                {gameLogs.slice(0, 5).map((log, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Week {log.week} vs {log.opponent}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {log.game_date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {log.fantasy_points.toFixed(1)} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No game log data available for this player.
              </p>
            )}
          </div>

          {/* Upcoming Projections */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              2025 Projections ({projections.length})
            </h3>
            {projections.length > 0 ? (
              <div className="space-y-3">
                {projections.slice(0, 5).map((proj, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Week {proj.week}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {proj.confidence}% confidence
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {proj.projected_points.toFixed(1)} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No projection data available for this player.
              </p>
            )}
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Additional Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Age Adjusted Value</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {player.age_adjusted_value}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Breakout Probability</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {player.breakout_probability}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Last Updated</div>
              <div className="text-sm text-gray-900 dark:text-white">
                {new Date(player.last_updated).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;
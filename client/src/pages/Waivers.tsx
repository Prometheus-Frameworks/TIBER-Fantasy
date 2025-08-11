import React, { useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Target, TrendingUp, Users } from 'lucide-react';

interface PlayerSuggestion {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  overall_rating: number;
  positional_rank: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  ownership_pct?: number;
  add_priority: number;
  why_add: string;
  format_ratings: {
    redraft: number;
    dynasty: number;
    superflex: number;
  };
}

const Waivers: React.FC = () => {
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');
  const [leagueSize, setLeagueSize] = useState<8 | 10 | 12 | 14>(12);
  const [format, setFormat] = useState<'redraft' | 'dynasty' | 'superflex'>('redraft');
  const [isPending, startTransition] = useTransition();

  // Query for waiver wire suggestions
  const { data: suggestionsData, isLoading, error } = useQuery<{ok: boolean, data: PlayerSuggestion[]}>({
    queryKey: ['/api/waivers', selectedPosition, leagueSize, format],
    retry: 2,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const handlePositionChange = (position: typeof selectedPosition) => {
    startTransition(() => {
      setSelectedPosition(position);
    });
  };

  const handleLeagueSizeChange = (size: typeof leagueSize) => {
    startTransition(() => {
      setLeagueSize(size);
    });
  };

  const suggestions = suggestionsData?.data || [];

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

  const getPriorityColor = (priority: number) => {
    if (priority <= 3) return 'text-red-600 font-bold';
    if (priority <= 6) return 'text-orange-600 font-semibold';
    if (priority <= 10) return 'text-yellow-600 font-medium';
    return 'text-gray-600';
  };

  if (isLoading || isPending) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-6"></div>
              <div className="flex space-x-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                ))}
              </div>
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 dark:bg-gray-600 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <Search className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Waiver Wire Targets
            </h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Smart adds for your league
            </span>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Position Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Position
              </label>
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {(['ALL', 'QB', 'RB', 'WR', 'TE'] as const).map((position) => (
                  <button
                    key={position}
                    onClick={() => handlePositionChange(position)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      selectedPosition === position
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {position}
                  </button>
                ))}
              </div>
            </div>

            {/* League Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                League Size
              </label>
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {([8, 10, 12, 14] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => handleLeagueSizeChange(size)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      leagueSize === size
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Format
              </label>
              <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {(['redraft', 'dynasty', 'superflex'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                      format === fmt
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {error ? (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-400 mb-2">
              Waiver Suggestions Unavailable
            </h3>
            <p className="text-orange-600 dark:text-orange-300">
              Unable to load waiver wire suggestions. Using fallback ratings data for your league setup.
            </p>
            <div className="mt-4 text-sm text-orange-500 dark:text-orange-400">
              <p>• {leagueSize}-team {format} league</p>
              <p>• Position filter: {selectedPosition}</p>
              <p>• Check back for updated suggestions</p>
            </div>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Targets Found
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              No high-value waiver wire targets available for your league settings.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Try adjusting your position or league size filters.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                      Player
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ownership
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Why Add
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {suggestions.map((player) => (
                    <tr key={player.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {player.player_name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {player.position} • {player.team}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${getPriorityColor(player.add_priority)}`}>
                          #{player.add_priority}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {player.overall_rating}
                          </span>
                          <TrendingUp className="h-4 w-4 text-green-500 ml-1" />
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getTierColor(player.tier)}`}>
                          {player.tier}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-400 mr-1" />
                          {player.ownership_pct || 'Unknown'}%
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                        {player.why_add}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Waiver suggestions for {leagueSize}-team {format} league • 
            Position: {selectedPosition} • 
            Refreshed every 6 hours during season
          </p>
        </div>
      </div>
    </div>
  );
};

export default Waivers;
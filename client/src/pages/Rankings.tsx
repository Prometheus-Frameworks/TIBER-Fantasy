import React, { useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Eye, TrendingUp, Trophy } from 'lucide-react';

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

interface RatingsResponse {
  ok: boolean;
  data: {
    position: string;
    format: string;
    rankings: PlayerRating[];
  };
}

const Rankings: React.FC = () => {
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | 'QB' | 'RB' | 'WR' | 'TE'>('ALL');
  const [selectedFormat, setSelectedFormat] = useState<'dynasty' | 'redraft' | 'superflex'>('dynasty');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'tier' | 'upside' | 'floor'>('rating');
  const [isPending, startTransition] = useTransition();

  const { data: rankingsResponse, isLoading, error } = useQuery<RatingsResponse>({
    queryKey: ['/api/ratings', selectedPosition, selectedFormat],
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle search with transition to prevent suspense boundary issues
  const handleSearch = (term: string) => {
    startTransition(() => {
      setSearchTerm(term);
    });
  };

  const handlePositionChange = (position: typeof selectedPosition) => {
    startTransition(() => {
      setSelectedPosition(position);
    });
  };

  const handleFormatChange = (format: typeof selectedFormat) => {
    startTransition(() => {
      setSelectedFormat(format);
    });
  };

  // Process and filter data
  const players = rankingsResponse?.data?.rankings || [];
  const filteredPlayers = players
    .filter(player => 
      searchTerm === '' || 
      player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.overall_rating - a.overall_rating;
        case 'tier': return a.tier.localeCompare(b.tier);
        case 'upside': return b.components.upside - a.components.upside;
        case 'floor': return b.components.floor - a.components.floor;
        default: return b.overall_rating - a.overall_rating;
      }
    });

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'S': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading || isPending) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-6"></div>
                <div className="flex space-x-4 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                  ))}
                </div>
                <div className="space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
              Rankings Data Unavailable
            </h3>
            <p className="text-red-600 dark:text-red-300">
              Unable to load player rankings. The ratings engine may be updating data or experiencing connectivity issues.
            </p>
            <p className="text-sm text-red-500 dark:text-red-400 mt-2">
              Error: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!players.length) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Rankings Available
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Player rankings are being generated. Check back soon for updated data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with sticky positioning */}
        <div className="sticky top-0 z-40 bg-gray-50 dark:bg-gray-900 pb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="flex flex-col space-y-4">
              {/* Title */}
              <div className="flex items-center space-x-2">
                <Trophy className="h-6 w-6 text-yellow-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Player Rankings
                </h1>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredPlayers.length} players
                </span>
              </div>

              {/* Position Tabs */}
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

              {/* Format & Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  {(['dynasty', 'redraft', 'superflex'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => handleFormatChange(format)}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                        selectedFormat === format
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="rating">Overall Rating</option>
                  <option value="tier">Tier</option>
                  <option value="upside">Upside</option>
                  <option value="floor">Floor</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Talent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Opportunity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Upside
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Floor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPlayers.map((player, index) => (
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      #{player.positional_rank}
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
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getTierBadgeColor(player.tier)}`}>
                        {player.tier}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {player.components.talent}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {player.components.opportunity}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {player.components.upside}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {player.components.floor}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Link href={`/player/${player.player_id}`}>
                        <button className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-yellow-600 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30 transition-colors">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance Footer */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Loaded {filteredPlayers.length} players in {selectedFormat} format • 
            Last updated: {players[0]?.last_updated ? new Date(players[0].last_updated).toLocaleTimeString() : 'Unknown'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Rankings;
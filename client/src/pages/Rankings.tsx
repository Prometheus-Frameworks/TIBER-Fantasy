import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface PlayerRankingData {
  player_name?: string;
  name?: string;
  team: string;
  rating?: number;
  adjusted_rating?: number;
  archetype_tag?: string;
  archetype?: string;
  fpg?: number;
  vorp?: number;
  compass?: {
    score: number;
    north?: number;
    east?: number;
    south?: number;
    west?: number;
  };
  dynastyScore?: number;
  projected_points?: number;
  adp?: number;
  position?: string;
}

const Rankings: React.FC = () => {
  const [selectedPosition, setSelectedPosition] = useState<'WR' | 'RB' | 'QB' | 'TE'>('WR');
  
  // Force cache refresh when position changes
  const apiEndpoint = selectedPosition === 'RB' ? '/api/rb-compass' : `/api/compass/${selectedPosition.toLowerCase()}`;
  
  const { data: rankingsResponse, isLoading, error, refetch } = useQuery({
    queryKey: [apiEndpoint, selectedPosition],
    retry: false,
    staleTime: 0, // Always refetch
    cacheTime: 0, // Don't cache
  });

  // Force refresh when position changes
  React.useEffect(() => {
    refetch();
  }, [selectedPosition, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">{selectedPosition} Rankings 2024</h1>
          <p className="text-sm text-gray-500 mb-4">Loading from: {apiEndpoint}</p>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('Rankings API Error:', error);
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">{selectedPosition} Rankings 2024</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">
              Error loading {selectedPosition} rankings data.
            </p>
            <p className="text-red-600 text-sm mt-2">
              API Endpoint: {apiEndpoint}
            </p>
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Hard Refresh Page
            </button>
            <button 
              onClick={() => refetch()} 
              className="mt-4 ml-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Retry Request
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle different response formats for RB vs WR
  const rankings: PlayerRankingData[] = selectedPosition === 'RB' 
    ? (rankingsResponse?.rb_compass || []).map((rb: any) => ({
        player_name: rb.player_name,
        name: rb.player_name,
        team: rb.team,
        position: 'RB',
        compass: {
          score: rb.compass_scores?.final_score || 0,
          north: rb.compass_scores?.north || 0,
          east: rb.compass_scores?.east || 0,
          south: rb.compass_scores?.south || 0,
          west: rb.compass_scores?.west || 0
        },
        dynastyScore: rb.compass_scores?.final_score || 0,
        projected_points: rb.season_stats?.total_carries || 0,
        archetype: rb.compass_scores?.tier || 'N/A',
        fpg: rb.season_stats?.total_carries || 0,
        vorp: rb.compass_scores?.final_score || 0
      }))
    : (rankingsResponse?.rankings || []);
  
  // Debug logging
  console.log('Rankings Response:', {
    position: selectedPosition,
    apiEndpoint,
    hasResponse: !!rankingsResponse,
    success: rankingsResponse?.success,
    rankingsCount: rankings.length,
    algorithm: rankingsResponse?.algorithm,
    rbCompassCount: rankingsResponse?.rb_compass?.length,
    totalPlayers: rankingsResponse?.total_players
  });

  const getArchetypeColor = (archetype: string) => {
    switch (archetype) {
      case 'efficient alpha':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'explosive outlier':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'deep threat':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'volume slot':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'balanced':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 95) return 'text-purple-700 font-bold';
    if (rating >= 90) return 'text-blue-700 font-bold';
    if (rating >= 85) return 'text-green-700 font-semibold';
    if (rating >= 80) return 'text-yellow-700 font-semibold';
    if (rating >= 75) return 'text-orange-700';
    return 'text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">{selectedPosition} Rankings 2024</h1>
            <select 
              className="border rounded px-3 py-2"
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value as 'WR' | 'RB' | 'QB' | 'TE')}
            >
              <option value="WR">Wide Receivers</option>
              <option value="RB">Running Backs</option>
              <option value="QB">Quarterbacks (Coming Soon)</option>
              <option value="TE">Tight Ends (Coming Soon)</option>
            </select>
          </div>
          <p className="text-gray-600">
            {selectedPosition === 'WR' ? 'Based on adjusted ratings from WR_2024_Ratings_With_Tags.csv' : 
             selectedPosition === 'RB' ? 'Based on authentic RB compass methodology with 4-directional scoring' : 
             'Coming Soon'}
          </p>
          <div className="mt-4 text-sm text-gray-500">
            Total Players: {rankings.length} | 
            {selectedPosition === 'RB' ? 'Data Source: RB Compass System' : 'Data Source: CSV File'} |
            API: {apiEndpoint}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archetype
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedPosition === 'RB' ? 'Proj Pts' : 'FPG'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {selectedPosition === 'RB' ? 'Compass' : 'VORP'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rankings.map((player, index) => (
                  <tr 
                    key={`${player.name || player.player_name}-${index}`} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      // Navigate to player profile page
                      window.location.href = `/player/${encodeURIComponent(player.name || player.player_name || '')}`;
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {player.name || player.player_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {player.team}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={getRatingColor(player.rating || player.adjusted_rating || 0)}>
                        {player.rating || player.adjusted_rating || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getArchetypeColor(player.archetype || player.archetype_tag || 'balanced')}`}>
                        {player.archetype || player.archetype_tag || 'balanced'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {selectedPosition === 'RB' ? (player.projected_points?.toFixed(0) || 'N/A') : (player.fpg?.toFixed(1) || 'N/A')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {selectedPosition === 'RB' ? (player.compass?.score?.toFixed(1) || 'N/A') : (player.vorp?.toFixed(2) || 'N/A')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Rankings;
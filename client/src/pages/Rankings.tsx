import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface WRRankingData {
  name: string;
  team: string;
  rating: number;
  archetype: string;
  fpg: number;
  vorp: number;
}

const Rankings: React.FC = () => {
  const { data: rankingsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/wr-ratings/rankings'],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">WR Rankings 2024</h1>
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

  if (error || !rankingsResponse?.success) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">WR Rankings 2024</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">
              Error loading rankings data. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const rankings: WRRankingData[] = rankingsResponse.data || [];

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">WR Rankings 2024</h1>
          <p className="text-gray-600">
            Based on adjusted ratings from WR_2024_Ratings_With_Tags.csv
          </p>
          <div className="mt-4 text-sm text-gray-500">
            Total Players: {rankings.length} | Data Source: CSV File
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
                    FPG
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VORP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rankings.map((player, index) => (
                  <tr 
                    key={`${player.name}-${index}`} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      // Navigate to player profile page
                      window.location.href = `/player/${encodeURIComponent(player.name)}`;
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {player.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {player.team}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={getRatingColor(player.rating)}>
                        {player.rating}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getArchetypeColor(player.archetype)}`}>
                        {player.archetype}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {player.fpg.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {player.vorp.toFixed(2)}
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
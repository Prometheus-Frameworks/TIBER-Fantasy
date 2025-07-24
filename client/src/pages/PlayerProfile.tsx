import React from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface WRPlayerProfile {
  player_name: string;
  team: string;
  games_played_x: number;
  total_points: number;
  fpg: number;
  vorp: number;
  rating: number;
  adjusted_rating: number;
  ypc: number;
  ypt: number;
  rush_ypc: number;
  targets: number;
  receptions: number;
  rec_yards: number;
  games_played_y: number;
  archetype_tag: string;
}

const PlayerProfile: React.FC = () => {
  const { playerName } = useParams<{ playerName: string }>();
  
  const { data: playerResponse, isLoading, error } = useQuery({
    queryKey: [`/api/wr-ratings/player/${playerName}`],
    enabled: !!playerName,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !playerResponse?.success) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Player Not Found</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">
              Player "{playerName}" not found in WR ratings data.
            </p>
            <button 
              onClick={() => window.location.href = '/rankings'}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Rankings
            </button>
          </div>
        </div>
      </div>
    );
  }

  const player: WRPlayerProfile = playerResponse.data;

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

  const statCards = [
    { label: 'Fantasy Points per Game', value: player.fpg.toFixed(1), desc: 'PPR scoring' },
    { label: 'VORP', value: player.vorp.toFixed(2), desc: 'Value over replacement player' },
    { label: 'Adjusted Rating', value: player.adjusted_rating.toString(), desc: 'Performance rating' },
    { label: 'Yards per Catch', value: player.ypc.toFixed(1), desc: 'Receiving efficiency' },
    { label: 'Yards per Target', value: player.ypt.toFixed(1), desc: 'Target efficiency' },
    { label: 'Rush YPC', value: player.rush_ypc === 0 ? 'N/A' : player.rush_ypc.toFixed(1), desc: 'Rushing yards per carry' },
    { label: 'Targets', value: player.targets.toString(), desc: 'Total targets received' },
    { label: 'Receptions', value: player.receptions.toString(), desc: 'Total catches made' },
    { label: 'Receiving Yards', value: player.rec_yards.toString(), desc: 'Total receiving yards' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => window.location.href = '/rankings'}
            className="mb-4 inline-flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Rankings
          </button>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{player.player_name}</h1>
                <div className="mt-2 flex items-center space-x-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    {player.team}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getArchetypeColor(player.archetype_tag)}`}>
                    {player.archetype_tag}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">{player.adjusted_rating}</div>
                <div className="text-sm text-gray-500">Adjusted Rating</div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{player.fpg.toFixed(1)}</div>
              <div className="text-sm text-gray-500">Fantasy Points per Game</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{player.vorp.toFixed(2)}</div>
              <div className="text-sm text-gray-500">VORP</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{player.games_played_x}</div>
              <div className="text-sm text-gray-500">Games Played</div>
            </div>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">2024 Season Statistics</h2>
            <p className="text-sm text-gray-500 mt-1">All data from WR_2024_Ratings_With_Tags.csv</p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {statCards.map((stat, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm font-medium text-gray-700 mt-1">{stat.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Data Source</h3>
          <p className="text-blue-800 text-sm">
            All statistics displayed are sourced directly from the WR_2024_Ratings_With_Tags.csv file. 
            No calculations or inferences have been made - these are the exact values as provided.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TiberPlayer {
  name: string;
  position: 'WR' | 'TE';
  team: string;
  tiberScore: number;
  tier: 'breakout' | 'stable' | 'regression';
  positionalRank: number;
  tiberRank: string;
}

interface TiberRankingsResponse {
  success: boolean;
  data: {
    week: number;
    season: number;
    total: number;
    wrCount: number;
    teCount: number;
    players: TiberPlayer[];
  };
}

export default function RankingsTab() {
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | 'WR' | 'TE'>('ALL');

  const { data, isLoading } = useQuery<TiberRankingsResponse>({
    queryKey: ['/api/tiber/rankings', 8, 2025],
    queryFn: async () => {
      const res = await fetch('/api/tiber/rankings?week=8&season=2025&limit=150');
      if (!res.ok) throw new Error('Failed to fetch TIBER rankings');
      return res.json();
    }
  });

  const allPlayers = data?.data?.players || [];
  const players = selectedPosition === 'ALL' 
    ? allPlayers 
    : allPlayers.filter(p => p.position === selectedPosition);

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      breakout: 'from-green-500 to-green-700',
      stable: 'from-blue-500 to-blue-700',
      regression: 'from-red-500 to-red-700',
    };
    return colors[tier] || colors.stable;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">TIBER Rankings</h2>
        <p className="text-gray-400 mt-1">
          WR/TE • Week {data?.data?.week || 8} • 2025 Season
        </p>
      </div>

      {/* Position Filters */}
      <div className="flex gap-2">
        {['ALL', 'WR', 'TE'].map(pos => (
          <button
            key={pos}
            onClick={() => setSelectedPosition(pos as 'ALL' | 'WR' | 'TE')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              selectedPosition === pos
                ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/50 text-white'
                : 'bg-[#141824] text-gray-400 hover:text-gray-300 border border-gray-800'
            }`}
            data-testid={`button-filter-${pos.toLowerCase()}`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Player Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(10)].map((_, idx) => (
            <div key={idx} className="bg-[#141824] border border-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-16 bg-gray-700/30 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {players.map((player, idx) => (
            <div
              key={`${player.name}-${idx}`}
              className="bg-[#141824] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
              data-testid={`player-card-${idx}`}
            >
              <div className="flex items-center justify-between">
                {/* Left: Rank & Player Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-2xl font-bold text-gray-500 w-12 text-center">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{player.name}</h3>
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-sm font-medium">
                        {player.team}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                      <span>{player.position}</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-300">Bye: TBD</span>
                    </div>
                  </div>
                </div>

                {/* Right: TIBER Score Badge */}
                <div className="flex flex-col items-end gap-1">
                  <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${getTierColor(player.tier)} font-bold text-white text-lg`}>
                    {player.tiberRank}
                  </div>
                  <div className="text-xs text-gray-500 uppercase">
                    TIBER Score
                  </div>
                </div>
              </div>
            </div>
          ))}

          {players.length === 0 && !isLoading && (
            <div className="text-center py-12 text-gray-500">
              No players found for this position
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        {data?.data?.season || 2025} Season • Week {data?.data?.week || 8} • Data from NFLfastR
      </div>
    </div>
  );
}

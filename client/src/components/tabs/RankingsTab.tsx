import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  const [wrExpanded, setWrExpanded] = useState(true);
  const [teExpanded, setTeExpanded] = useState(true);

  const { data, isLoading } = useQuery<TiberRankingsResponse>({
    queryKey: ['/api/tiber/rankings', 8, 2025],
    queryFn: async () => {
      const res = await fetch('/api/tiber/rankings?week=8&season=2025&limit=150');
      if (!res.ok) throw new Error('Failed to fetch TIBER rankings');
      return res.json();
    }
  });

  const allPlayers = data?.data?.players || [];
  const wrPlayers = allPlayers.filter(p => p.position === 'WR');
  const tePlayers = allPlayers.filter(p => p.position === 'TE');

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      breakout: 'from-green-500 to-green-700',
      stable: 'from-blue-500 to-blue-700',
      regression: 'from-red-500 to-red-700',
    };
    return colors[tier] || colors.stable;
  };

  const renderPlayerSection = (players: TiberPlayer[], position: 'WR' | 'TE', expanded: boolean, setExpanded: (val: boolean) => void) => (
    <div className="bg-[#141824] border border-gray-800 rounded-lg overflow-hidden">
      {/* Section Header Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1a1f2e] transition-colors"
        data-testid={`button-toggle-${position.toLowerCase()}`}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="text-gray-400" size={20} /> : <ChevronRight className="text-gray-400" size={20} />}
          <h3 className="text-xl font-bold text-white">{position === 'WR' ? 'Wide Receivers' : 'Tight Ends'}</h3>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full text-sm font-medium">
            {players.length}
          </span>
        </div>
      </button>

      {/* Player List */}
      {expanded && (
        <div className="border-t border-gray-800">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="h-16 bg-gray-700/30 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {players.map((player, idx) => (
                <div
                  key={`${player.name}-${idx}`}
                  className="px-6 py-4 hover:bg-[#1a1f2e] transition-colors"
                  data-testid={`player-card-${position.toLowerCase()}-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    {/* Left: Rank & Player Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-xl font-bold text-gray-500 w-10">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-bold text-white">{player.name}</h4>
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-xs font-medium">
                            {player.team}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: TIBER Score - Smaller text-like display */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">TIBER:</span>
                      <span className={`px-3 py-1 rounded bg-gradient-to-r ${getTierColor(player.tier)} font-bold text-white text-sm`}>
                        {player.tiberRank}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {players.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No {position} players available
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">TIBER Rankings</h2>
        <p className="text-gray-400 mt-1">
          WR/TE • Week {data?.data?.week || 8} • 2025 Season
        </p>
      </div>

      {/* Wide Receivers Section */}
      {renderPlayerSection(wrPlayers, 'WR', wrExpanded, setWrExpanded)}

      {/* Tight Ends Section */}
      {renderPlayerSection(tePlayers, 'TE', teExpanded, setTeExpanded)}

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-500">
        {data?.data?.season || 2025} Season • Week {data?.data?.week || 8} • Data from NFLfastR
      </div>
    </div>
  );
}

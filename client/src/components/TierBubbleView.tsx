interface TierBubblePlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  average_rank: number;
  standard_deviation: number;
  min_rank: number;
  max_rank: number;
  rank_count: number;
}

interface TierBubble {
  tier_number: number;
  avg_rank_range: {
    min: number;
    max: number;
  };
  consensus_strength: 'tight' | 'loose';
  players: TierBubblePlayer[];
}

interface TierBubbleViewProps {
  tierBubbles: TierBubble[];
  isLoading?: boolean;
}

export default function TierBubbleView({ tierBubbles, isLoading }: TierBubbleViewProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading tier bubbles...
      </div>
    );
  }

  if (!tierBubbles || tierBubbles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tier data available
      </div>
    );
  }

  const getTierColors = (tierNumber: number) => {
    const colors = [
      'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700',
      'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700',
      'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700',
      'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700',
      'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-700',
      'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700',
    ];
    return colors[(tierNumber - 1) % colors.length];
  };

  // Sort players alphabetically within each tier to avoid ranking bias
  const sortedTierBubbles = tierBubbles.map(tier => ({
    ...tier,
    players: [...tier.players].sort((a, b) => a.player_name.localeCompare(b.player_name))
  }));

  return (
    <div className="bubble-container space-y-6">
      {sortedTierBubbles.map((tier) => (
        <div key={tier.tier_number} className="tier-section">
          {/* Tier Label */}
          <div className="tier-label text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Tier {tier.tier_number}
          </div>
          
          {/* Bubble - Horizontal Row of Player Cards */}
          <div className={`bubble border-2 rounded-lg p-4 ${getTierColors(tier.tier_number)}`}>
            <div className="flex flex-wrap gap-3">
              {tier.players.map((player) => (
                <div
                  key={player.player_id}
                  className="player-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 min-w-0 flex-1 min-w-[160px] max-w-[200px] cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    // Future: Open player details modal
                    console.log('Player details:', player);
                  }}
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {player.player_name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {player.position} – {player.team}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Avg: {player.average_rank.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
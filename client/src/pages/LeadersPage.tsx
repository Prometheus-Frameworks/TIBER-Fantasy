import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TeamLogo } from "@/components/TeamLogo";

type Position = 'RB' | 'WR' | 'TE' | 'QB';

type PlayerStat = {
  id: number;
  playerName: string;
  position: string;
  team: string;
  games: number;
  fpts: number;
  fptsPpr: number;
  // Position-specific stats will be accessed dynamically
  [key: string]: any;
};

// Live metrics (v1) - Available for query
const LIVE_METRICS = {
  RB: [
    { key: 'fpts_ppr', label: 'Fantasy Points (PPR)' },
    { key: 'rush_yards', label: 'Rushing Yards' },
    { key: 'rush_att', label: 'Rush Attempts' },
    { key: 'rush_ypc', label: 'Yards per Carry' },
    { key: 'targets', label: 'Targets' },
    { key: 'rec_yards', label: 'Receiving Yards' },
    { key: 'td_total', label: 'Total TDs' },
    { key: 'fpts', label: 'Standard Points' }
  ],
  WR: [
    { key: 'fpts_ppr', label: 'Fantasy Points (PPR)' },
    { key: 'targets', label: 'Targets' },
    { key: 'receptions', label: 'Receptions' },
    { key: 'rec_yards', label: 'Receiving Yards' },
    { key: 'rec_tds', label: 'Receiving TDs' },
    { key: 'fpts', label: 'Standard Points' }
  ],
  TE: [
    { key: 'fpts_ppr', label: 'Fantasy Points (PPR)' },
    { key: 'targets', label: 'Targets' },
    { key: 'receptions', label: 'Receptions' },
    { key: 'rec_yards', label: 'Receiving Yards' },
    { key: 'rec_tds', label: 'Receiving TDs' },
    { key: 'fpts', label: 'Standard Points' }
  ],
  QB: [
    { key: 'fpts', label: 'Fantasy Points' },
    { key: 'pass_yards', label: 'Passing Yards' },
    { key: 'pass_tds', label: 'Passing TDs' },
    { key: 'cmp_pct', label: 'Completion %' },
    { key: 'int', label: 'Interceptions' },
    { key: 'ypa', label: 'Yards per Attempt' },
    { key: 'aypa', label: 'Adjusted YPA' },
    { key: 'qb_rush_yards', label: 'Rushing Yards' },
    { key: 'qb_rush_tds', label: 'Rushing TDs' }
  ]
};

// Coming Soon metrics - Not queryable yet
const COMING_SOON_METRICS = {
  RB: [
    { key: 'rush_yac_per_att', label: 'YAC/Att', badge: 'NGS' },
    { key: 'rush_mtf', label: 'MTF Rate', badge: 'NGS' },
    { key: 'rush_expl_10p', label: 'Explosive %', badge: 'PBP' },
    { key: 'yprr', label: 'Yards per Route Run', badge: 'PBP' }
  ],
  WR: [
    { key: 'adot', label: 'Average Depth of Target', badge: 'PBP' },
    { key: 'yprr', label: 'Yards per Route Run', badge: 'PBP' },
    { key: 'racr', label: 'RACR', badge: 'PBP' },
    { key: 'target_share', label: 'Target Share %', badge: 'PBP' },
    { key: 'wopr', label: 'WOPR', badge: 'PBP' }
  ],
  TE: [
    { key: 'yprr', label: 'Yards per Route Run', badge: 'PBP' },
    { key: 'target_share', label: 'Target Share %', badge: 'PBP' }
  ],
  QB: [
    { key: 'epa_per_play', label: 'EPA/Play', badge: 'PBP' }
  ]
};

export default function LeadersPage() {
  const [position, setPosition] = useState<Position>('RB');
  const [metric, setMetric] = useState('fpts_ppr');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [minGames, setMinGames] = useState(8);
  const [minRoutes, setMinRoutes] = useState(150);
  const [minAtt, setMinAtt] = useState(100);
  const [minAttQB, setMinAttQB] = useState(250);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Update metric when position changes
  useEffect(() => {
    setMetric(LIVE_METRICS[position][0].key);
  }, [position]);

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['/api/stats/2024/leaderboard', position, metric, direction, minGames, minRoutes, minAtt, minAttQB],
    queryFn: async () => {
      const params = new URLSearchParams({
        position,
        metric,
        dir: direction,
        limit: '50',
        min_games: minGames.toString(),
        ...(position === 'RB' && { min_att: minAtt.toString() }),
        ...((position === 'WR' || position === 'TE') && { min_routes: minRoutes.toString() }),
        ...(position === 'QB' && { min_att_qb: minAttQB.toString() })
      });
      
      const response = await fetch(`/api/stats/2024/leaderboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    }
  });

  const players = Array.isArray(leaderboardData?.data) ? leaderboardData.data : [];
  
  // Filter by search term
  const filteredPlayers = players.filter((player: PlayerStat) =>
    player.playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get current position metrics
  const currentLiveMetrics = LIVE_METRICS[position];
  const currentComingSoonMetrics = COMING_SOON_METRICS[position];
  
  // Get metric display name
  const getMetricLabel = (key: string) => {
    const liveMetric = currentLiveMetrics.find(m => m.key === key);
    if (liveMetric) return liveMetric.label;
    
    const comingSoonMetric = currentComingSoonMetrics.find(m => m.key === key);
    return comingSoonMetric?.label || key;
  };

  // Format stat values
  const formatStat = (value: any, metricKey: string) => {
    if (value === null || value === undefined) return '—';
    
    // Percentage metrics
    if (metricKey.includes('pct') || metricKey.includes('share')) {
      return `${(value * 100).toFixed(1)}%`;
    }
    
    // Decimal metrics
    if (metricKey.includes('ypc') || metricKey.includes('ypa') || 
        metricKey.includes('yprr') || metricKey.includes('adot')) {
      return Number(value).toFixed(1);
    }
    
    // Integer metrics
    return Math.round(Number(value));
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">2024 Season Leaders</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Complete 2024 NFL season statistics and leaderboards by position
        </p>
      </div>

      {/* Position Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {(['RB', 'WR', 'TE', 'QB'] as Position[]).map((pos) => (
          <button
            key={pos}
            onClick={() => setPosition(pos)}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              position === pos
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {/* Metric and Direction */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metric
            </label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {/* Live Metrics - Available Now */}
              {currentLiveMetrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
              
              {/* Coming Soon - Disabled Options */}
              <optgroup label="🚧 Coming Soon (PBP/NGS)">
                {currentComingSoonMetrics.map((m) => (
                  <option key={m.key} value={m.key} disabled>
                    {m.label} ({m.badge})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sort Direction
            </label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="desc">Highest to Lowest</option>
              <option value="asc">Lowest to Highest</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum Games
            </label>
            <input
              type="number"
              value={minGames}
              onChange={(e) => setMinGames(parseInt(e.target.value) || 0)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              min="0"
              max="17"
            />
          </div>

          {position === 'RB' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Rush Attempts
              </label>
              <input
                type="number"
                value={minAtt}
                onChange={(e) => setMinAtt(parseInt(e.target.value) || 0)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                min="0"
              />
            </div>
          )}

          {(position === 'WR' || position === 'TE') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Routes
              </label>
              <input
                type="number"
                value={minRoutes}
                onChange={(e) => setMinRoutes(parseInt(e.target.value) || 0)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                min="0"
              />
            </div>
          )}

          {position === 'QB' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Pass Attempts
              </label>
              <input
                type="number"
                value={minAttQB}
                onChange={(e) => setMinAttQB(parseInt(e.target.value) || 0)}
                className="w-full border rounded-md px-3 py-2 text-sm"
                min="0"
              />
            </div>
          )}
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search Players
          </label>
          <input
            type="text"
            placeholder="Player name or team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Games
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {getMetricLabel(metric)}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fantasy Pts
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPlayers.map((player: PlayerStat, index: number) => (
                <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-medium">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {player.playerName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {player.position}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <TeamLogo team={player.team} size={20} />
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {player.team}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                    {player.games}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatStat(player[metric], metric)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                    {formatStat(position === 'QB' ? player.fpts : player.fptsPpr, 'fpts')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No players found matching your criteria.
            </p>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredPlayers.length} of {players.length} players
        {searchTerm && ` matching "${searchTerm}"`}
      </div>
    </div>
  );
}
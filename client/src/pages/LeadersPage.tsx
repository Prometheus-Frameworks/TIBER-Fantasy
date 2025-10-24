import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, TrendingUp } from 'lucide-react';

interface AnalyticsData {
  players: PlayerStat[];
  week: string;
  season: number;
  position: string;
  stat: string;
}

interface PlayerStat {
  name: string;
  value: number;
  team: string;
}

type Position = 'QB' | 'RB' | 'WR' | 'TE';

const POSITION_STATS: Record<Position, { value: string; label: string }[]> = {
  QB: [
    { value: 'pass_yards', label: 'Passing Yards' },
    { value: 'pass_td', label: 'Passing TDs' },
    { value: 'completions', label: 'Completions' },
    { value: 'attempts', label: 'Pass Attempts' },
    { value: 'completion_pct', label: 'Completion %' },
  ],
  RB: [
    { value: 'rush_yards', label: 'Rushing Yards' },
    { value: 'rush_td', label: 'Rushing TDs' },
    { value: 'rush_att', label: 'Rush Attempts' },
    { value: 'targets', label: 'Targets' },
    { value: 'receptions', label: 'Receptions' },
    { value: 'rec_yards', label: 'Receiving Yards' },
    { value: 'rec_td', label: 'Receiving TDs' },
  ],
  WR: [
    { value: 'targets', label: 'Targets' },
    { value: 'receptions', label: 'Receptions' },
    { value: 'rec_yards', label: 'Receiving Yards' },
    { value: 'rec_td', label: 'Receiving TDs' },
    { value: 'ypr', label: 'Yards per Reception' },
  ],
  TE: [
    { value: 'targets', label: 'Targets' },
    { value: 'receptions', label: 'Receptions' },
    { value: 'rec_yards', label: 'Receiving Yards' },
    { value: 'rec_td', label: 'Receiving TDs' },
    { value: 'ypr', label: 'Yards per Reception' },
  ],
};

export default function LeadersPage() {
  const [position, setPosition] = useState<Position>('QB');
  const [stat, setStat] = useState('pass_yards');

  // Update stat when position changes
  const handlePositionChange = (newPosition: Position) => {
    setPosition(newPosition);
    setStat(POSITION_STATS[newPosition][0].value);
  };

  const { data, isLoading } = useQuery<{ success: boolean; data: AnalyticsData }>({
    queryKey: [`/api/analytics?position=${position}&stat=${stat}`],
  });

  const leaders = data?.data?.players || [];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-gray-400 font-bold">{rank}</span>;
  };

  const getStatLabel = () => {
    const statOption = POSITION_STATS[position].find(s => s.value === stat);
    return statOption?.label || '';
  };

  const formatValue = (value: number, statKey: string) => {
    if (statKey === 'completion_pct' || statKey === 'ypr') {
      return value.toFixed(1);
    }
    return Math.round(value).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3" data-testid="header-leaders">
            <TrendingUp className="w-10 h-10 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              NFL Leaders
            </span>
          </h1>
          <p className="text-slate-400">
            2025 Season • Weeks {data?.data?.week || '1-7'}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur border border-purple-500/20 rounded-xl p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Position Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Position
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['QB', 'RB', 'WR', 'TE'] as Position[]).map(pos => (
                  <button
                    key={pos}
                    onClick={() => handlePositionChange(pos)}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                      position === pos
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                    data-testid={`button-position-${pos.toLowerCase()}`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Stat Category Dropdown */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Statistical Category
              </label>
              <select
                value={stat}
                onChange={(e) => setStat(e.target.value)}
                className="w-full bg-white/10 border border-purple-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="select-stat-category"
              >
                {POSITION_STATS[position].map(statOption => (
                  <option key={statOption.value} value={statOption.value} className="bg-slate-800">
                    {statOption.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white/5 backdrop-blur border border-purple-500/20 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-purple-500/20 px-6 py-4">
            <h2 className="text-xl font-bold text-white">
              Top {position} by {getStatLabel()}
            </h2>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              <p className="mt-4 text-slate-400">Loading leaders...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-leaderboard">
                <thead>
                  <tr className="border-b border-purple-500/20">
                    <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Rank</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Player</th>
                    <th className="text-left px-6 py-4 text-slate-400 font-medium text-sm">Team</th>
                    <th className="text-right px-6 py-4 text-slate-400 font-medium text-sm">{getStatLabel()}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((leader, index) => (
                    <tr
                      key={`${leader.name}-${index}`}
                      className={`border-b border-purple-500/10 hover:bg-white/5 transition-colors ${
                        index < 3 ? 'bg-gradient-to-r from-purple-500/5 to-pink-500/5' : ''
                      }`}
                      data-testid={`row-player-${index}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center w-8">
                          {getRankIcon(index + 1)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white font-semibold text-base" data-testid={`text-player-name-${index}`}>
                          {leader.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 px-3 py-1 rounded-full text-sm font-medium border border-purple-500/30">
                          {leader.team}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-white font-bold text-lg">
                          {formatValue(leader.value, stat)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {leaders.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  No data available for this category
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-400">
          {data?.data?.season || 2025} Season • Data from NFLfastR
        </div>
      </div>
    </div>
  );
}

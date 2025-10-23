import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award } from 'lucide-react';

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

const POSITION_COLORS: Record<Position, string> = {
  QB: 'text-blue-400',
  RB: 'text-green-400',
  WR: 'text-purple-400',
  TE: 'text-amber-400',
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

  const leaderboardData = data?.data?.players || [];
  const positionColor = POSITION_COLORS[position];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-300" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return null;
  };

  const formatValue = (value: number, statKey: string) => {
    if (statKey === 'completion_pct' || statKey === 'ypr') {
      return value.toFixed(1);
    }
    return Math.round(value).toString();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-white" data-testid="header-leaders">
              Leaders
            </h1>
          </div>
          <p className="text-gray-400">
            Top performers by position • 2025 Season Weeks 1-7
          </p>
        </div>

        {/* DEBUG PANEL */}
        {leaderboardData.length > 0 && (
          <Card className="bg-yellow-900/20 border-yellow-500/50">
            <CardHeader>
              <CardTitle className="text-yellow-400">DEBUG INFO</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-white text-xs overflow-auto">
                {JSON.stringify({ 
                  totalPlayers: leaderboardData.length,
                  firstPlayer: leaderboardData[0],
                  firstPlayerName: leaderboardData[0]?.name,
                  nameType: typeof leaderboardData[0]?.name 
                }, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Position Toggles */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Position</label>
                <div className="flex gap-2">
                  {(['QB', 'RB', 'WR', 'TE'] as Position[]).map((pos) => (
                    <Button
                      key={pos}
                      onClick={() => handlePositionChange(pos)}
                      variant={position === pos ? 'default' : 'outline'}
                      className={position === pos ? 'bg-primary text-white' : 'text-gray-400'}
                      data-testid={`button-position-${pos.toLowerCase()}`}
                    >
                      {pos}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Stat Selector */}
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Category</label>
                <Select value={stat} onValueChange={setStat}>
                  <SelectTrigger className="bg-background/50" data-testid="select-stat-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_STATS[position].map((statOption) => (
                      <SelectItem key={statOption.value} value={statOption.value}>
                        {statOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard Table */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">
              {POSITION_STATS[position].find(s => s.value === stat)?.label || stat} Leaders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : leaderboardData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400">
                No data available for this position/stat combination
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-leaderboard">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400 w-16">Rank</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Player</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Team</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                        {POSITION_STATS[position].find(s => s.value === stat)?.label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((player, index) => (
                      <tr
                        key={`${player.name}-${index}`}
                        className="border-b border-border/30 hover:bg-accent/10 transition-colors"
                        data-testid={`row-player-${index}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getRankIcon(index + 1)}
                            <span className={`text-sm font-semibold ${index < 3 ? positionColor : 'text-gray-400'}`}>
                              {index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white font-medium" data-testid={`text-player-name-${index}`}>
                            {player.name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-400 text-sm">{player.team}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-bold ${index < 3 ? positionColor : 'text-white'}`}>
                            {formatValue(player.value, stat)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          {data?.data?.season || 2025} Season Weeks {data?.data?.week || '1-7'} • Data from NFLfastR
        </div>
      </div>
    </div>
  );
}

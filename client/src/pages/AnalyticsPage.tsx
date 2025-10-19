import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  QB: '#3b82f6', // blue
  RB: '#22c55e', // green
  WR: '#a855f7', // purple
  TE: '#f59e0b', // amber
};

export default function AnalyticsPage() {
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

  const chartData = data?.data.players || [];
  const positionColor = POSITION_COLORS[position];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-white" data-testid="header-title">
              Analytics
            </h1>
          </div>
          <p className="text-gray-400">
            Raw NFLfastR stats from 2025 weeks 1-6 • No analysis, just numbers
          </p>
        </div>

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
                <label className="text-sm text-gray-400 font-medium">Stat</label>
                <Select value={stat} onValueChange={setStat}>
                  <SelectTrigger className="bg-background/50" data-testid="select-stat">
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

        {/* Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">
              {POSITION_STATS[position].find(s => s.value === stat)?.label || stat} • 2025 Weeks 1-6
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-96 flex items-center justify-center text-gray-400">
                No data available for this position/stat combination
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: positionColor }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={positionColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Footer Info */}
        {data?.data && (
          <div className="text-center text-sm text-gray-400">
            Showing {chartData.length} {position} players • 2025 Season Weeks 1-6 • Data from NFLfastR
          </div>
        )}
      </div>
    </div>
  );
}

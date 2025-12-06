import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PlayerComparisonData {
  player1: PlayerData;
  player2: PlayerData;
  week: number;
  season: number;
}

interface PlayerData {
  name: string;
  position: string;
  team: string;
  recentStats: {
    targets: number;
    receptions: number;
    yards: number;
    touchdowns: number;
    fantasyPts: number;
    weeks: string;
  } | null;
  matchup: {
    opponent: string;
    dvpRank: string;
    fpAllowed: number;
  } | null;
  projection: number | null;
  notFound?: boolean;
}

function StatRow({ label, value1, value2, format = 'number' }: { label: string; value1: any; value2: any; format?: 'number' | 'text' }) {
  const formatValue = (val: any) => {
    if (val === null || val === undefined) return '-';
    if (format === 'number') return typeof val === 'number' ? val.toFixed(1) : val;
    return val;
  };

  const v1 = formatValue(value1);
  const v2 = formatValue(value2);

  const getComparison = () => {
    if (v1 === '-' || v2 === '-') return 'neutral';
    const num1 = parseFloat(v1);
    const num2 = parseFloat(v2);
    if (num1 > num2) return 'p1-better';
    if (num2 > num1) return 'p2-better';
    return 'neutral';
  };

  const comparison = format === 'number' ? getComparison() : 'neutral';

  return (
    <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 py-2 border-b border-border/30">
      <div className={`text-right font-medium ${comparison === 'p1-better' ? 'text-green-400' : comparison === 'p2-better' ? 'text-gray-400' : 'text-white'}`}>
        {v1}
      </div>
      <div className="text-center text-sm text-gray-400">
        {label}
      </div>
      <div className={`text-left font-medium ${comparison === 'p2-better' ? 'text-green-400' : comparison === 'p1-better' ? 'text-gray-400' : 'text-white'}`}>
        {v2}
      </div>
    </div>
  );
}

function PlayerCard({ player, side }: { player: PlayerData; side: 'left' | 'right' }) {
  if (player.notFound) {
    return (
      <div className="text-center py-8 text-gray-400">
        Player not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-white">{player.name}</h3>
        <div className="flex justify-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {player.position}
          </Badge>
          <Badge variant="outline">
            {player.team}
          </Badge>
        </div>
      </div>

      {player.matchup && (
        <div className="bg-card/30 rounded-lg p-4 space-y-1">
          <div className="text-sm text-gray-400">Week 7 Matchup</div>
          <div className="text-lg font-semibold text-white">vs {player.matchup.opponent}</div>
          <div className="text-sm text-gray-300">
            {player.matchup.dvpRank} • {player.matchup.fpAllowed.toFixed(1)} FPG allowed
          </div>
        </div>
      )}

      {player.projection !== null && (
        <div className="bg-card/30 rounded-lg p-4">
          <div className="text-sm text-gray-400">Projection</div>
          <div className="text-3xl font-bold text-primary">{player.projection.toFixed(1)}</div>
          <div className="text-xs text-gray-400">PPR Points</div>
        </div>
      )}
    </div>
  );
}

export default function PlayerComparePilot() {
  const [player1Input, setPlayer1Input] = useState('');
  const [player2Input, setPlayer2Input] = useState('');
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');

  const { data, isLoading } = useQuery<{ success: boolean; data: PlayerComparisonData }>({
    queryKey: [`/api/player-compare-pilot?player1=${encodeURIComponent(player1Name)}&player2=${encodeURIComponent(player2Name)}`],
    enabled: !!(player1Name && player2Name),
  });

  const handleCompare = () => {
    if (player1Input.trim() && player2Input.trim()) {
      setPlayer1Name(player1Input.trim());
      setPlayer2Name(player2Input.trim());
    }
  };

  const compData = data?.data;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Search className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-white" data-testid="header-title">
              Player Compare Pilot
            </h1>
          </div>
          <p className="text-gray-400">
            Side-by-side player research tool - Compare stats, matchups, and trends
          </p>
        </div>

        {/* Input Form */}
        <Card className="bg-[#141824] border-gray-700">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Player 1</label>
                <Input
                  placeholder="e.g., Romeo Doubs"
                  value={player1Input}
                  onChange={(e) => setPlayer1Input(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
                  className="bg-background/50"
                  data-testid="input-player1"
                />
              </div>
              <div className="text-center text-gray-400 pb-2 hidden md:block">vs</div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Player 2</label>
                <Input
                  placeholder="e.g., Kimani Vidal"
                  value={player2Input}
                  onChange={(e) => setPlayer2Input(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
                  className="bg-background/50"
                  data-testid="input-player2"
                />
              </div>
            </div>
            <Button
              onClick={handleCompare}
              className="w-full mt-4"
              disabled={!player1Input.trim() || !player2Input.trim()}
              data-testid="button-compare"
            >
              <Search className="h-4 w-4 mr-2" />
              Compare Players
            </Button>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        )}

        {/* Comparison Results */}
        {compData && !isLoading && (
          <div className="space-y-6">
            {/* Player Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-[#141824] border-gray-700">
                <CardContent className="pt-6">
                  <PlayerCard player={compData.player1} side="left" />
                </CardContent>
              </Card>
              <Card className="bg-[#141824] border-gray-700">
                <CardContent className="pt-6">
                  <PlayerCard player={compData.player2} side="right" />
                </CardContent>
              </Card>
            </div>

            {/* Stats Comparison */}
            {compData.player1.recentStats && compData.player2.recentStats && (
              <Card className="bg-[#141824] border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Recent Performance (Last 3 Weeks)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    <StatRow
                      label="Targets/Game"
                      value1={compData.player1.recentStats.targets}
                      value2={compData.player2.recentStats.targets}
                    />
                    <StatRow
                      label="Receptions/Game"
                      value1={compData.player1.recentStats.receptions}
                      value2={compData.player2.recentStats.receptions}
                    />
                    <StatRow
                      label="Yards/Game"
                      value1={compData.player1.recentStats.yards}
                      value2={compData.player2.recentStats.yards}
                    />
                    <StatRow
                      label="Touchdowns (Total)"
                      value1={compData.player1.recentStats.touchdowns}
                      value2={compData.player2.recentStats.touchdowns}
                    />
                    <StatRow
                      label="Fantasy PPR/Game"
                      value1={compData.player1.recentStats.fantasyPts}
                      value2={compData.player2.recentStats.fantasyPts}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-center text-sm text-gray-400">
              Data from Week {compData.week}, {compData.season} Season • Green highlights better value
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Minus, Activity, Crown, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface PowerRankingPlayer {
  player_id: string;
  name: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  power_score: number;
  rank: number;
  delta_w: number;
  confidence: number;
  flags: string[];
}

interface PowerRankingsResponse {
  season: number;
  week: number;
  ranking_type: string;
  generated_at: string;
  items: PowerRankingPlayer[];
}

const POSITION_COLORS = {
  QB: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  RB: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  WR: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  TE: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
};

// API client functions for Power Rankings
const fetchPowerRankings = async (type: string, season = 2025, week = 1): Promise<PowerRankingsResponse> => {
  const response = await fetch(`/api/power/${type}?season=${season}&week=${week}`);
  if (!response.ok) {
    throw new Error('Failed to fetch power rankings');
  }
  return response.json();
};

const DeltaIcon = ({ delta }: { delta: number }) => {
  if (delta > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (delta < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
};

const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
  const level = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
  const colors = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  };
  
  return (
    <Badge variant="outline" className={`text-xs ${colors[level]}`}>
      {Math.round(confidence * 100)}%
    </Badge>
  );
};

const PlayerRow = ({ player, index }: { player: PowerRankingPlayer; index: number }) => (
  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
      <div className="flex items-center gap-2">
        {index < 3 && <Crown className="h-4 w-4 text-yellow-500" />}
        #{player.rank}
      </div>
    </td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{player.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{player.team}</div>
        </div>
        <Badge className={POSITION_COLORS[player.position]}>
          {player.position}
        </Badge>
      </div>
    </td>
    <td className="px-4 py-3 font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
      {player.power_score.toFixed(1)}
    </td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-1">
        <DeltaIcon delta={player.delta_w} />
        <span className={`text-sm font-medium ${
          player.delta_w > 0 ? 'text-green-600' : 
          player.delta_w < 0 ? 'text-red-600' : 'text-gray-400'
        }`}>
          {player.delta_w === 0 ? '—' : 
           player.delta_w > 0 ? `+${player.delta_w}` : player.delta_w}
        </span>
      </div>
    </td>
    <td className="px-4 py-3">
      <ConfidenceBadge confidence={player.confidence} />
    </td>
  </tr>
);

export default function PowerRankings() {
  const [selectedTab, setSelectedTab] = useState('OVERALL');
  const [season] = useState(2025);
  const [week] = useState(1);

  const { data: rankings, isLoading, error } = useQuery({
    queryKey: ['/api/power', selectedTab, season, week],
    queryFn: () => fetchPowerRankings(selectedTab, season, week),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const tabs = [
    { value: 'OVERALL', label: 'Overall', icon: Activity },
    { value: 'QB', label: 'Quarterbacks', icon: Zap },
    { value: 'RB', label: 'Running Backs', icon: Zap },
    { value: 'WR', label: 'Wide Receivers', icon: Zap },
    { value: 'TE', label: 'Tight Ends', icon: Zap }
  ];

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="pt-6">
            <p className="text-red-800 dark:text-red-200">
              Unable to load power rankings. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          OTC Power Rankings
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Tiber's comprehensive power rankings driven by a 5-component scoring system. 
          Real-time updates from usage, talent, environment, availability, and market data.
        </p>
        {rankings && (
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>2025 Season • Week {week}</span>
            <span>•</span>
            <span>Updated {new Date(rankings.generated_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger 
                key={tab.value} 
                value={tab.value}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.value}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Rankings Table */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {tabs.find(t => t.value === selectedTab)?.label} Rankings
              </CardTitle>
              <CardDescription>
                Power scores reflect comprehensive player evaluation across multiple factors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : rankings?.items && rankings.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Player</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Power Score</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Weekly Δ</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.items.map((player, index) => (
                        <PlayerRow key={player.player_id} player={player} index={index} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No rankings available for this category
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>

      {/* Methodology */}
      <Card>
        <CardHeader>
          <CardTitle>Power Rankings Methodology</CardTitle>
          <CardDescription>
            Understanding Tiber's 5-component scoring system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Usage Now (40%)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current snap share, target share, and opportunity metrics
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Talent (25%)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Player skill evaluation and athletic ability
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Environment (20%)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Team offensive system and surrounding cast
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Availability (10%)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Health status and injury risk assessment
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Market Anchor (5%)</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ADP and consensus ranking positioning
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
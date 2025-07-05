import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Eye, Target, Zap } from "lucide-react";
import { Link } from "wouter";

interface TrendingPlayer {
  id: number;
  name: string;
  position: string;
  team: string;
  avgPoints: number;
  dynastyValue: number;
  dynastyTier: string;
  trendReason: string;
  trendType: 'breakout' | 'sleeper' | 'opportunity' | 'efficiency';
  metricsHighlight: string;
  ownershipPercentage: number;
  weeklyTrend: 'up' | 'down' | 'stable';
}

const TREND_TYPES = {
  breakout: { 
    icon: TrendingUp, 
    color: 'bg-green-500', 
    label: 'Breakout Alert',
    description: 'Strong recent performance'
  },
  sleeper: { 
    icon: Eye, 
    color: 'bg-blue-500', 
    label: 'Sleeper Pick',
    description: 'Low ownership, high upside'
  },
  opportunity: { 
    icon: Target, 
    color: 'bg-orange-500', 
    label: 'Opportunity',
    description: 'Increased role/targets'
  },
  efficiency: { 
    icon: Zap, 
    color: 'bg-purple-500', 
    label: 'Efficiency',
    description: 'Elite advanced metrics'
  }
};

export default function TrendingPlayers() {
  const { data: trendingPlayers, isLoading } = useQuery({
    queryKey: ["/api/players/trending"],
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Finding trending players...</p>
        </div>
      </div>
    );
  }

  const players = trendingPlayers || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Trending Players</h1>
        <p className="text-gray-600">
          Players with outlier advanced analytics - potential waiver wire gems
        </p>
      </div>

      {/* Trend Categories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(TREND_TYPES).map(([key, trend]) => {
          const Icon = trend.icon;
          const categoryPlayers = players.filter((p: TrendingPlayer) => p.trendType === key);
          
          return (
            <Card key={key} className="text-center">
              <CardContent className="pt-4">
                <div className={`w-12 h-12 ${trend.color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-medium text-sm">{trend.label}</h3>
                <p className="text-xs text-gray-500 mb-1">{trend.description}</p>
                <Badge variant="secondary" className="text-xs">
                  {categoryPlayers.length} players
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trending Players List */}
      <div className="space-y-4">
        {Object.entries(TREND_TYPES).map(([trendKey, trendInfo]) => {
          const categoryPlayers = players.filter((p: TrendingPlayer) => p.trendType === trendKey);
          
          if (categoryPlayers.length === 0) return null;

          const Icon = trendInfo.icon;

          return (
            <Card key={trendKey}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className={`w-8 h-8 ${trendInfo.color} rounded-full flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  {trendInfo.label}
                  <Badge variant="outline">{categoryPlayers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryPlayers.map((player: TrendingPlayer) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border">
                          <span className="text-sm font-bold text-gray-700">
                            {player.position}
                          </span>
                        </div>
                        
                        <div>
                          <Link 
                            href={`/player/${player.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                          >
                            {player.name}
                          </Link>
                          <div className="text-sm text-gray-500">
                            {player.team} • {player.avgPoints.toFixed(1)} PPG
                          </div>
                          <div className="text-sm text-blue-600 font-medium">
                            {player.trendReason}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="text-xs text-gray-500">Ownership</div>
                          <div className="text-sm font-medium">
                            {player.ownershipPercentage}%
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-gray-500">Dynasty Score</div>
                          <div className="text-sm font-medium">
                            {player.dynastyValue}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {player.weeklyTrend === 'up' && (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          )}
                          {player.weeklyTrend === 'down' && (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                          <Badge 
                            variant={player.dynastyTier === 'elite' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {player.dynastyTier}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No Players Message */}
      {players.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Trending Players</h3>
            <p className="text-gray-600">
              Check back later for players with outlier advanced analytics.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
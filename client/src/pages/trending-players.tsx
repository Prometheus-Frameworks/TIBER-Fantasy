import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Eye, Target, Zap, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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

  const handleCategoryClick = (categoryKey: string) => {
    setSelectedCategory(selectedCategory === categoryKey ? null : categoryKey);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
  };

  // If a category is selected, show detailed view
  if (selectedCategory) {
    const selectedTrend = TREND_TYPES[selectedCategory as keyof typeof TREND_TYPES];
    const categoryPlayers = players.filter((p: TrendingPlayer) => p.trendType === selectedCategory);
    const Icon = selectedTrend.icon;

    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Back Button and Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={handleBackToCategories}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${selectedTrend.color} rounded-full flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedTrend.label}</h1>
            </div>
            <p className="text-gray-600 mt-1">{selectedTrend.description}</p>
          </div>
        </div>

        {/* Category Players */}
        <div className="space-y-3">
          {categoryPlayers.length > 0 ? (
            categoryPlayers.map((player: TrendingPlayer) => (
              <Card key={player.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center border">
                        <span className="text-sm font-bold text-gray-700">
                          {player.position}
                        </span>
                      </div>
                      
                      <div>
                        <Link 
                          href={`/player/${player.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors text-lg"
                        >
                          {player.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-500">{player.team}</span>
                          <span className="text-sm font-medium">{player.avgPoints.toFixed(1)} PPG</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{player.trendReason}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
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
                      <div className="text-xs text-gray-500">
                        {player.ownershipPercentage}% owned
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No {selectedTrend.label} Players</h3>
                <p className="text-gray-600">
                  Check back later for players in this category.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Trending Players</h1>
        <p className="text-gray-600">
          Players with outlier advanced analytics - potential waiver wire gems
        </p>
      </div>

      {/* Interactive Category Cards */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(TREND_TYPES).map(([key, trend]) => {
          const Icon = trend.icon;
          const categoryPlayers = players.filter((p: TrendingPlayer) => p.trendType === key);
          
          return (
            <Card 
              key={key} 
              className="text-center cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
              onClick={() => handleCategoryClick(key)}
            >
              <CardContent className="pt-6 pb-4">
                <div className={`w-16 h-16 ${trend.color} rounded-full flex items-center justify-center mx-auto mb-3`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{trend.label}</h3>
                <p className="text-sm text-gray-500 mb-3">{trend.description}</p>
                <Badge variant="secondary" className="text-sm font-medium">
                  {categoryPlayers.length} players
                </Badge>
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
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Search, TrendingUp, TrendingDown, Target, Activity, BarChart3, Star, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PlayerProfile {
  id: number;
  name: string;
  team: string;
  position: string;
  age: number;
  experience: number;
  dynastyValue: number;
  dynastyTier: string;
  avgPoints: number;
  projectedPoints: number;
  adp: number;
  ownershipPercentage: number;
  targetShare?: number;
  snapShare?: number;
  redZoneTargets?: number;
  yardsPerRouteRun?: number;
  catchRate?: number;
  consistency: number;
  upside: number;
  sustainability: number;
  confidence: number;
  injuryStatus: string | null;
}

interface PlayerAnalytics {
  weeklyPerformance: Array<{
    week: number;
    points: number;
    projected: number;
    targets?: number;
    carries?: number;
  }>;
  marketComparison: {
    ourRank: number;
    adpRank: number;
    ecrRank: number;
    valueDifference: number;
    valueCategory: string;
  };
  strengthsAndConcerns: {
    strengths: string[];
    concerns: string[];
  };
  similarPlayers: Array<{
    name: string;
    similarity: number;
    reason: string;
  }>;
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'Elite': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Premium': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Strong': return 'bg-green-100 text-green-800 border-green-200';
    case 'Solid': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Depth': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Bench': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getValueColor = (category: string) => {
  switch (category) {
    case 'STEAL': return 'text-emerald-600 bg-emerald-50';
    case 'VALUE': return 'text-green-600 bg-green-50';
    case 'FAIR': return 'text-blue-600 bg-blue-50';
    case 'OVERVALUED': return 'text-orange-600 bg-orange-50';
    case 'AVOID': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

export default function PlayerProfile() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("all");

  // Get player profile data
  const { data: player, isLoading: playerLoading, error: playerError } = useQuery<PlayerProfile>({
    queryKey: ['/api/players', params.id],
    enabled: !!params.id,
    retry: false
  });

  // Get player analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<PlayerAnalytics>({
    queryKey: ['/api/players', params.id, 'analytics'],
    enabled: !!params.id,
    retry: false
  });

  // Search players for switching profiles
  const { data: searchResults = [], isLoading: searchLoading } = useQuery<PlayerProfile[]>({
    queryKey: [`/api/players/search?q=${encodeURIComponent(searchQuery)}&position=${selectedPosition}`],
    enabled: searchQuery.length >= 2,
    retry: false
  });

  const handlePlayerSelect = (playerId: number) => {
    setLocation(`/player/${playerId}`);
    setSearchQuery("");
  };

  if (playerLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading player profile...</p>
        </div>
      </div>
    );
  }

  if (playerError || !player) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Button onClick={() => setLocation('/rankings')} variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rankings
          </Button>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Player not found or failed to load profile data.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 md:px-6">
        <div className="flex items-center justify-between mb-4">
          <Button onClick={() => setLocation('/rankings')} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rankings
          </Button>
          
          {/* Player Search */}
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="QB">QB</SelectItem>
                <SelectItem value="RB">RB</SelectItem>
                <SelectItem value="WR">WR</SelectItem>
                <SelectItem value="TE">TE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-w-md right-4 mt-1">
            <div className="max-h-64 overflow-y-auto">
              {searchResults.slice(0, 8).map((searchPlayer: any) => (
                <button
                  key={searchPlayer.id}
                  onClick={() => handlePlayerSelect(searchPlayer.id)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{searchPlayer.name}</p>
                      <p className="text-sm text-gray-500">{searchPlayer.team} • {searchPlayer.position}</p>
                    </div>
                    <Badge className={getTierColor(searchPlayer.dynastyTier)} variant="outline">
                      {searchPlayer.dynastyTier}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Player Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              {player.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{player.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-lg font-medium text-gray-600">{player.team} • {player.position}</span>
                <Badge className={getTierColor(player.dynastyTier)} variant="outline">
                  {player.dynastyTier}
                </Badge>
                <span className="text-sm text-gray-500">Dynasty Score: {player.dynastyValue}</span>
              </div>
            </div>
          </div>

          {analytics?.marketComparison && (
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getValueColor(analytics.marketComparison.valueCategory)}`}>
                {analytics.marketComparison.valueCategory === 'STEAL' && <TrendingUp className="w-4 h-4 mr-1" />}
                {analytics.marketComparison.valueCategory === 'AVOID' && <TrendingDown className="w-4 h-4 mr-1" />}
                {analytics.marketComparison.valueCategory}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Our Rank: #{analytics.marketComparison.ourRank} vs ADP: #{analytics.marketComparison.adpRank}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Content */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="comparison">Market Value</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Basic Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Player Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Age:</span>
                    <span className="font-medium">{player.age} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Experience:</span>
                    <span className="font-medium">{player.experience} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">2024 PPG:</span>
                    <span className="font-medium">{player.avgPoints} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Projected 2025:</span>
                    <span className="font-medium">{player.projectedPoints} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ownership:</span>
                    <span className="font-medium">{player.ownershipPercentage}%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Dynasty Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-purple-600" />
                    Dynasty Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Dynasty Value</span>
                      <span className="text-sm font-medium">{player.dynastyValue}/100</span>
                    </div>
                    <Progress value={player.dynastyValue} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Consistency</span>
                      <span className="text-sm font-medium">{player.consistency}/100</span>
                    </div>
                    <Progress value={player.consistency} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Upside</span>
                      <span className="text-sm font-medium">{player.upside}/100</span>
                    </div>
                    <Progress value={player.upside} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Sustainability</span>
                      <span className="text-sm font-medium">{player.sustainability}/100</span>
                    </div>
                    <Progress value={player.sustainability} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Advanced Metrics */}
              {(player.targetShare || player.snapShare) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-green-600" />
                      Usage Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {player.targetShare && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Target Share:</span>
                        <span className="font-medium">{player.targetShare}%</span>
                      </div>
                    )}
                    {player.snapShare && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Snap Share:</span>
                        <span className="font-medium">{player.snapShare}%</span>
                      </div>
                    )}
                    {player.yardsPerRouteRun && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">YPRR:</span>
                        <span className="font-medium">{player.yardsPerRouteRun}</span>
                      </div>
                    )}
                    {player.catchRate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Catch Rate:</span>
                        <span className="font-medium">{player.catchRate}%</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Strengths and Concerns */}
            {analytics?.strengthsAndConcerns && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-700">Key Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analytics.strengthsAndConcerns.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-gray-700">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-orange-700">Areas of Concern</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analytics.strengthsAndConcerns.concerns.map((concern, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-gray-700">{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {analytics?.weeklyPerformance && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Weekly Performance (2024)
                  </CardTitle>
                  <CardDescription>Actual vs Projected fantasy points</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.weeklyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="points" stroke="#3b82f6" strokeWidth={2} name="Actual Points" />
                      <Line type="monotone" dataKey="projected" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Projected" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="text-center py-8">
              <p className="text-gray-500">Advanced analytics coming soon...</p>
              <p className="text-sm text-gray-400 mt-2">Full NFL Next Gen Stats integration and breakout analysis</p>
            </div>
          </TabsContent>

          {/* Market Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            {analytics?.marketComparison && (
              <Card>
                <CardHeader>
                  <CardTitle>Market Value Analysis</CardTitle>
                  <CardDescription>How our rankings compare to consensus market values</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Our Rank</p>
                      <p className="text-2xl font-bold text-blue-600">#{analytics.marketComparison.ourRank}</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">ADP Rank</p>
                      <p className="text-2xl font-bold text-gray-600">#{analytics.marketComparison.adpRank}</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Value Difference</p>
                      <p className="text-2xl font-bold text-green-600">
                        {analytics.marketComparison.valueDifference > 0 ? '+' : ''}
                        {analytics.marketComparison.valueDifference}
                      </p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg ${getValueColor(analytics.marketComparison.valueCategory)}`}>
                    <p className="font-medium">
                      Market Assessment: {analytics.marketComparison.valueCategory}
                    </p>
                    <p className="text-sm opacity-80 mt-1">
                      {analytics.marketComparison.valueCategory === 'STEAL' && 'Significantly undervalued by market - strong dynasty buy candidate'}
                      {analytics.marketComparison.valueCategory === 'VALUE' && 'Undervalued by market - good dynasty buy candidate'}
                      {analytics.marketComparison.valueCategory === 'FAIR' && 'Fairly valued by market - hold current position'}
                      {analytics.marketComparison.valueCategory === 'OVERVALUED' && 'Overvalued by market - consider selling high'}
                      {analytics.marketComparison.valueCategory === 'AVOID' && 'Significantly overvalued by market - strong sell candidate'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Similar Players */}
            {analytics?.similarPlayers && (
              <Card>
                <CardHeader>
                  <CardTitle>Similar Players</CardTitle>
                  <CardDescription>Players with comparable profiles and metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.similarPlayers.map((similar, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{similar.name}</p>
                          <p className="text-sm text-gray-600">{similar.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{similar.similarity}% match</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
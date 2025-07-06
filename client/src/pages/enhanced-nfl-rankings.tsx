/**
 * Enhanced NFL Rankings Page
 * Demonstrates our real-time analytics system using free data sources
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Zap, TrendingUp, TrendingDown, Target, BarChart3, Shield } from "lucide-react";
import { Link } from "wouter";

interface EnhancedPlayer {
  rank: number;
  name: string;
  position: string;
  team: string;
  dynastyScore: number;
  dynastyTier: string;
  avgPoints: number;
  adp: number;
  enhancedDynastyValue: number;
  confidenceScore: number;
  strengthsFromAPI: string[];
  concernsFromAPI: string[];
}

export default function EnhancedNFLRankings() {
  const [selectedPosition, setSelectedPosition] = useState<string>("all");

  const { data: enhancedPlayers = [], isLoading, error } = useQuery<EnhancedPlayer[]>({
    queryKey: [`/api/rankings/enhanced-nfl?position=${selectedPosition === "all" ? "" : selectedPosition}`],
    retry: false,
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'bg-purple-500 text-white';
      case 'Premium': return 'bg-blue-500 text-white';
      case 'Strong': return 'bg-green-500 text-white';
      case 'Solid': return 'bg-yellow-500 text-white';
      case 'Depth': return 'bg-orange-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Activity className="h-5 w-5" />
                Enhanced Analytics Unavailable
              </CardTitle>
              <CardDescription>
                Real-time NFL analytics will be available during the season with SportsDataIO integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Zap className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">
                  Our enhanced analytics system is ready for integration with authentic NFL data sources.
                </p>
                <Link href="/rankings">
                  <Button>View Standard Rankings</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Zap className="h-8 w-8 text-blue-600" />
                Enhanced NFL Analytics
              </h1>
              <p className="text-gray-600 mt-2">
                Dynasty rankings powered by real-time NFL advanced metrics from SportsDataIO
              </p>
            </div>
            <Badge variant="outline" className="px-3 py-1">
              <Shield className="h-4 w-4 mr-2" />
              Free Data Sources
            </Badge>
          </div>

          {/* Position Filter */}
          <div className="flex items-center gap-4">
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="QB">Quarterbacks</SelectItem>
                <SelectItem value="RB">Running Backs</SelectItem>
                <SelectItem value="WR">Wide Receivers</SelectItem>
                <SelectItem value="TE">Tight Ends</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              {enhancedPlayers.length} players analyzed
            </Badge>
          </div>
        </div>
      </div>

      {/* Enhanced Rankings */}
      <div className="p-4 max-w-7xl mx-auto">
        <Tabs defaultValue="rankings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="rankings">Enhanced Rankings</TabsTrigger>
            <TabsTrigger value="methodology">Methodology</TabsTrigger>
          </TabsList>

          <TabsContent value="rankings" className="space-y-4">
            {enhancedPlayers.map((player, index) => (
              <Card key={player.rank} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="text-2xl font-bold text-gray-500 w-8">
                        #{index + 1}
                      </div>

                      {/* Player Info */}
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <Link href={`/player/${player.rank}`}>
                            <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer">
                              {player.name}
                            </h3>
                          </Link>
                          <Badge className={getTierColor(player.dynastyTier)}>
                            {player.dynastyTier}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{player.team} • {player.position}</span>
                          <span>•</span>
                          <span>{player.avgPoints} PPG</span>
                          <span>•</span>
                          <span>ADP: {player.adp}</span>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Analytics */}
                    <div className="text-right">
                      <div className="flex items-center gap-4">
                        {/* Dynasty Value Comparison */}
                        <div className="text-center">
                          <div className="text-sm text-gray-500 mb-1">Enhanced Value</div>
                          <div className="text-xl font-bold text-blue-600">
                            {player.enhancedDynastyValue}/100
                          </div>
                          <div className="text-xs text-gray-500">
                            vs {player.dynastyScore} base
                          </div>
                        </div>

                        {/* Confidence Score */}
                        <div className="text-center">
                          <div className="text-sm text-gray-500 mb-1">Confidence</div>
                          <div className={`text-lg font-semibold ${getConfidenceColor(player.confidenceScore)}`}>
                            {player.confidenceScore}%
                          </div>
                          <Progress 
                            value={player.confidenceScore} 
                            className="w-16 h-2 mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analytics Insights */}
                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-green-600 mb-2 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Strengths from Analytics
                      </h4>
                      <ul className="space-y-1">
                        {player.strengthsFromAPI.slice(0, 2).map((strength, i) => (
                          <li key={i} className="text-sm text-gray-600">• {strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-orange-600 mb-2 flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" />
                        Areas of Concern
                      </h4>
                      <ul className="space-y-1">
                        {player.concernsFromAPI.length > 0 ? (
                          player.concernsFromAPI.slice(0, 2).map((concern, i) => (
                            <li key={i} className="text-sm text-gray-600">• {concern}</li>
                          ))
                        ) : (
                          <li className="text-sm text-gray-600">• No significant concerns identified</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="methodology" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Enhanced Analytics Methodology
                </CardTitle>
                <CardDescription>
                  How we integrate real-time NFL data with dynasty valuations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Data Sources */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Data Sources</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">SportsDataIO API</h4>
                      <p className="text-sm text-blue-700">
                        Real-time NFL statistics, advanced metrics, and player performance data
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Sleeper API</h4>
                      <p className="text-sm text-green-700">
                        Fantasy relevance data, ownership percentages, and trending analysis
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-medium text-purple-900 mb-2">NFL-Data-Py</h4>
                      <p className="text-sm text-purple-700">
                        Historical performance trends and comparative benchmarking
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analytics Framework */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Analytics Framework</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">Volume Metrics</span>
                      <span className="text-sm text-gray-600">40% weight - Target share, touches, snap count</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">Efficiency Metrics</span>
                      <span className="text-sm text-gray-600">25% weight - YPRR, YAC, success rate</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">Context Metrics</span>
                      <span className="text-sm text-gray-600">20% weight - Team offense, depth of target</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">Stability Metrics</span>
                      <span className="text-sm text-gray-600">15% weight - Consistency, injury history</span>
                    </div>
                  </div>
                </div>

                {/* Position-Specific Thresholds */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Elite Performance Thresholds</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Quarterbacks</h4>
                      <ul className="text-sm space-y-1 text-gray-600">
                        <li>• EPA per Play: 0.25+</li>
                        <li>• Adjusted Yards/Attempt: 8.5+</li>
                        <li>• CPOE: +2.0%</li>
                        <li>• Deep Ball Accuracy: 45%+</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Running Backs</h4>
                      <ul className="text-sm space-y-1 text-gray-600">
                        <li>• Success Rate: 50%+</li>
                        <li>• Yards After Contact: 2.5+</li>
                        <li>• Broken Tackle Rate: 15%+</li>
                        <li>• Workload Share: 25%+</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Wide Receivers</h4>
                      <ul className="text-sm space-y-1 text-gray-600">
                        <li>• Separation Rate: 75%+</li>
                        <li>• YAC per Reception: 6.0+</li>
                        <li>• CROE: +5.0%</li>
                        <li>• Air Yards Share: 25%+</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Tight Ends</h4>
                      <ul className="text-sm space-y-1 text-gray-600">
                        <li>• Separation Rate: 70%+</li>
                        <li>• YAC per Reception: 5.0+</li>
                        <li>• Red Zone Efficiency: 60%+</li>
                        <li>• Route Diversity: 0.85+</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
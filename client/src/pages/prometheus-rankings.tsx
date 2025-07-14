import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Trophy, Activity, Target, Clock, Zap } from 'lucide-react';

interface PrometheusPlayer {
  playerId: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age: number;
  
  games: number;
  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
  rushingYards?: number;
  rushingTds?: number;
  
  catchRate: number;
  yardsPerTarget: number;
  avgSeparation?: number;
  yacAboveExpected?: number;
  avgYac?: number;
  
  productionScore: number;
  opportunityScore: number;
  ageScore: number;
  efficiencyScore: number;
  stabilityScore: number;
  
  dynastyScore: number;
  prometheusRank: number;
  ecrRank?: number;
  rankVariance?: number;
  
  tier: 'Elite' | 'Premium' | 'Strong' | 'Solid' | 'Depth' | 'Bench';
  strengths: string[];
  concerns: string[];
  dynastyTrend: 'Rising' | 'Stable' | 'Declining';
}

interface PrometheusRankingsResponse {
  success: boolean;
  rankings: Record<string, PrometheusPlayer[]>;
  metadata: {
    source: string;
    methodology: string;
    weights: Record<string, string>;
    lastUpdated: string;
  };
}

export default function PrometheusRankings() {
  const [selectedPosition, setSelectedPosition] = useState<string>('WR');
  
  const { data: rankingsData, isLoading, error } = useQuery<PrometheusRankingsResponse>({
    queryKey: ['/api/rankings/prometheus'],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Rising': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'Declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'Stable': return <Minus className="h-4 w-4 text-gray-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 font-semibold';
    if (score >= 60) return 'text-blue-600 font-medium';
    if (score >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !rankingsData?.success) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-600">Error Loading Rankings</h3>
              <p className="text-gray-600 mt-2">Failed to load Prometheus dynasty rankings. Please try again later.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRankings = rankingsData.rankings[selectedPosition] || [];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Prometheus Dynasty Rankings</h1>
        </div>
        <p className="text-lg text-gray-600 mb-4">
          Elite dynasty analytics using current 2024 NFL data. Rankings powered by proprietary weighting system and advanced statistical analysis.
        </p>
        
        {/* Methodology Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Ranking Methodology</CardTitle>
            <CardDescription>Research-backed weighting system for dynasty value prediction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-semibold">Opportunity</div>
                  <div className="text-sm text-gray-600">35%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-semibold">Production</div>
                  <div className="text-sm text-gray-600">30%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-semibold">Age</div>
                  <div className="text-sm text-gray-600">20%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="font-semibold">Efficiency</div>
                  <div className="text-sm text-gray-600">10%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-semibold">Stability</div>
                  <div className="text-sm text-gray-600">5%</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Position Tabs */}
      <Tabs value={selectedPosition} onValueChange={setSelectedPosition} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="QB">Quarterbacks</TabsTrigger>
          <TabsTrigger value="RB">Running Backs</TabsTrigger>
          <TabsTrigger value="WR">Wide Receivers</TabsTrigger>
          <TabsTrigger value="TE">Tight Ends</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPosition} className="mt-6">
          <div className="space-y-4">
            {currentRankings.slice(0, 50).map((player, index) => (
              <Card key={player.playerId} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Player Info */}
                    <div className="lg:col-span-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl font-bold text-primary">#{player.prometheusRank}</span>
                            {getTrendIcon(player.dynastyTrend)}
                          </div>
                          <h3 className="text-xl font-semibold">{player.name}</h3>
                          <p className="text-gray-600">{player.team} • Age {player.age}</p>
                        </div>
                        <Badge className={getTierColor(player.tier)}>
                          {player.tier}
                        </Badge>
                      </div>
                      
                      <div className="mb-3">
                        <div className="text-2xl font-bold text-primary mb-1">
                          {player.dynastyScore}
                        </div>
                        <div className="text-sm text-gray-600">Dynasty Score</div>
                      </div>
                    </div>

                    {/* Component Scores */}
                    <div className="lg:col-span-1">
                      <h4 className="font-semibold mb-3">Component Scores</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Production</span>
                          <span className={`text-sm ${getScoreColor(player.productionScore)}`}>
                            {player.productionScore}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Opportunity</span>
                          <span className={`text-sm ${getScoreColor(player.opportunityScore)}`}>
                            {player.opportunityScore}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Age</span>
                          <span className={`text-sm ${getScoreColor(player.ageScore)}`}>
                            {player.ageScore}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Efficiency</span>
                          <span className={`text-sm ${getScoreColor(player.efficiencyScore)}`}>
                            {player.efficiencyScore}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Stability</span>
                          <span className={`text-sm ${getScoreColor(player.stabilityScore)}`}>
                            {player.stabilityScore}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2024 Stats */}
                    <div className="lg:col-span-1">
                      <h4 className="font-semibold mb-3">2024 Stats</h4>
                      <div className="space-y-1 text-sm">
                        <div>Games: {player.games}</div>
                        {player.targets > 0 && (
                          <>
                            <div>Targets: {player.targets}</div>
                            <div>Receptions: {player.receptions}</div>
                            <div>Rec Yards: {player.receivingYards}</div>
                            <div>Rec TDs: {player.receivingTds}</div>
                            <div>Catch Rate: {player.catchRate.toFixed(1)}%</div>
                            <div>Y/Target: {player.yardsPerTarget.toFixed(1)}</div>
                          </>
                        )}
                        {player.rushingYards && player.rushingYards > 0 && (
                          <>
                            <div>Rush Yards: {player.rushingYards}</div>
                            <div>Rush TDs: {player.rushingTds}</div>
                          </>
                        )}
                        {player.avgSeparation && (
                          <div>Avg Separation: {player.avgSeparation.toFixed(1)}"</div>
                        )}
                        {player.yacAboveExpected && (
                          <div>YAC+: {player.yacAboveExpected.toFixed(1)}</div>
                        )}
                      </div>
                    </div>

                    {/* Analysis */}
                    <div className="lg:col-span-1">
                      <h4 className="font-semibold mb-3">Analysis</h4>
                      
                      {player.strengths.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-green-700 mb-1">Strengths</div>
                          <div className="space-y-1">
                            {player.strengths.map((strength, idx) => (
                              <div key={idx} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                                {strength}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {player.concerns.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-orange-700 mb-1">Concerns</div>
                          <div className="space-y-1">
                            {player.concerns.map((concern, idx) => (
                              <div key={idx} className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                                {concern}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Data Source Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Data Source: {rankingsData.metadata.source} | 
          Last Updated: {new Date(rankingsData.metadata.lastUpdated).toLocaleString()} | 
          Methodology: {rankingsData.metadata.methodology}
        </p>
      </div>
    </div>
  );
}
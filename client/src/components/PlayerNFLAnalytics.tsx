/**
 * Enhanced NFL Analytics Component
 * Displays comprehensive position-specific advanced metrics from SportsDataIO
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, Target, Zap, Shield } from "lucide-react";

interface NFLAdvancedStats {
  playerId: number;
  playerName: string;
  position: string;
  team: string;
  season: number;
  qbMetrics?: {
    adjustedYardsPerAttempt: number;
    epaPerPlay: number;
    completionPercentageOverExpected: number;
    deepBallAccuracy: number;
    pressureToSackRate: number;
    ratingUnderPressure: number;
    redZoneEfficiency: number;
    thirdDownConversionRate: number;
    playActionEPA: number;
    totalQBR: number;
  };
  rbMetrics?: {
    yardsAfterContact: number;
    epaPerRush: number;
    rushYardsOverExpected: number;
    successRate: number;
    brokenTackleRate: number;
    redZoneEfficiency: number;
    receivingEPA: number;
    fumbleRate: number;
    thirdDownConversionRate: number;
    workloadShare: number;
  };
  receivingMetrics?: {
    yacPerReception: number;
    epaPerTarget: number;
    catchRateOverExpected: number;
    airYardsShare: number;
    separationRate: number;
    contestedCatchRate: number;
    redZoneEfficiency: number;
    thirdDownConversionRate: number;
    routeDiversityScore: number;
    dropRate: number;
  };
}

interface PlayerProfile {
  player: any;
  advancedStats: NFLAdvancedStats;
  dynastyAnalysis: {
    enhancedValue: number;
    tier: string;
    strengthsFromAPI: string[];
    concernsFromAPI: string[];
    confidenceScore: number;
  };
}

interface PlayerNFLAnalyticsProps {
  playerId: number;
}

export function PlayerNFLAnalytics({ playerId }: PlayerNFLAnalyticsProps) {
  const { data: profile, isLoading, error } = useQuery<PlayerProfile>({
    queryKey: [`/api/players/${playerId}/nfl-analytics`],
    retry: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            NFL Analytics
          </CardTitle>
          <CardDescription>Advanced NFL performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Advanced analytics will be available during the NFL season</p>
            <p className="text-sm mt-2">Integrating with SportsDataIO for live metrics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { advancedStats, dynastyAnalysis } = profile;
  const position = advancedStats.position;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'bg-purple-500';
      case 'Premium': return 'bg-blue-500';
      case 'Strong': return 'bg-green-500';
      case 'Solid': return 'bg-yellow-500';
      case 'Depth': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getMetricColor = (value: number, thresholds: { elite: number; good: number; poor: number }) => {
    if (value >= thresholds.elite) return 'text-green-600';
    if (value >= thresholds.good) return 'text-yellow-600';
    if (value <= thresholds.poor) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getProgressColor = (value: number, max: number) => {
    const percentage = (value / max) * 100;
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Dynasty Analysis Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Enhanced Dynasty Analysis
              </CardTitle>
              <CardDescription>
                Powered by real NFL advanced metrics from SportsDataIO
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{dynastyAnalysis.enhancedValue}/100</div>
              <Badge className={getTierColor(dynastyAnalysis.tier)}>
                {dynastyAnalysis.tier}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-green-600 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Strengths from API Data
              </h4>
              <ul className="space-y-1">
                {dynastyAnalysis.strengthsFromAPI.map((strength, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {strength}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Concerns from API Data
              </h4>
              <ul className="space-y-1">
                {dynastyAnalysis.concernsFromAPI.length > 0 ? (
                  dynastyAnalysis.concernsFromAPI.map((concern, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {concern}</li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">• No significant concerns identified</li>
                )}
              </ul>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm">Data Confidence: {dynastyAnalysis.confidenceScore}%</span>
            <Progress value={dynastyAnalysis.confidenceScore} className="flex-1 max-w-32" />
          </div>
        </CardContent>
      </Card>

      {/* Position-Specific Advanced Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Advanced NFL Metrics ({position})
          </CardTitle>
          <CardDescription>
            Position-specific analytics powered by SportsDataIO
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="primary" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="primary">Primary Metrics</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
              <TabsTrigger value="situation">Situational</TabsTrigger>
            </TabsList>

            {/* QB Metrics */}
            {position === 'QB' && advancedStats.qbMetrics && (
              <>
                <TabsContent value="primary" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Adjusted Yards/Attempt</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.qbMetrics.adjustedYardsPerAttempt, { elite: 8.0, good: 7.0, poor: 6.0 })}`}>
                          {advancedStats.qbMetrics.adjustedYardsPerAttempt.toFixed(1)}
                        </span>
                      </div>
                      <Progress 
                        value={(advancedStats.qbMetrics.adjustedYardsPerAttempt / 10) * 100} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">EPA per Play</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.qbMetrics.epaPerPlay, { elite: 0.2, good: 0.1, poor: 0.0 })}`}>
                          {advancedStats.qbMetrics.epaPerPlay.toFixed(3)}
                        </span>
                      </div>
                      <Progress 
                        value={Math.max(0, (advancedStats.qbMetrics.epaPerPlay + 0.2) / 0.6 * 100)} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="efficiency" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">CPOE</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.qbMetrics.completionPercentageOverExpected, { elite: 2.0, good: 0.0, poor: -2.0 })}`}>
                          {advancedStats.qbMetrics.completionPercentageOverExpected > 0 ? '+' : ''}
                          {advancedStats.qbMetrics.completionPercentageOverExpected.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.max(0, (advancedStats.qbMetrics.completionPercentageOverExpected + 5) / 10 * 100)} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Deep Ball Accuracy</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.qbMetrics.deepBallAccuracy, { elite: 45, good: 35, poor: 25 })}`}>
                          {advancedStats.qbMetrics.deepBallAccuracy.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={advancedStats.qbMetrics.deepBallAccuracy} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="situation" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Red Zone Efficiency</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.qbMetrics.redZoneEfficiency, { elite: 60, good: 50, poor: 40 })}`}>
                          {advancedStats.qbMetrics.redZoneEfficiency.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={advancedStats.qbMetrics.redZoneEfficiency} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Rating Under Pressure</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.qbMetrics.ratingUnderPressure, { elite: 85, good: 75, poor: 65 })}`}>
                          {advancedStats.qbMetrics.ratingUnderPressure.toFixed(1)}
                        </span>
                      </div>
                      <Progress 
                        value={advancedStats.qbMetrics.ratingUnderPressure} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
              </>
            )}

            {/* RB Metrics */}
            {position === 'RB' && advancedStats.rbMetrics && (
              <>
                <TabsContent value="primary" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Yards After Contact</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.rbMetrics.yardsAfterContact, { elite: 2.5, good: 2.0, poor: 1.5 })}`}>
                          {advancedStats.rbMetrics.yardsAfterContact.toFixed(1)}
                        </span>
                      </div>
                      <Progress 
                        value={(advancedStats.rbMetrics.yardsAfterContact / 4) * 100} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Success Rate</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.rbMetrics.successRate, { elite: 50, good: 45, poor: 40 })}`}>
                          {advancedStats.rbMetrics.successRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={advancedStats.rbMetrics.successRate} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="efficiency" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">EPA per Rush</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.rbMetrics.epaPerRush, { elite: 0.1, good: 0.0, poor: -0.1 })}`}>
                          {advancedStats.rbMetrics.epaPerRush > 0 ? '+' : ''}
                          {advancedStats.rbMetrics.epaPerRush.toFixed(3)}
                        </span>
                      </div>
                      <Progress 
                        value={Math.max(0, (advancedStats.rbMetrics.epaPerRush + 0.2) / 0.4 * 100)} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Broken Tackle Rate</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.rbMetrics.brokenTackleRate, { elite: 15, good: 10, poor: 5 })}`}>
                          {advancedStats.rbMetrics.brokenTackleRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, advancedStats.rbMetrics.brokenTackleRate * 4)} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="situation" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Workload Share</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.rbMetrics.workloadShare, { elite: 25, good: 20, poor: 15 })}`}>
                          {advancedStats.rbMetrics.workloadShare.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, advancedStats.rbMetrics.workloadShare * 2.5)} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Fumble Rate</span>
                        <span className={`font-semibold ${getMetricColor(5 - advancedStats.rbMetrics.fumbleRate, { elite: 4, good: 3, poor: 2 })}`}>
                          {advancedStats.rbMetrics.fumbleRate.toFixed(2)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.max(0, 100 - (advancedStats.rbMetrics.fumbleRate * 20))} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
              </>
            )}

            {/* WR/TE Metrics */}
            {(['WR', 'TE'].includes(position)) && advancedStats.receivingMetrics && (
              <>
                <TabsContent value="primary" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Separation Rate</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.receivingMetrics.separationRate, { elite: 70, good: 65, poor: 60 })}`}>
                          {advancedStats.receivingMetrics.separationRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={advancedStats.receivingMetrics.separationRate} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">YAC per Reception</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.receivingMetrics.yacPerReception, { elite: 6.0, good: 4.5, poor: 3.0 })}`}>
                          {advancedStats.receivingMetrics.yacPerReception.toFixed(1)}
                        </span>
                      </div>
                      <Progress 
                        value={(advancedStats.receivingMetrics.yacPerReception / 8) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="efficiency" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Catch Rate Over Expected</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.receivingMetrics.catchRateOverExpected, { elite: 5, good: 0, poor: -5 })}`}>
                          {advancedStats.receivingMetrics.catchRateOverExpected > 0 ? '+' : ''}
                          {advancedStats.receivingMetrics.catchRateOverExpected.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.max(0, (advancedStats.receivingMetrics.catchRateOverExpected + 10) / 20 * 100)} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Drop Rate</span>
                        <span className={`font-semibold ${getMetricColor(10 - advancedStats.receivingMetrics.dropRate, { elite: 8, good: 6, poor: 4 })}`}>
                          {advancedStats.receivingMetrics.dropRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.max(0, 100 - (advancedStats.receivingMetrics.dropRate * 10))} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="situation" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Air Yards Share</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.receivingMetrics.airYardsShare, { elite: 25, good: 20, poor: 15 })}`}>
                          {advancedStats.receivingMetrics.airYardsShare.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, advancedStats.receivingMetrics.airYardsShare * 2.5)} 
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Contested Catch Rate</span>
                        <span className={`font-semibold ${getMetricColor(advancedStats.receivingMetrics.contestedCatchRate, { elite: 60, good: 50, poor: 40 })}`}>
                          {advancedStats.receivingMetrics.contestedCatchRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={advancedStats.receivingMetrics.contestedCatchRate} 
                        className="h-2"
                      />
                    </div>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
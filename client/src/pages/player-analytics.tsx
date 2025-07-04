import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, Target, Activity, AlertTriangle, CheckCircle } from "lucide-react";

interface PlayerAnalytics {
  player: {
    id: number;
    name: string;
    position: string;
    team: string;
    avgPoints: number;
    age?: number;
  };
  metrics: {
    targetShare: number;
    touchesPerGame: number;
    snapShare: number;
    redZoneShare: number;
    yardsPerRouteRun: number;
    firstDownsPerRoute: number;
    yardsAfterContact: number;
    catchRate: number;
    teamPassAttempts: number;
    depthOfTarget: number;
    thirdDownUsage: number;
    consistencyScore: number;
    injuryHistory: number;
    ageAdjustment: number;
    teamStability: number;
  };
  dynastyScore: number;
  tier: 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Bench';
  confidence: number;
  predictiveFactors: string[];
  riskFactors: string[];
}

export default function PlayerAnalytics() {
  const [playerName, setPlayerName] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['/api/players/analytics', playerName],
    queryFn: () => fetch(`/api/players/analytics?player=${encodeURIComponent(playerName)}`).then(res => res.json()),
    enabled: searchTriggered && playerName.length > 2,
  });

  const handleSearch = () => {
    if (playerName.length > 2) {
      setSearchTriggered(true);
    }
  };

  const getMetricColor = (value: number, thresholds: { excellent: number; good: number; poor: number }) => {
    if (value >= thresholds.excellent) return "bg-green-500";
    if (value >= thresholds.good) return "bg-yellow-500";
    if (value >= thresholds.poor) return "bg-orange-500";
    return "bg-red-500";
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return "bg-purple-600 text-white";
      case 'Tier1': return "bg-green-600 text-white";
      case 'Tier2': return "bg-blue-600 text-white";
      case 'Tier3': return "bg-yellow-600 text-white";
      default: return "bg-gray-600 text-white";
    }
  };

  const renderVolumeMetrics = (analytics: PlayerAnalytics) => {
    const { metrics, player } = analytics;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(player.position === 'WR' || player.position === 'TE') && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Target Share</span>
                <span className="text-sm font-bold">{metrics.targetShare.toFixed(1)}%</span>
              </div>
              <Progress 
                value={metrics.targetShare} 
                className="h-2"
                max={30}
              />
              <div className="text-xs text-gray-600">
                Elite: 25%+ | Good: 20%+ | Poor: <15%
              </div>
            </div>
          )}
          
          {player.position === 'RB' && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Touches/Game</span>
                <span className="text-sm font-bold">{metrics.touchesPerGame.toFixed(1)}</span>
              </div>
              <Progress 
                value={metrics.touchesPerGame} 
                className="h-2"
                max={25}
              />
              <div className="text-xs text-gray-600">
                Elite: 20+ | Good: 15+ | Poor: <12
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Snap Share</span>
              <span className="text-sm font-bold">{metrics.snapShare.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.snapShare} 
              className="h-2"
              max={100}
            />
            <div className="text-xs text-gray-600">
              Elite: 80%+ | Good: 65%+ | Poor: <50%
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Red Zone Share</span>
              <span className="text-sm font-bold">{metrics.redZoneShare.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.redZoneShare} 
              className="h-2"
              max={50}
            />
            <div className="text-xs text-gray-600">
              Elite: 25%+ | Good: 15%+ | Poor: <10%
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">🎯 Volume Analysis (40% Weight)</h4>
          <p className="text-sm text-blue-800">
            Volume metrics are the most predictive of fantasy success. Target share and touches per game 
            have the highest correlation (0.8+) with future fantasy points.
          </p>
        </div>
      </div>
    );
  };

  const renderEfficiencyMetrics = (analytics: PlayerAnalytics) => {
    const { metrics, player } = analytics;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(player.position === 'WR' || player.position === 'TE' || player.position === 'RB') && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Yards Per Route Run</span>
                  <span className="text-sm font-bold">{metrics.yardsPerRouteRun.toFixed(2)}</span>
                </div>
                <Progress 
                  value={metrics.yardsPerRouteRun * 33.33} 
                  className="h-2"
                  max={100}
                />
                <div className="text-xs text-gray-600">
                  Elite: 2.5+ | Good: 2.0+ | Poor: <1.5
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">First Downs/Route</span>
                  <span className="text-sm font-bold">{(metrics.firstDownsPerRoute * 100).toFixed(1)}%</span>
                </div>
                <Progress 
                  value={metrics.firstDownsPerRoute * 1000} 
                  className="h-2"
                  max={150}
                />
                <div className="text-xs text-gray-600">
                  Elite: 12%+ | Good: 9.5%+ | Poor: <8%
                </div>
              </div>
            </>
          )}
          
          {player.position === 'RB' && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Yards After Contact</span>
                <span className="text-sm font-bold">{metrics.yardsAfterContact.toFixed(1)}</span>
              </div>
              <Progress 
                value={metrics.yardsAfterContact * 25} 
                className="h-2"
                max={100}
              />
              <div className="text-xs text-gray-600">
                Elite: 3.0+ | Good: 2.5+ | Poor: <2.0
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Catch Rate</span>
              <span className="text-sm font-bold">{metrics.catchRate.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.catchRate} 
              className="h-2"
              max={100}
            />
            <div className="text-xs text-gray-600">
              Elite: 75%+ | Good: 70%+ | Poor: <65%
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">⚡ Efficiency Analysis (25% Weight)</h4>
          <p className="text-sm text-yellow-800">
            First downs per route run (0.91 correlation with YPRR) is more predictive than raw YPRR. 
            Elite efficiency often indicates readiness for increased opportunity.
          </p>
        </div>
      </div>
    );
  };

  const renderContextMetrics = (analytics: PlayerAnalytics) => {
    const { metrics, player } = analytics;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Team Pass Attempts</span>
              <span className="text-sm font-bold">{metrics.teamPassAttempts}</span>
            </div>
            <Progress 
              value={(metrics.teamPassAttempts / 700) * 100} 
              className="h-2"
              max={100}
            />
            <div className="text-xs text-gray-600">
              High Volume: 600+ | Balanced: 550+ | Run Heavy: <500
            </div>
          </div>
          
          {(player.position === 'WR' || player.position === 'TE') && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Depth of Target</span>
                <span className="text-sm font-bold">{metrics.depthOfTarget.toFixed(1)} yds</span>
              </div>
              <Progress 
                value={(metrics.depthOfTarget / 15) * 100} 
                className="h-2"
                max={100}
              />
              <div className="text-xs text-gray-600">
                Deep: 12+ | Intermediate: 8-12 | Short: <8
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Third Down Usage</span>
              <span className="text-sm font-bold">{metrics.thirdDownUsage.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.thirdDownUsage} 
              className="h-2"
              max={100}
            />
            <div className="text-xs text-gray-600">
              High Trust: 60%+ | Good: 40%+ | Limited: <30%
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Team Stability</span>
              <span className="text-sm font-bold">{metrics.teamStability.toFixed(0)}%</span>
            </div>
            <Progress 
              value={metrics.teamStability} 
              className="h-2"
              max={100}
            />
            <div className="text-xs text-gray-600">
              Stable: 80%+ | Decent: 60%+ | Chaotic: <50%
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
          <h4 className="font-semibold text-purple-900 mb-2">🎮 Context Analysis (20% Weight)</h4>
          <p className="text-sm text-purple-800">
            Situational usage and team context affect opportunity ceiling. Third down usage indicates 
            coaching trust and role security.
          </p>
        </div>
      </div>
    );
  };

  const renderStabilityMetrics = (analytics: PlayerAnalytics) => {
    const { metrics, player } = analytics;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Consistency Score</span>
              <span className="text-sm font-bold">{metrics.consistencyScore.toFixed(0)}%</span>
            </div>
            <Progress 
              value={metrics.consistencyScore} 
              className="h-2"
              max={100}
            />
            <div className="text-xs text-gray-600">
              Stable: 80%+ | Good: 70%+ | Volatile: <60%
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Age Adjustment</span>
              <span className="text-sm font-bold">
                {metrics.ageAdjustment > 0 ? '+' : ''}{metrics.ageAdjustment.toFixed(0)}
              </span>
            </div>
            <div className={`h-2 rounded-full ${
              metrics.ageAdjustment > 0 ? 'bg-green-500' : 
              metrics.ageAdjustment === 0 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <div className="text-xs text-gray-600">
              Prime: +10 | Peak: 0 | Decline: -10+
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Injury History</span>
              <span className="text-sm font-bold">{metrics.injuryHistory} issues</span>
            </div>
            <div className={`h-2 rounded-full ${
              metrics.injuryHistory === 0 ? 'bg-green-500' : 
              metrics.injuryHistory === 1 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <div className="text-xs text-gray-600">
              Clean: 0 | Some: 1 | Concern: 2+
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <h4 className="font-semibold text-green-900 mb-2">🎯 Stability Analysis (15% Weight)</h4>
          <p className="text-sm text-green-800">
            Dynasty leagues require predictable performance. Age curves and injury history affect 
            long-term value projections.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Advanced Player Analytics</h1>
        <p className="text-gray-600">
          Research-based dynasty valuation using predictive metrics and correlation studies
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Player Search
          </CardTitle>
          <CardDescription>
            Analyze any NFL player using our advanced analytics framework
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter player name (e.g., CeeDee Lamb, Josh Allen)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={playerName.length < 3}>
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
            <p>Calculating advanced analytics...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Player not found or analysis unavailable</p>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <div className="space-y-6">
          {/* Player Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    {analytics.player.name} - {analytics.player.team} {analytics.player.position}
                  </CardTitle>
                  <CardDescription>
                    {analytics.player.avgPoints.toFixed(1)} PPG • Age {analytics.player.age || 'Unknown'}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <Badge className={getTierColor(analytics.tier)} variant="secondary">
                    {analytics.tier}
                  </Badge>
                  <div className="text-2xl font-bold mt-1">
                    {analytics.dynastyScore}/100
                  </div>
                  <div className="text-sm text-gray-600">
                    {analytics.confidence}% confidence
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Key Strengths
                  </h4>
                  <ul className="space-y-1">
                    {analytics.predictiveFactors.map((factor, index) => (
                      <li key={index} className="text-sm text-green-700">• {factor}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Risk Factors
                  </h4>
                  <ul className="space-y-1">
                    {analytics.riskFactors.map((risk, index) => (
                      <li key={index} className="text-sm text-red-700">• {risk}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Metrics Tabs */}
          <Tabs defaultValue="volume" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="volume" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Volume (40%)
              </TabsTrigger>
              <TabsTrigger value="efficiency" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Efficiency (25%)
              </TabsTrigger>
              <TabsTrigger value="context" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Context (20%)
              </TabsTrigger>
              <TabsTrigger value="stability" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Stability (15%)
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="volume">
              <Card>
                <CardHeader>
                  <CardTitle>Volume Metrics - Most Predictive</CardTitle>
                  <CardDescription>
                    Target share and touches have 0.8+ correlation with future fantasy points
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderVolumeMetrics(analytics)}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="efficiency">
              <Card>
                <CardHeader>
                  <CardTitle>Efficiency Metrics - Skill Indicators</CardTitle>
                  <CardDescription>
                    First downs per route run is more predictive than raw YPRR
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderEfficiencyMetrics(analytics)}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="context">
              <Card>
                <CardHeader>
                  <CardTitle>Context Metrics - Situational Factors</CardTitle>
                  <CardDescription>
                    Team scheme and usage patterns affect opportunity ceiling
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderContextMetrics(analytics)}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="stability">
              <Card>
                <CardHeader>
                  <CardTitle>Stability Metrics - Dynasty Factors</CardTitle>
                  <CardDescription>
                    Long-term value considerations for dynasty leagues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderStabilityMetrics(analytics)}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
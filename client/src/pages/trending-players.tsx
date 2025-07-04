import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Flame, Eye, Star, Crown, Lock, Zap } from "lucide-react";

interface TrendingPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  
  // Basic metrics (from free NFL data)
  snapShareEarly: number;
  snapShareLate: number;
  snapShareIncrease: number;
  targetsEarly: number;
  targetsLate: number;
  targetIncrease: number;
  carriesEarly: number;
  carriesLate: number;
  carryIncrease: number;
  touchesEarly: number;
  touchesLate: number;
  touchIncrease: number;
  
  // Premium metrics (placeholders)
  targetShareEarly: string;
  targetShareLate: string;
  routeParticipation: string;
  weightedOpportunityRating: string;
  dominatorRating: string;
  airYardsShare: string;
  redZoneShare: string;
  
  // Analysis
  breakoutContext: string;
  breakoutLegitimacy: 'high' | 'medium' | 'low';
  outlookCategory: 'ascending' | 'stable' | 'declining' | 'volatile';
  projection2025: string;
  
  // Market data
  adp2024: number;
  projectedAdp2025: number;
  dynastyValueCurrent: number;
  dynastyValueProjected: number;
  
  // Confidence
  confidenceScore: number;
  trendStartWeek: number;
  sustainabilityRating: number;
}

interface TrendingAnalysis {
  players: TrendingPlayer[];
  categories: {
    emergingStars: TrendingPlayer[];
    roleExpansions: TrendingPlayer[];
    opportunityRisers: TrendingPlayer[];
    regressionCandidates: TrendingPlayer[];
  };
  insights: {
    topBreakouts: TrendingPlayer[];
    stealCandidates: TrendingPlayer[];
    sellHighTargets: TrendingPlayer[];
  };
  lastUpdated: string;
}

export default function TrendingPlayers() {
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("touchIncrease");
  
  const { data: trendingData, isLoading } = useQuery<TrendingAnalysis>({
    queryKey: ['/api/trending', selectedPosition, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedPosition !== "all") params.set("position", selectedPosition);
      if (selectedCategory) params.set("category", selectedCategory);
      
      return fetch(`/api/trending?${params.toString()}`).then(res => res.json());
    }
  });

  const { data: premiumPreview } = useQuery({
    queryKey: ['/api/trending/premium-preview'],
  });

  const getLegitimacyColor = (legitimacy: string) => {
    switch (legitimacy) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOutlookIcon = (category: string) => {
    switch (category) {
      case 'ascending': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'stable': return <Star className="h-4 w-4 text-blue-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'volatile': return <Zap className="h-4 w-4 text-orange-600" />;
      default: return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatIncrease = (value: number, isPercent = false) => {
    const formatted = isPercent ? `+${value.toFixed(1)}%` : `+${value.toFixed(1)}`;
    return value > 0 ? formatted : value.toFixed(1);
  };

  const PremiumMetric = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-dashed">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <Lock className="h-3 w-3 text-gray-400" />
        <span className="text-sm text-gray-500 font-mono">{value}</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Trending Players</h1>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              <Flame className="h-3 w-3 mr-1" />
              Week 9+ Breakouts
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Players with increased roles from Week 9 onward in the 2024 season. Advanced metrics require FantasyPointsData premium subscription.
          </p>
        </div>
      </div>

      {/* Premium Subscription Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Lock className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <div className="flex justify-between items-center">
            <div>
              <strong>Premium Analytics Available:</strong> Unlock target share, route participation, dominator rating, and advanced breakout analysis with FantasyPointsData subscription ($200/year).
            </div>
            <Button variant="outline" size="sm" className="text-blue-600 border-blue-300">
              View Preview
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Key Insights */}
      {trendingData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {trendingData.insights.topBreakouts.length}
                  </p>
                  <p className="text-sm text-muted-foreground">High-Confidence Breakouts</p>
                </div>
                <Crown className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {trendingData.insights.stealCandidates.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Buy-Low Candidates</p>
                </div>
                <Star className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {trendingData.categories.regressionCandidates.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Regression Risks</p>
                </div>
                <TrendingDown className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={selectedPosition} onValueChange={setSelectedPosition}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            <SelectItem value="QB">QB</SelectItem>
            <SelectItem value="RB">RB</SelectItem>
            <SelectItem value="WR">WR</SelectItem>
            <SelectItem value="TE">TE</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            <SelectItem value="high-confidence">High Confidence</SelectItem>
            <SelectItem value="buy-low">Buy Low</SelectItem>
            <SelectItem value="sell-high">Sell High</SelectItem>
            <SelectItem value="ascending">Ascending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="touchIncrease">Touch Increase</SelectItem>
            <SelectItem value="snapShareIncrease">Snap % Increase</SelectItem>
            <SelectItem value="confidenceScore">Confidence</SelectItem>
            <SelectItem value="sustainabilityRating">Sustainability</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all-trending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all-trending">All Trending</TabsTrigger>
          <TabsTrigger value="emerging-stars">Emerging Stars</TabsTrigger>
          <TabsTrigger value="role-expansions">Role Expansions</TabsTrigger>
          <TabsTrigger value="insights">Top Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="all-trending" className="space-y-4">
          <div className="grid gap-4">
            {trendingData?.players
              .sort((a, b) => b[sortBy as keyof TrendingPlayer] as number - (a[sortBy as keyof TrendingPlayer] as number))
              .map((player) => (
              <Card key={player.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{player.name}</h3>
                          <Badge variant="outline">{player.team} {player.position}</Badge>
                          <Badge variant="outline" className={getLegitimacyColor(player.breakoutLegitimacy)}>
                            {player.breakoutLegitimacy.toUpperCase()} Legitimacy
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getOutlookIcon(player.outlookCategory)}
                          <span className="text-sm text-muted-foreground capitalize">
                            {player.outlookCategory} outlook
                          </span>
                          <span className="text-sm text-muted-foreground">
                            • Week {player.trendStartWeek}+ breakout
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground">Confidence:</span>
                        <span className="font-semibold">{player.confidenceScore}%</span>
                      </div>
                      <Progress value={player.confidenceScore} className="w-24 h-2" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Basic Metrics */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-700">Role Increase (Weeks 1-8 → 9+)</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Snap Share:</span>
                          <span className="font-medium text-green-600">
                            {player.snapShareEarly.toFixed(1)}% → {player.snapShareLate.toFixed(1)}%
                            ({formatIncrease(player.snapShareIncrease, true)})
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Targets/Game:</span>
                          <span className="font-medium text-blue-600">
                            {player.targetsEarly.toFixed(1)} → {player.targetsLate.toFixed(1)}
                            ({formatIncrease(player.targetIncrease)})
                          </span>
                        </div>
                        {player.position === 'RB' && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Carries/Game:</span>
                            <span className="font-medium text-purple-600">
                              {player.carriesEarly.toFixed(1)} → {player.carriesLate.toFixed(1)}
                              ({formatIncrease(player.carryIncrease)})
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total Touches:</span>
                          <span className="font-medium text-orange-600">
                            {player.touchesEarly.toFixed(1)} → {player.touchesLate.toFixed(1)}
                            ({formatIncrease(player.touchIncrease)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Premium Metrics (Placeholders) */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-700 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Premium Analytics
                      </h4>
                      <div className="space-y-2">
                        <PremiumMetric label="Target Share" value={player.targetShareLate} />
                        <PremiumMetric label="Route Participation" value={player.routeParticipation} />
                        <PremiumMetric label="Weighted Opp Rating" value={player.weightedOpportunityRating} />
                        <PremiumMetric label="Dominator Rating" value={player.dominatorRating} />
                        <PremiumMetric label="Air Yards Share" value={player.airYardsShare} />
                      </div>
                    </div>

                    {/* Analysis & Projections */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-700">Analysis & Outlook</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Breakout Context:</p>
                          <p className="text-sm text-gray-600">{player.breakoutContext}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">2025 Projection:</p>
                          <p className="text-sm text-gray-600">{player.projection2025}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">2024 ADP:</span>
                            <span className="ml-1 font-medium">{player.adp2024.toFixed(0)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Proj 2025:</span>
                            <span className="ml-1 font-medium text-green-600">{player.projectedAdp2025.toFixed(0)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Current Value:</span>
                            <span className="ml-1 font-medium">{player.dynastyValueCurrent.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Proj Value:</span>
                            <span className="ml-1 font-medium text-blue-600">{player.dynastyValueProjected.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Sustainability:</span>
                          <div className="flex items-center gap-2">
                            <Progress value={player.sustainabilityRating} className="w-16 h-2" />
                            <span className="text-sm font-medium">{player.sustainabilityRating}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="emerging-stars" className="space-y-4">
          <div className="grid gap-4">
            {trendingData?.categories.emergingStars.map((player) => (
              <Card key={player.id} className="border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-green-700">{player.name}</h3>
                      <p className="text-muted-foreground">{player.team} {player.position}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      Emerging Star
                    </Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium mb-1">Key Increases:</p>
                      <p className="text-green-600">Touches: +{player.touchIncrease.toFixed(1)}/game</p>
                      <p className="text-blue-600">Snaps: +{player.snapShareIncrease.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Market Opportunity:</p>
                      <p>ADP: {player.adp2024.toFixed(0)} → {player.projectedAdp2025.toFixed(0)}</p>
                      <p className="text-green-600">Potential ADP gain: {(player.adp2024 - player.projectedAdp2025).toFixed(0)} spots</p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Outlook:</p>
                      <p className="text-sm">{player.projection2025.substring(0, 100)}...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="role-expansions" className="space-y-4">
          <div className="grid gap-4">
            {trendingData?.categories.roleExpansions.map((player) => (
              <Card key={player.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-blue-700">{player.name}</h3>
                      <p className="text-muted-foreground">{player.team} {player.position}</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      Role Expansion
                    </Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium mb-2">Snap Share Evolution:</p>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-500">{player.snapShareEarly.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Weeks 1-8</p>
                        </div>
                        <TrendingUp className="h-6 w-6 text-green-500" />
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{player.snapShareLate.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">Weeks 9+</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{player.breakoutContext}</p>
                    </div>
                    <div>
                      <p className="font-medium mb-2">Sustainability Analysis:</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Confidence:</span>
                          <span className="font-medium">{player.confidenceScore}%</span>
                        </div>
                        <Progress value={player.confidenceScore} className="h-2" />
                        <div className="flex justify-between">
                          <span className="text-sm">Sustainability:</span>
                          <span className="font-medium">{player.sustainabilityRating}%</span>
                        </div>
                        <Progress value={player.sustainabilityRating} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Buy-Low Opportunities
                </CardTitle>
                <CardDescription>
                  Players with strong trends but favorable current pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trendingData?.insights.stealCandidates.slice(0, 3).map((player) => (
                    <div key={player.id} className="p-3 bg-green-50 rounded border-l-4 border-green-400">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-green-800">{player.name}</h4>
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          {player.team} {player.position}
                        </Badge>
                      </div>
                      <p className="text-sm text-green-700 mb-2">
                        ADP Drop: {player.adp2024.toFixed(0)} → {player.projectedAdp2025.toFixed(0)} 
                        ({(((player.adp2024 - player.projectedAdp2025) / player.adp2024) * 100).toFixed(0)}% improvement)
                      </p>
                      <p className="text-xs text-green-600">{player.breakoutContext.substring(0, 120)}...</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Sell-High Candidates
                </CardTitle>
                <CardDescription>
                  Players with unsustainable usage patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trendingData?.insights.sellHighTargets.map((player) => (
                    <div key={player.id} className="p-3 bg-red-50 rounded border-l-4 border-red-400">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-red-800">{player.name}</h4>
                        <Badge variant="outline" className="text-red-700 border-red-300">
                          {player.team} {player.position}
                        </Badge>
                      </div>
                      <p className="text-sm text-red-700 mb-2">
                        Sustainability Risk: {player.sustainabilityRating}% confidence
                      </p>
                      <p className="text-xs text-red-600">{player.breakoutContext.substring(0, 120)}...</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Clock, 
  Zap,
  Star,
  Target,
  Activity,
  Shield,
  BarChart3,
  Brain
} from "lucide-react";

interface EnhancedPlayer {
  name: string;
  position: string;
  team: string;
  avgPoints: number;
  enhancedMetrics: {
    playerId: number;
    playerName: string;
    position: string;
    team: string;
    age: number;
    productionScore: number;
    opportunityScore: number;
    ageScore: number;
    stabilityScore: number;
    efficiencyScore: number;
    rawDynastyValue: number;
    enhancedDynastyValue: number;
    elitePlayerBonus: number;
    tier: string;
    confidenceScore: number;
    marketComparison: string;
  };
}

export default function EnhancedDynasty() {
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  
  const { data: enhancedPlayers, isLoading } = useQuery<EnhancedPlayer[]>({
    queryKey: ["/api/players/enhanced-dynasty"],
  });

  const positions = ["all", "QB", "RB", "WR", "TE"];

  const filteredPlayers = enhancedPlayers?.filter(player => 
    selectedPosition === "all" || player.position === selectedPosition
  ) || [];

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'elite': return 'bg-purple-500';
      case 'premium': return 'bg-blue-500';
      case 'strong': return 'bg-green-500';
      case 'solid': return 'bg-yellow-500';
      case 'depth': return 'bg-orange-500';
      case 'bench': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'elite': return <Trophy className="h-4 w-4" />;
      case 'premium': return <Star className="h-4 w-4" />;
      case 'strong': return <TrendingUp className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Enhanced Dynasty Algorithm v2.0</h1>
        <p className="text-muted-foreground">
          Advanced research-based dynasty valuations with exponential scaling for elite players
        </p>
      </div>

      {/* Algorithm Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">Position-Specific Efficiency</p>
                <p className="text-sm text-muted-foreground">QB: 20% | RB: 15% | WR/TE: 10%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium">KTC-Style Scaling</p>
                <p className="text-sm text-muted-foreground">Elite players get exponential premiums</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">Research-Backed Weights</p>
                <p className="text-sm text-muted-foreground">Opportunity 35% | Production 30%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Position Filter Tabs */}
      <Tabs value={selectedPosition} onValueChange={setSelectedPosition}>
        <TabsList className="grid w-full grid-cols-5">
          {positions.map((position) => (
            <TabsTrigger key={position} value={position}>
              {position === "all" ? "All" : position}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedPosition} className="space-y-4 mt-6">
          {filteredPlayers.slice(0, 25).map((player, index) => (
            <Card key={player.enhancedMetrics.playerId} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Player Info */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                          <h3 className="font-semibold text-lg">{player.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{player.position}</Badge>
                          <Badge variant="outline">{player.team}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {player.avgPoints.toFixed(1)} PPG
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          {getTierIcon(player.enhancedMetrics.tier)}
                          <Badge className={getTierColor(player.enhancedMetrics.tier)}>
                            {player.enhancedMetrics.tier}
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold mt-1">
                          {player.enhancedMetrics.enhancedDynastyValue}
                        </div>
                        {player.enhancedMetrics.elitePlayerBonus > 0 && (
                          <div className="text-sm text-purple-600 font-medium">
                            +{player.enhancedMetrics.elitePlayerBonus} Elite Bonus
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {player.enhancedMetrics.marketComparison}
                    </div>
                  </div>

                  {/* Component Scores */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                      Component Scores
                    </h4>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">Production</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={player.enhancedMetrics.productionScore} 
                            className="w-20 h-2" 
                          />
                          <span className="text-sm font-medium w-8">
                            {player.enhancedMetrics.productionScore}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Opportunity</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={player.enhancedMetrics.opportunityScore} 
                            className="w-20 h-2" 
                          />
                          <span className="text-sm font-medium w-8">
                            {player.enhancedMetrics.opportunityScore}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">Age</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={player.enhancedMetrics.ageScore} 
                            className="w-20 h-2" 
                          />
                          <span className="text-sm font-medium w-8">
                            {player.enhancedMetrics.ageScore}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">Stability</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={player.enhancedMetrics.stabilityScore} 
                            className="w-20 h-2" 
                          />
                          <span className="text-sm font-medium w-8">
                            {player.enhancedMetrics.stabilityScore}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm">Efficiency</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={player.enhancedMetrics.efficiencyScore} 
                            className="w-20 h-2" 
                          />
                          <span className="text-sm font-medium w-8">
                            {player.enhancedMetrics.efficiencyScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Algorithm Comparison */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                      Algorithm Comparison
                    </h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Raw Score:</span>
                        <span className="font-medium">{player.enhancedMetrics.rawDynastyValue}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Enhanced Score:</span>
                        <span className="font-bold text-lg">{player.enhancedMetrics.enhancedDynastyValue}</span>
                      </div>
                      
                      {player.enhancedMetrics.elitePlayerBonus > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-purple-600">Elite Scaling:</span>
                          <span className="font-medium text-purple-600">
                            +{player.enhancedMetrics.elitePlayerBonus}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm">Confidence:</span>
                        <span className="font-medium">{player.enhancedMetrics.confidenceScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
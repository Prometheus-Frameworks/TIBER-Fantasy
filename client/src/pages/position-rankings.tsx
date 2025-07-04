import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Trophy, Target, Clock, Shield, Zap } from "lucide-react";

interface PositionRanking {
  rank: number;
  player: {
    id: number;
    name: string;
    team: string;
    position: string;
    avgPoints: number;
    projectedPoints: number;
  };
  dynastyScore: number;
  tier: 'Elite' | 'Tier1' | 'Tier2' | 'Tier3' | 'Bench';
  keyStrengths: string[];
  concerns: string[];
  trendDirection: 'Rising' | 'Stable' | 'Declining';
  ageScore: number;
  productionScore: number;
  opportunityScore: number;
  stabilityScore: number;
}

interface PositionRankings {
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'SFLEX';
  rankings: PositionRanking[];
  totalPlayers: number;
  lastUpdated: string;
  methodology: string;
}

export default function PositionRankingsPage() {
  const [selectedPosition, setSelectedPosition] = useState<'QB' | 'RB' | 'WR' | 'TE' | 'SFLEX'>('QB');
  
  const { data: rankingsData, isLoading, error } = useQuery<{ [key: string]: PositionRankings }>({
    queryKey: ['/api/rankings/all-positions'],
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'bg-yellow-500 text-black';
      case 'Tier1': return 'bg-green-500 text-white';
      case 'Tier2': return 'bg-blue-500 text-white';
      case 'Tier3': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Rising': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'Declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPositionInfo = (position: string) => {
    const info = {
      QB: {
        title: "Quarterback Rankings",
        description: "Individual QB dynasty rankings prioritizing consistent production and rushing upside",
        icon: <Target className="h-5 w-5" />
      },
      RB: {
        title: "Running Back Rankings", 
        description: "RB dynasty rankings emphasizing workload and age-curve considerations",
        icon: <Zap className="h-5 w-5" />
      },
      WR: {
        title: "Wide Receiver Rankings",
        description: "WR dynasty rankings focusing on target share and route running consistency", 
        icon: <Trophy className="h-5 w-5" />
      },
      TE: {
        title: "Tight End Rankings",
        description: "TE dynasty rankings prioritizing target volume and red zone usage",
        icon: <Shield className="h-5 w-5" />
      },
      SFLEX: {
        title: "Superflex Rankings",
        description: "Overall dynasty rankings for 2-QB leagues where Josh Allen goes from #24 to #1-2 overall",
        icon: <Clock className="h-5 w-5" />
      }
    };
    return info[position as keyof typeof info];
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-8 w-full" />
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Failed to load position rankings. Please try again later.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRankings = rankingsData?.[selectedPosition];

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Dynasty Position Rankings</h1>
          <p className="text-muted-foreground">
            Comprehensive 1-250 player rankings by position with superflex emphasis
          </p>
        </div>

        {/* Position Tabs */}
        <Tabs value={selectedPosition} onValueChange={(value) => setSelectedPosition(value as any)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="QB" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              QB
            </TabsTrigger>
            <TabsTrigger value="RB" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              RB
            </TabsTrigger>
            <TabsTrigger value="WR" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              WR
            </TabsTrigger>
            <TabsTrigger value="TE" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              TE
            </TabsTrigger>
            <TabsTrigger value="SFLEX" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              SFLEX
            </TabsTrigger>
          </TabsList>

          {['QB', 'RB', 'WR', 'TE', 'SFLEX'].map((position) => (
            <TabsContent key={position} value={position} className="space-y-6">
              {currentRankings && (
                <>
                  {/* Position Header */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {getPositionInfo(position).icon}
                        <div>
                          <CardTitle>{getPositionInfo(position).title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {getPositionInfo(position).description}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Players:</span> {currentRankings.totalPlayers}
                        </div>
                        <div>
                          <span className="font-medium">Rankings Shown:</span> Top {Math.min(250, currentRankings.rankings.length)}
                        </div>
                        <div>
                          <span className="font-medium">Last Updated:</span> {new Date(currentRankings.lastUpdated).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <strong>Methodology:</strong> {currentRankings.methodology}
                        </p>
                      </div>
                      
                      {/* Superflex Explanation */}
                      {position === 'SFLEX' && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            🔥 Superflex Impact: QB Value Revolution
                          </h4>
                          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                            <p>
                              <strong>Josh Allen Example:</strong> #24 overall in 1QB leagues → #1-2 overall in superflex
                            </p>
                            <p>
                              <strong>Why QBs Dominate:</strong> Teams start 2 QBs, creating massive scarcity and higher scoring floors vs skill positions
                            </p>
                            <p>
                              <strong>Dynasty Strategy:</strong> Elite QBs get 35-point bonuses, solid starters get 25+ point premiums
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Rankings List */}
                  <div className="space-y-3">
                    {currentRankings.rankings.slice(0, 50).map((ranking) => (
                      <Card key={ranking.player.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            {/* Rank and Player Info */}
                            <div className="flex items-center gap-4">
                              <div className="text-2xl font-bold text-muted-foreground w-12">
                                #{ranking.rank}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{ranking.player.name}</h3>
                                  <Badge variant="outline">{ranking.player.position}</Badge>
                                  <span className="text-sm text-muted-foreground">{ranking.player.team}</span>
                                  {getTrendIcon(ranking.trendDirection)}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span>{ranking.player.avgPoints.toFixed(1)} PPG</span>
                                  <span>Dynasty Score: {ranking.dynastyScore}</span>
                                </div>
                              </div>
                            </div>

                            {/* Tier and Scores */}
                            <div className="flex items-center gap-3">
                              <Badge className={getTierColor(ranking.tier)}>
                                {ranking.tier}
                              </Badge>
                              
                              {/* Component Scores */}
                              <div className="hidden md:flex gap-2 text-xs">
                                <div className="text-center">
                                  <div className="font-medium">Prod</div>
                                  <div>{ranking.productionScore}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium">Opp</div>
                                  <div>{ranking.opportunityScore}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium">Age</div>
                                  <div>{ranking.ageScore}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium">Stab</div>
                                  <div>{ranking.stabilityScore}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Strengths and Concerns */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {ranking.keyStrengths.map((strength, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                ✓ {strength}
                              </Badge>
                            ))}
                            {ranking.concerns.map((concern, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                ⚠ {concern}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Load More Indicator */}
                    {currentRankings.rankings.length > 50 && (
                      <Card>
                        <CardContent className="p-6 text-center">
                          <p className="text-muted-foreground">
                            Showing top 50 of {currentRankings.rankings.length} total rankings
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Full 1-250 rankings available via API endpoint
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
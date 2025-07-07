import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, User, TrendingUp, Activity, BarChart3, Target, Zap, Trophy } from "lucide-react";

interface PhysicalProfile {
  height: string;
  weight: number;
  age: number;
  bmi: number;
  armLength?: string;
  handSize?: string;
}

interface CombineMetrics {
  fortyYard?: number;
  verticalJump?: number;
  broadJump?: number;
  threeCone?: number;
  twentyShuttle?: number;
  rasScore?: number;
  rasPercentile?: number;
}

interface Analytics2024Percentile {
  metric: string;
  value: number;
  percentile: number;
  rank: string;
  context: string;
}

interface Stats2024 {
  games: number;
  targets?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTds?: number;
  carries?: number;
  rushingYards?: number;
  rushingTds?: number;
  passingYards?: number;
  passingTds?: number;
  interceptions?: number;
  fantasyPoints: number;
  avgPoints: number;
}

interface PlayerAnalysis {
  strengths: string[];
  concerns: string[];
  outlook: string;
}

interface EnhancedPlayerProfile {
  id: number;
  name: string;
  position: string;
  team: string;
  jerseyNumber?: number;
  physical: PhysicalProfile;
  combine: CombineMetrics;
  stats2024: Stats2024;
  topPercentileMetrics: Analytics2024Percentile[];
  dynastyValue: number;
  dynastyTier: string;
  trend: string;
  analysis: PlayerAnalysis;
  enhanced?: boolean;
  message?: string;
}

const PercentileIndicator = ({ percentile, value, label }: { percentile: number; value: number | string; label: string }) => {
  const getColorClass = (percentile: number) => {
    if (percentile >= 90) return "bg-emerald-500";
    if (percentile >= 75) return "bg-blue-500";
    if (percentile >= 50) return "bg-yellow-500";
    return "bg-gray-500";
  };

  const getRankLabel = (percentile: number) => {
    if (percentile >= 90) return "Elite";
    if (percentile >= 75) return "Above Avg";
    if (percentile >= 50) return "Average";
    return "Below Avg";
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="space-y-1">
        <Progress value={percentile} className="h-2" />
        <div className="flex justify-between text-xs">
          <span className={`font-medium ${percentile >= 75 ? 'text-emerald-600' : percentile >= 50 ? 'text-blue-600' : 'text-gray-600'}`}>
            {getRankLabel(percentile)}
          </span>
          <span className="text-muted-foreground">{percentile}th percentile</span>
        </div>
      </div>
    </div>
  );
};

export default function EnhancedPlayerProfile() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  const { data: player, isLoading, error } = useQuery<EnhancedPlayerProfile>({
    queryKey: [`/api/players/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Player Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested player profile could not be loaded.</p>
            <Button onClick={() => setLocation("/rankings")}>
              Return to Rankings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Premium': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Strong': return 'bg-green-100 text-green-800 border-green-300';
      case 'Solid': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'Rising') return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <Activity className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/rankings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rankings
          </Button>
        </div>
        {player.enhanced && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
            Enhanced Profile
          </Badge>
        )}
      </div>

      {/* Player Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold">{player.name}</h1>
                {player.jerseyNumber && (
                  <Badge variant="outline">#{player.jerseyNumber}</Badge>
                )}
              </div>
              <div className="flex items-center space-x-4 text-lg text-muted-foreground">
                <span>{player.position} • {player.team}</span>
                {player.physical && <span>Age {player.physical.age}</span>}
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center space-x-2">
                <Badge className={getTierColor(player.dynastyTier)}>
                  {player.dynastyTier}
                </Badge>
                {getTrendIcon(player.trend)}
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {player.dynastyValue.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">Dynasty Value</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">2024 Analytics</TabsTrigger>
          <TabsTrigger value="physical">Physical Profile</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 2024 Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>2024 Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Fantasy Points</span>
                    <span className="font-semibold">{player.stats2024.fantasyPoints.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Per Game</span>
                    <span className="font-semibold">{player.stats2024.avgPoints.toFixed(1)} PPG</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Games Played</span>
                    <span className="font-semibold">{player.stats2024.games}</span>
                  </div>
                  {player.stats2024.targets && (
                    <div className="flex justify-between">
                      <span>Targets</span>
                      <span className="font-semibold">{player.stats2024.targets}</span>
                    </div>
                  )}
                  {player.stats2024.receptions && (
                    <div className="flex justify-between">
                      <span>Receptions</span>
                      <span className="font-semibold">{player.stats2024.receptions}</span>
                    </div>
                  )}
                  {player.stats2024.receivingYards && (
                    <div className="flex justify-between">
                      <span>Receiving Yards</span>
                      <span className="font-semibold">{player.stats2024.receivingYards}</span>
                    </div>
                  )}
                  {player.stats2024.receivingTds && (
                    <div className="flex justify-between">
                      <span>Receiving TDs</span>
                      <span className="font-semibold">{player.stats2024.receivingTds}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dynasty Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5" />
                  <span>Dynasty Profile</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-emerald-600">
                    {player.dynastyValue.toFixed(1)}
                  </div>
                  <Badge className={getTierColor(player.dynastyTier)}>
                    {player.dynastyTier} Tier
                  </Badge>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Trend</span>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(player.trend)}
                      <span className="font-semibold">{player.trend}</span>
                    </div>
                  </div>
                  {player.physical && (
                    <div className="flex justify-between">
                      <span>Age</span>
                      <span className="font-semibold">{player.physical.age}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Strengths & Concerns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Key Factors</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2">Strengths</h4>
                  <ul className="space-y-1">
                    {player.analysis.strengths.slice(0, 3).map((strength, idx) => (
                      <li key={idx} className="text-sm text-green-600">• {strength}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-orange-700 mb-2">Concerns</h4>
                  <ul className="space-y-1">
                    {player.analysis.concerns.slice(0, 2).map((concern, idx) => (
                      <li key={idx} className="text-sm text-orange-600">• {concern}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2024 Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Percentile Rankings (2024 Season)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Showing {player.name}'s highest-performing metrics compared to NFL peers
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {player.topPercentileMetrics?.map((metric, idx) => (
                  <div key={idx} className="space-y-3">
                    <PercentileIndicator 
                      percentile={metric.percentile}
                      value={metric.value}
                      label={metric.metric}
                    />
                    <p className="text-sm text-muted-foreground">{metric.context}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Physical Profile Tab */}
        <TabsContent value="physical" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Physical Measurements */}
            <Card>
              <CardHeader>
                <CardTitle>Physical Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {player.physical && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Height</span>
                      <span className="font-semibold">{player.physical.height}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Weight</span>
                      <span className="font-semibold">{player.physical.weight} lbs</span>
                    </div>
                    <div className="flex justify-between">
                      <span>BMI</span>
                      <span className="font-semibold">{player.physical.bmi.toFixed(1)}</span>
                    </div>
                    {player.physical.armLength && (
                      <div className="flex justify-between">
                        <span>Arm Length</span>
                        <span className="font-semibold">{player.physical.armLength}</span>
                      </div>
                    )}
                    {player.physical.handSize && (
                      <div className="flex justify-between">
                        <span>Hand Size</span>
                        <span className="font-semibold">{player.physical.handSize}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Combine/Athletic Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Athletic Profile</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {player.combine && (
                  <div className="space-y-3">
                    {player.combine.rasScore && (
                      <>
                        <div className="text-center space-y-1 pb-3 border-b">
                          <div className="text-2xl font-bold text-purple-600">
                            {player.combine.rasScore.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">RAS Score</div>
                          {player.combine.rasPercentile && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                              {player.combine.rasPercentile.toFixed(1)}th percentile
                            </Badge>
                          )}
                        </div>
                      </>
                    )}
                    
                    {player.combine.fortyYard && (
                      <div className="flex justify-between">
                        <span>40-Yard Dash</span>
                        <span className="font-semibold">{player.combine.fortyYard.toFixed(2)}s</span>
                      </div>
                    )}
                    {player.combine.verticalJump && (
                      <div className="flex justify-between">
                        <span>Vertical Jump</span>
                        <span className="font-semibold">{player.combine.verticalJump}"</span>
                      </div>
                    )}
                    {player.combine.broadJump && (
                      <div className="flex justify-between">
                        <span>Broad Jump</span>
                        <span className="font-semibold">{Math.floor(player.combine.broadJump / 12)}'{player.combine.broadJump % 12}"</span>
                      </div>
                    )}
                    {player.combine.threeCone && (
                      <div className="flex justify-between">
                        <span>3-Cone Drill</span>
                        <span className="font-semibold">{player.combine.threeCone.toFixed(2)}s</span>
                      </div>
                    )}
                    {player.combine.twentyShuttle && (
                      <div className="flex justify-between">
                        <span>20-Yard Shuttle</span>
                        <span className="font-semibold">{player.combine.twentyShuttle.toFixed(2)}s</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dynasty Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Outlook</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {player.analysis.outlook}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-green-700 mb-3">Strengths</h4>
                  <ul className="space-y-2">
                    {player.analysis.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span className="text-green-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-orange-700 mb-3">Concerns</h4>
                  <ul className="space-y-2">
                    {player.analysis.concerns.map((concern, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-orange-600 mt-1">•</span>
                        <span className="text-orange-700">{concern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
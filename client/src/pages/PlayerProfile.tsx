import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Activity, Target, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface PlayerProfile {
  id: number;
  name: string;
  position: string;
  team: string;
  age: number;
  dynastyValue: number;
  dynastyTier: string;
  
  // Advanced metrics
  advancedMetrics: {
    productionScore: number;
    opportunityScore: number;
    ageScore: number;
    stabilityScore: number;
    efficiencyScore?: number;
  };
  
  // Performance data
  performance: {
    ppg2024: number;
    ppg2023?: number;
    gamesPlayed2024: number;
    targets?: number;
    carries?: number;
    fantasyRank: number;
  };
  
  // Analysis
  strengths: string[];
  concerns: string[];
  sleeperInfo?: {
    sleeperId: string;
    confidence: number;
  };
  
  // Validation
  jakeMaraiaRank?: number;
  consensusRank?: number;
}

function getDynastyTierColor(tier: string): string {
  switch (tier) {
    case 'Elite': return 'bg-purple-500';
    case 'Premium': return 'bg-blue-500';
    case 'Strong': return 'bg-green-500';
    case 'Solid': return 'bg-yellow-500';
    case 'Depth': return 'bg-orange-500';
    case 'Bench': return 'bg-gray-500';
    default: return 'bg-gray-400';
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export default function PlayerProfile() {
  const params = useParams();
  const playerName = params.name?.replace(/-/g, ' ') || '';

  const { data: player, isLoading, error } = useQuery<PlayerProfile>({
    queryKey: ['/api/players/profile', playerName],
    enabled: !!playerName
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Player Not Found</h1>
        <p className="text-gray-600 mb-4">
          We couldn't find a player profile for "{playerName}". 
        </p>
        <Link href="/rankings">
          <Button>View All Rankings</Button>
        </Link>
      </div>
    );
  }

  const yearOverYearChange = player.performance.ppg2023 ? 
    player.performance.ppg2024 - player.performance.ppg2023 : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">{player.name}</h1>
          <Badge variant="outline" className="text-sm">
            {player.team} {player.position}
          </Badge>
          <Badge className={getDynastyTierColor(player.dynastyTier)}>
            {player.dynastyTier}
          </Badge>
          {player.sleeperInfo && (
            <Badge variant="secondary">
              Enhanced ({player.sleeperInfo.confidence}% confidence)
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Dynasty Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{player.dynastyValue}</div>
              <div className="text-sm text-gray-600">out of 100</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">2024 PPG</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold">{player.performance.ppg2024}</div>
                {yearOverYearChange !== null && (
                  <div className={`flex items-center text-sm ${yearOverYearChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {yearOverYearChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(yearOverYearChange).toFixed(1)}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {player.performance.gamesPlayed2024} games played
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Age</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{player.age}</div>
              <div className="text-sm text-gray-600">years old</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Fantasy Rank</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">#{player.performance.fantasyRank}</div>
              <div className="text-sm text-gray-600">{player.position} in 2024</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Dynasty Breakdown</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="validation">Benchmarks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {player.strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {player.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                        <span className="text-sm">{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No specific strengths identified</p>
                )}
              </CardContent>
            </Card>

            {/* Concerns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Concerns
                </CardTitle>
              </CardHeader>
              <CardContent>
                {player.concerns.length > 0 ? (
                  <ul className="space-y-2">
                    {player.concerns.map((concern, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
                        <span className="text-sm">{concern}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No specific concerns identified</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>2024 Season Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{player.performance.ppg2024}</div>
                  <div className="text-sm text-gray-600">Points Per Game</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{player.performance.gamesPlayed2024}</div>
                  <div className="text-sm text-gray-600">Games Played</div>
                </div>
                {player.performance.targets && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">{player.performance.targets}</div>
                    <div className="text-sm text-gray-600">Targets</div>
                  </div>
                )}
                {player.performance.carries && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">{player.performance.carries}</div>
                    <div className="text-sm text-gray-600">Carries</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dynasty Valuation Breakdown</CardTitle>
              <CardDescription>
                Our proprietary algorithm weights these components based on predictive research
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Production Score */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Production Score (40% weight)</span>
                  <span className={`font-bold ${getScoreColor(player.advancedMetrics.productionScore)}`}>
                    {player.advancedMetrics.productionScore}/100
                  </span>
                </div>
                <Progress value={player.advancedMetrics.productionScore} className="h-2" />
                <p className="text-sm text-gray-600 mt-1">
                  Fantasy points, consistency, and proven performance
                </p>
              </div>

              {/* Opportunity Score */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Opportunity Score (35% weight)</span>
                  <span className={`font-bold ${getScoreColor(player.advancedMetrics.opportunityScore)}`}>
                    {player.advancedMetrics.opportunityScore}/100
                  </span>
                </div>
                <Progress value={player.advancedMetrics.opportunityScore} className="h-2" />
                <p className="text-sm text-gray-600 mt-1">
                  Target share, team offense, and role within system
                </p>
              </div>

              {/* Age Score */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Age Score (20% weight)</span>
                  <span className={`font-bold ${getScoreColor(player.advancedMetrics.ageScore)}`}>
                    {player.advancedMetrics.ageScore}/100
                  </span>
                </div>
                <Progress value={player.advancedMetrics.ageScore} className="h-2" />
                <p className="text-sm text-gray-600 mt-1">
                  Career longevity and peak performance window
                </p>
              </div>

              {/* Stability Score */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Stability Score (15% weight)</span>
                  <span className={`font-bold ${getScoreColor(player.advancedMetrics.stabilityScore)}`}>
                    {player.advancedMetrics.stabilityScore}/100
                  </span>
                </div>
                <Progress value={player.advancedMetrics.stabilityScore} className="h-2" />
                <p className="text-sm text-gray-600 mt-1">
                  Injury history, team stability, and role security
                </p>
              </div>

              {/* Efficiency Score (position-specific) */}
              {player.advancedMetrics.efficiencyScore && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">
                      Efficiency Score ({player.position === 'QB' ? '20%' : player.position === 'RB' ? '15%' : '10%'} weight)
                    </span>
                    <span className={`font-bold ${getScoreColor(player.advancedMetrics.efficiencyScore)}`}>
                      {player.advancedMetrics.efficiencyScore}/100
                    </span>
                  </div>
                  <Progress value={player.advancedMetrics.efficiencyScore} className="h-2" />
                  <p className="text-sm text-gray-600 mt-1">
                    Advanced metrics and per-touch efficiency
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Methodology Card */}
          <Card>
            <CardHeader>
              <CardTitle>Our Methodology</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Our dynasty algorithm uses research-backed weightings that prioritize predictive metrics over descriptive ones. 
                Opportunity metrics (target share, touches) have higher correlation with future success than efficiency metrics.
              </p>
              <div className="text-xs text-gray-500">
                <Link href="/methodology" className="text-blue-600 hover:underline">
                  View complete methodology →
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Year over year comparison */}
          {player.performance.ppg2023 && (
            <Card>
              <CardHeader>
                <CardTitle>Year-over-Year Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-gray-600">2023 PPG</div>
                    <div className="text-2xl font-bold">{player.performance.ppg2023}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">2024 PPG</div>
                    <div className="text-2xl font-bold">{player.performance.ppg2024}</div>
                  </div>
                </div>
                
                {yearOverYearChange !== null && (
                  <div className="mt-4 p-4 rounded-lg bg-gray-50">
                    <div className={`flex items-center gap-2 ${yearOverYearChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {yearOverYearChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      <span className="font-medium">
                        {yearOverYearChange >= 0 ? '+' : ''}{yearOverYearChange.toFixed(1)} PPG change
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {Math.abs((yearOverYearChange / player.performance.ppg2023!) * 100).toFixed(1)}% 
                      {yearOverYearChange >= 0 ? ' increase' : ' decline'} from 2023
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Performance context */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Fantasy Rank ({player.position})</span>
                  <span className="font-medium">#{player.performance.fantasyRank}</span>
                </div>
                <div className="flex justify-between">
                  <span>Games Played</span>
                  <span className="font-medium">{player.performance.gamesPlayed2024}/17</span>
                </div>
                {player.performance.targets && (
                  <div className="flex justify-between">
                    <span>Total Targets</span>
                    <span className="font-medium">{player.performance.targets}</span>
                  </div>
                )}
                {player.performance.carries && (
                  <div className="flex justify-between">
                    <span>Total Carries</span>
                    <span className="font-medium">{player.performance.carries}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expert Consensus Validation</CardTitle>
              <CardDescription>
                How our ranking compares to established expert consensus
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {player.jakeMaraiaRank && (
                  <div className="flex justify-between items-center">
                    <span>Jake Maraia (FF Dataroma)</span>
                    <Badge variant="outline">#{player.jakeMaraiaRank} {player.position}</Badge>
                  </div>
                )}
                {player.consensusRank && (
                  <div className="flex justify-between items-center">
                    <span>FantasyPros Consensus</span>
                    <Badge variant="outline">#{player.consensusRank} {player.position}</Badge>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prometheus Dynasty Rank</span>
                  <Badge>#{player.performance.fantasyRank} {player.position}</Badge>
                </div>
              </div>
              
              {player.sleeperInfo && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Platform Integration</span>
                  </div>
                  <div className="text-sm text-blue-700">
                    Enhanced with Sleeper platform data (ID: {player.sleeperInfo.sleeperId})
                    <br />
                    Confidence: {player.sleeperInfo.confidence}%
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
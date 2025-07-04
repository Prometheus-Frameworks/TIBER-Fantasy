import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target,
  Crown,
  Star,
  Award,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { Link } from "wouter";
import type { Player } from "@shared/schema";
import { getTierFromScore, getTierColor, getTierLabel } from "@/lib/dynastyTiers";

interface TeamContextData {
  teamName: string;
  totalValue: number;
  leagueRank: number;
  totalTeams: number;
  positionBreakdown: {
    position: string;
    players: Player[];
    totalValue: number;
    averageValue: number;
    leagueAverage: number;
    rank: number;
    strength: 'Elite' | 'Strong' | 'Average' | 'Weak' | 'Critical';
  }[];
  strengths: string[];
  concerns: string[];
  recommendations: {
    action: 'Trade' | 'Pickup' | 'Hold' | 'Sell';
    position: string;
    reason: string;
    urgency: 'High' | 'Medium' | 'Low';
  }[];
  competitiveWindow: {
    status: 'Contending' | 'Retooling' | 'Rebuilding';
    timeframe: string;
    confidence: number;
  };
}

export default function TeamContext() {
  const { data: teamContext, isLoading } = useQuery<TeamContextData>({
    queryKey: ['/api/team-context/analysis'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing your team's dynasty value...</p>
        </div>
      </div>
    );
  }

  if (!teamContext) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Team Synced</h3>
            <p className="text-gray-600 mb-6">
              Sync your fantasy team to see how your roster compares to league averages and get personalized recommendations.
            </p>
            <Link href="/compare-league">
              <Button>
                Sync Your Team
                <Target className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStrengthIcon = (strength: string) => {
    switch (strength) {
      case 'Elite': return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'Strong': return <Star className="w-4 h-4 text-blue-600" />;
      case 'Average': return <Minus className="w-4 h-4 text-gray-600" />;
      case 'Weak': return <ArrowDown className="w-4 h-4 text-orange-600" />;
      case 'Critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'Elite': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Strong': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Average': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'Weak': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Team Overview Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Team in Context</h1>
        <p className="text-lg text-gray-600">
          Dynasty analysis powered by authentic market valuations
        </p>
      </div>

      {/* Team Summary Card */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-blue-600" />
            {teamContext.teamName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {teamContext.totalValue.toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">Total Dynasty Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                #{teamContext.leagueRank}
              </div>
              <div className="text-sm text-gray-600">
                of {teamContext.totalTeams} teams
              </div>
            </div>
            <div className="text-center">
              <Badge 
                variant="outline" 
                className={`text-lg px-4 py-2 ${
                  teamContext.competitiveWindow.status === 'Contending' 
                    ? 'text-green-600 border-green-300 bg-green-50'
                    : teamContext.competitiveWindow.status === 'Retooling'
                    ? 'text-yellow-600 border-yellow-300 bg-yellow-50'
                    : 'text-blue-600 border-blue-300 bg-blue-50'
                }`}
              >
                {teamContext.competitiveWindow.status}
              </Badge>
              <div className="text-sm text-gray-600 mt-1">
                {teamContext.competitiveWindow.timeframe}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="positions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="positions">Position Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="strengths">Strengths & Concerns</TabsTrigger>
          <TabsTrigger value="window">Competitive Window</TabsTrigger>
        </TabsList>

        {/* Position Analysis */}
        <TabsContent value="positions" className="space-y-4">
          <div className="grid gap-4">
            {teamContext.positionBreakdown.map((position) => (
              <Card key={position.position}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {getStrengthIcon(position.strength)}
                      {position.position}
                      <Badge 
                        variant="outline" 
                        className={getStrengthColor(position.strength)}
                      >
                        {position.strength}
                      </Badge>
                    </CardTitle>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        #{position.rank} / {teamContext.totalTeams}
                      </div>
                      <div className="text-sm text-gray-600">League Rank</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Total Value</div>
                      <div className="text-xl font-bold text-blue-600">
                        {position.totalValue.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">vs League Average</div>
                      <div className={`text-xl font-bold flex items-center gap-1 ${
                        position.averageValue > position.leagueAverage 
                          ? 'text-green-600' 
                          : position.averageValue < position.leagueAverage
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {position.averageValue > position.leagueAverage ? (
                          <ArrowUp className="w-4 h-4" />
                        ) : position.averageValue < position.leagueAverage ? (
                          <ArrowDown className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                        {((position.averageValue - position.leagueAverage) / position.leagueAverage * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Players ({position.players.length})</div>
                      <div className="flex gap-1 flex-wrap">
                        {position.players.slice(0, 3).map((player) => (
                          <Badge 
                            key={player.id} 
                            variant="outline" 
                            className={`text-xs ${getTierColor(getTierFromScore(player.dynastyValue || 0))}`}
                          >
                            {player.name}
                          </Badge>
                        ))}
                        {position.players.length > 3 && (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            +{position.players.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress bar showing relative strength */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Position Strength</span>
                      <span>{position.averageValue.toFixed(0)} pts</span>
                    </div>
                    <Progress 
                      value={Math.min(100, (position.averageValue / (position.leagueAverage * 1.5)) * 100)} 
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations" className="space-y-4">
          <div className="grid gap-4">
            {teamContext.recommendations.map((rec, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        rec.urgency === 'High' ? 'bg-red-100' :
                        rec.urgency === 'Medium' ? 'bg-yellow-100' : 'bg-blue-100'
                      }`}>
                        {rec.action === 'Trade' && <TrendingUp className="w-5 h-5 text-blue-600" />}
                        {rec.action === 'Pickup' && <Target className="w-5 h-5 text-green-600" />}
                        {rec.action === 'Hold' && <Shield className="w-5 h-5 text-gray-600" />}
                        {rec.action === 'Sell' && <TrendingDown className="w-5 h-5 text-red-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{rec.action} {rec.position}</h3>
                          <Badge 
                            variant="outline" 
                            className={
                              rec.urgency === 'High' ? 'text-red-600 border-red-200 bg-red-50' :
                              rec.urgency === 'Medium' ? 'text-yellow-600 border-yellow-200 bg-yellow-50' :
                              'text-blue-600 border-blue-200 bg-blue-50'
                            }
                          >
                            {rec.urgency} Priority
                          </Badge>
                        </div>
                        <p className="text-gray-600">{rec.reason}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Strengths & Concerns */}
        <TabsContent value="strengths" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  Team Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamContext.strengths.map((strength, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Star className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{strength}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="w-5 h-5" />
                  Areas of Concern
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamContext.concerns.map((concern, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{concern}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Competitive Window */}
        <TabsContent value="window" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Competitive Window Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600 mb-2">
                    {teamContext.competitiveWindow.status}
                  </div>
                  <div className="text-lg text-gray-600 mb-4">
                    {teamContext.competitiveWindow.timeframe}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-600">Confidence:</span>
                    <Progress 
                      value={teamContext.competitiveWindow.confidence} 
                      className="w-32 h-2" 
                    />
                    <span className="text-sm font-medium">
                      {teamContext.competitiveWindow.confidence}%
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">What This Means:</h4>
                  {teamContext.competitiveWindow.status === 'Contending' && (
                    <p className="text-gray-600">
                      Your team has the dynasty value and youth to compete for championships in the near term. 
                      Focus on optimizing your starting lineup and making strategic upgrades.
                    </p>
                  )}
                  {teamContext.competitiveWindow.status === 'Retooling' && (
                    <p className="text-gray-600">
                      Your team has solid pieces but may need 1-2 years of strategic moves to become a true contender. 
                      Consider trading aging assets for younger talent or draft capital.
                    </p>
                  )}
                  {teamContext.competitiveWindow.status === 'Rebuilding' && (
                    <p className="text-gray-600">
                      Your team is in a rebuilding phase. Focus on accumulating young talent, draft picks, 
                      and trading veteran players for future assets. Plan for a 2-3 year rebuild.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
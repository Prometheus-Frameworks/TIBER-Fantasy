import { useQuery } from "@tanstack/react-query";
import { Loader2, Crown, Trophy, TrendingUp, TrendingDown, Target, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TeamRosterValue {
  teamId: number;
  teamName: string;
  ownerName: string;
  playerValue: number;
  draftPickValue: number;
  totalValue: number;
  leagueRank: number;
  totalTeams: number;
  topPlayers: { name: string; position: string; value: number }[];
  valuablePicksOwned: string[];
  strengthAreas: string[];
  valueDistribution: {
    elite: number;
    starter: number;
    depth: number;
    bench: number;
  };
}

interface LeagueRankings {
  rankings: TeamRosterValue[];
  leagueAnalysis: {
    averageTeamValue: number;
    valueSpread: number;
    topTeamAdvantage: number;
    competitiveBalance: 'High' | 'Medium' | 'Low';
    totalLeagueValue: number;
  };
}

export default function LeagueRankingsPage() {
  const { data: leagueData, isLoading, error } = useQuery<LeagueRankings>({
    queryKey: ['/api/league/rankings'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin field-green mx-auto mb-4" />
          <p className="text-gray-600">Calculating league rankings...</p>
        </div>
      </div>
    );
  }

  if (error || !leagueData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to Load League Rankings</h2>
          <p className="text-gray-600">Unable to calculate total team values</p>
        </div>
      </div>
    );
  }

  const { rankings, leagueAnalysis } = leagueData;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="text-yellow-500" size={20} />;
    if (rank === 2) return <Trophy className="text-gray-400" size={20} />;
    if (rank === 3) return <Trophy className="text-orange-600" size={20} />;
    return null;
  };

  const getRankColor = (rank: number, totalTeams: number) => {
    const percentage = rank / totalTeams;
    if (percentage <= 0.25) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage <= 0.5) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (percentage <= 0.75) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getBalanceColor = (balance: string) => {
    if (balance === 'High') return 'text-green-600 bg-green-50';
    if (balance === 'Medium') return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Users className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">League Rankings</h1>
              <p className="text-gray-600">Total roster value including players and draft picks</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* League Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{rankings.length}</div>
                <div className="text-sm text-gray-500">Teams</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{leagueAnalysis.averageTeamValue.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Avg Value</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{leagueAnalysis.valueSpread.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Value Spread</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className={`text-2xl font-bold px-2 py-1 rounded ${getBalanceColor(leagueAnalysis.competitiveBalance)}`}>
                  {leagueAnalysis.competitiveBalance}
                </div>
                <div className="text-sm text-gray-500 mt-1">Balance</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Rankings */}
        <div className="space-y-4">
          {rankings.map((team) => (
            <Card key={team.teamId} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  {/* Team Info */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getRankIcon(team.leagueRank)}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-2 ${getRankColor(team.leagueRank, team.totalTeams)}`}>
                        <span className="text-xl font-bold">#{team.leagueRank}</span>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{team.teamName}</h3>
                      <p className="text-gray-600">{team.ownerName}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {team.strengthAreas.slice(0, 2).map((strength, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Value Breakdown */}
                  <div className="grid grid-cols-3 gap-4 text-center lg:text-right">
                    <div>
                      <div className="text-lg font-bold text-gray-900">{team.playerValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Players</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">{team.draftPickValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Draft Picks</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold field-green">{team.totalValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Total Value</div>
                    </div>
                  </div>
                </div>

                {/* Value Distribution Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Value Distribution</span>
                    <span>{team.totalValue.toLocaleString()} total</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full flex">
                      <div 
                        className="bg-yellow-500" 
                        style={{ width: `${(team.valueDistribution.elite / team.totalValue) * 100}%` }}
                        title={`Elite: ${team.valueDistribution.elite}`}
                      />
                      <div 
                        className="bg-green-500" 
                        style={{ width: `${(team.valueDistribution.starter / team.totalValue) * 100}%` }}
                        title={`Starters: ${team.valueDistribution.starter}`}
                      />
                      <div 
                        className="bg-blue-500" 
                        style={{ width: `${(team.valueDistribution.depth / team.totalValue) * 100}%` }}
                        title={`Depth: ${team.valueDistribution.depth}`}
                      />
                      <div 
                        className="bg-gray-400" 
                        style={{ width: `${(team.valueDistribution.bench / team.totalValue) * 100}%` }}
                        title={`Bench: ${team.valueDistribution.bench}`}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-500 rounded mr-1" />
                        <span>Elite</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded mr-1" />
                        <span>Starters</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded mr-1" />
                        <span>Depth</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-gray-400 rounded mr-1" />
                        <span>Bench</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Players & Draft Picks */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Top Players</h4>
                    <div className="space-y-1">
                      {team.topPlayers.slice(0, 3).map((player, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-700">{player.name} ({player.position})</span>
                          <span className="font-medium">{player.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Valuable Draft Picks</h4>
                    <div className="space-y-1">
                      {team.valuablePicksOwned.length > 0 ? (
                        team.valuablePicksOwned.slice(0, 3).map((pick, index) => (
                          <div key={index} className="text-sm text-blue-600">
                            {pick}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">No high-value picks</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* League Analysis */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>League Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{leagueAnalysis.topTeamAdvantage}%</div>
                <div className="text-gray-600">Top Team Advantage</div>
                <div className="text-sm text-gray-500 mt-1">How much the #1 team exceeds average</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{leagueAnalysis.totalLeagueValue.toLocaleString()}</div>
                <div className="text-gray-600">Total League Value</div>
                <div className="text-sm text-gray-500 mt-1">Combined value of all assets</div>
              </div>
              
              <div className="text-center">
                <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getBalanceColor(leagueAnalysis.competitiveBalance)}`}>
                  {leagueAnalysis.competitiveBalance}
                </div>
                <div className="text-gray-600">Competitive Balance</div>
                <div className="text-sm text-gray-500 mt-1">Based on value distribution</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
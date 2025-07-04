import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, TrendingUp, TrendingDown, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeagueTeam {
  teamId: string;
  teamName: string;
  ownerName: string;
  totalPoints: number;
  record: string;
  dynastyValue: number;
  teamRank: number;
  strengths: string[];
  weaknesses: string[];
  topPlayers: { name: string; position: string; value: number }[];
}

interface LeagueAnalysis {
  leagueId: string;
  leagueName: string;
  leagueSettings: {
    totalTeams: number;
    scoringFormat: string;
    leagueType: string;
  };
  teams: LeagueTeam[];
  yourTeam: LeagueTeam | null;
  leagueAverages: {
    avgDynastyValue: number;
    avgTotalPoints: number;
    valueSpread: number;
  };
  powerRankings: LeagueTeam[];
}

export default function LeagueAnalysis() {
  const [leagueId, setLeagueId] = useState("1197631162923614208"); // Default to your league
  const [userId, setUserId] = useState("");
  const [searchLeagueId, setSearchLeagueId] = useState(leagueId);

  const { data: leagueData, isLoading, error, refetch } = useQuery<LeagueAnalysis>({
    queryKey: ['/api/league', leagueId, 'analysis', userId || undefined],
    queryFn: async () => {
      const url = userId 
        ? `/api/league/${leagueId}/analysis?userId=${userId}`
        : `/api/league/${leagueId}/analysis`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch league analysis');
      return response.json();
    },
    enabled: !!leagueId
  });

  const handleAnalyzeLeague = () => {
    setLeagueId(searchLeagueId);
    refetch();
  };

  const getRankColor = (rank: number, totalTeams: number) => {
    if (rank <= 2) return "text-green-600 bg-green-50";
    if (rank <= 4) return "text-blue-600 bg-blue-50";
    if (rank >= totalTeams - 2) return "text-red-600 bg-red-50";
    return "text-gray-600 bg-gray-50";
  };

  const getValueVsAverage = (value: number, average: number) => {
    const diff = value - average;
    const percentage = ((diff / average) * 100).toFixed(1);
    return {
      diff: Math.round(diff),
      percentage,
      isAbove: diff > 0
    };
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to load league data</p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* League Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            League Analysis
          </CardTitle>
          <CardDescription>
            Analyze your Sleeper dynasty league and compare all teams
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Sleeper League ID"
              value={searchLeagueId}
              onChange={(e) => setSearchLeagueId(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Your User ID (optional)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAnalyzeLeague}>
              Analyze League
            </Button>
          </div>
          {leagueData && (
            <div className="text-sm text-gray-600">
              Currently analyzing: <strong>{leagueData.leagueName}</strong> 
              {leagueData.yourTeam && (
                <span> • Your team: <strong>{leagueData.yourTeam.teamName}</strong></span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {leagueData && (
        <>
          {/* League Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{leagueData.leagueSettings.totalTeams}</div>
                  <div className="text-sm text-gray-600">Teams</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                  <div className="text-2xl font-bold">{leagueData.leagueAverages.avgDynastyValue}</div>
                  <div className="text-sm text-gray-600">Avg Dynasty Value</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold">{leagueData.leagueAverages.valueSpread}</div>
                  <div className="text-sm text-gray-600">Value Spread</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">League Format</div>
                  <Badge variant="outline" className="mb-1">
                    {leagueData.leagueSettings.leagueType}
                  </Badge>
                  <div className="text-sm font-medium">{leagueData.leagueSettings.scoringFormat}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Your Team Highlight */}
          {leagueData.yourTeam && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Your Team: {leagueData.yourTeam.teamName}</span>
                  <Badge className={getRankColor(leagueData.yourTeam.teamRank, leagueData.teams.length)}>
                    #{leagueData.yourTeam.teamRank} of {leagueData.teams.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Dynasty Value</div>
                    <div className="text-2xl font-bold">{leagueData.yourTeam.dynastyValue}</div>
                    {(() => {
                      const comparison = getValueVsAverage(leagueData.yourTeam.dynastyValue, leagueData.leagueAverages.avgDynastyValue);
                      return (
                        <div className={`text-sm ${comparison.isAbove ? 'text-green-600' : 'text-red-600'}`}>
                          {comparison.isAbove ? '+' : ''}{comparison.diff} ({comparison.isAbove ? '+' : ''}{comparison.percentage}%)
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">2024 Points</div>
                    <div className="text-2xl font-bold">{leagueData.yourTeam.totalPoints}</div>
                    <div className="text-sm text-gray-600">Record: {leagueData.yourTeam.record}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Top Players</div>
                    <div className="space-y-1">
                      {leagueData.yourTeam.topPlayers.slice(0, 3).map((player, idx) => (
                        <div key={idx} className="text-xs">
                          {player.name} ({player.position})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Rankings */}
          <Tabs defaultValue="power" className="space-y-4">
            <TabsList>
              <TabsTrigger value="power">Power Rankings</TabsTrigger>
              <TabsTrigger value="standings">Current Standings</TabsTrigger>
              <TabsTrigger value="details">Team Details</TabsTrigger>
            </TabsList>

            <TabsContent value="power" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leagueData.powerRankings.map((team) => (
                  <Card key={team.teamId} className={team.teamId === leagueData.yourTeam?.teamId ? "border-blue-200 bg-blue-50" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{team.teamName}</CardTitle>
                        <Badge className={getRankColor(team.teamRank, leagueData.teams.length)}>
                          #{team.teamRank}
                        </Badge>
                      </div>
                      <CardDescription>{team.ownerName}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Dynasty Value</span>
                        <span className="font-bold">{team.dynastyValue}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">2024 Record</span>
                        <span>{team.record}</span>
                      </div>
                      
                      {team.strengths.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Strengths</div>
                          <div className="flex flex-wrap gap-1">
                            {team.strengths.slice(0, 2).map((strength, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {strength}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {team.topPlayers.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Top Players</div>
                          <div className="text-xs space-y-1">
                            {team.topPlayers.slice(0, 2).map((player, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{player.name}</span>
                                <span className="text-gray-600">{player.position}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="standings">
              <Card>
                <CardHeader>
                  <CardTitle>2024 Season Standings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...leagueData.teams].sort((a, b) => b.totalPoints - a.totalPoints).map((team, idx) => (
                      <div key={team.teamId} className={`flex items-center justify-between p-3 rounded ${team.teamId === leagueData.yourTeam?.teamId ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center font-bold">#{idx + 1}</span>
                          <div>
                            <div className="font-medium">{team.teamName}</div>
                            <div className="text-sm text-gray-600">{team.ownerName}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{team.record}</div>
                          <div className="text-sm text-gray-600">{team.totalPoints} pts</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {leagueData.teams.map((team) => (
                  <Card key={team.teamId} className={team.teamId === leagueData.yourTeam?.teamId ? "border-blue-200 bg-blue-50" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{team.teamName}</CardTitle>
                        <div className="text-right">
                          <Badge className={getRankColor(team.teamRank, leagueData.teams.length)}>
                            Dynasty #{team.teamRank}
                          </Badge>
                          <div className="text-sm text-gray-600 mt-1">Value: {team.dynastyValue}</div>
                        </div>
                      </div>
                      <CardDescription>{team.ownerName} • {team.record}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {team.strengths.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-green-700 mb-2">Strengths</div>
                            <div className="space-y-1">
                              {team.strengths.map((strength, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs mr-1 mb-1">
                                  {strength}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {team.weaknesses.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-red-700 mb-2">Weaknesses</div>
                            <div className="space-y-1">
                              {team.weaknesses.map((weakness, idx) => (
                                <Badge key={idx} variant="destructive" className="text-xs mr-1 mb-1">
                                  {weakness}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {team.topPlayers.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2">Top Dynasty Assets</div>
                          <div className="space-y-1">
                            {team.topPlayers.map((player, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{player.name}</span>
                                <span className="text-gray-600">{player.position} • {player.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
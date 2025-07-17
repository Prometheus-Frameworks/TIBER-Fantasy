import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BarChart3, Target, TrendingUp, Users, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface TeamData {
  name: string;
  city: string;
  oasisScore: number;
  color: string;
  [key: string]: any; // Allow additional fields from API
}

interface OasisApiResponse {
  success: boolean;
  teams: TeamData[];
  cacheStatus: {
    cached: boolean;
    age: number;
    ttl: number;
  };
  timestamp: string;
}

export default function Oasis() {
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);

  // Fetch OASIS data from external API
  const { data: apiResponse, isLoading, error, refetch } = useQuery<OasisApiResponse>({
    queryKey: ['/api/oasis/teams'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  const nflTeams = apiResponse?.teams || [];
  const isUsingLiveData = apiResponse?.success === true;
  const cacheStatus = apiResponse?.cacheStatus;

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getBarWidth = (score: number) => {
    return `${(score / 100) * 100}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            OASIS: Team Environments Decoded
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-4">
            Offensive Architecture Scoring & Insight System - Revealing the hidden patterns that drive fantasy production
          </p>
          
          {/* API Status Indicator */}
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isUsingLiveData ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isUsingLiveData ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              {isLoading ? 'Loading...' : isUsingLiveData ? 'Live Data' : 'Fallback Mode'}
            </div>
            
            {cacheStatus && isUsingLiveData && (
              <span className="text-gray-500">
                {cacheStatus.cached ? `Cached (${Math.round(cacheStatus.age / 1000)}s ago)` : 'Fresh'}
              </span>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              ⚠️ API Error: Using fallback data
            </div>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading OASIS data...</span>
              </div>
            </CardContent>
          </Card>
        ) : nflTeams.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-red-600 mb-4">
                ⚠️ No team data available
              </div>
              <Button onClick={() => refetch()} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : !selectedTeam ? (
          <>
            {/* Team Rankings Chart */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-teal-600" />
                  NFL Team Environment Rankings
                </CardTitle>
                <CardDescription>
                  Click on any team to explore their offensive architecture insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nflTeams.map((team, index) => (
                    <div
                      key={team.name}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-teal-300 cursor-pointer transition-colors"
                      onClick={() => setSelectedTeam(team)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500 w-8">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {team.city} {team.name}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-teal-500 h-2 rounded-full transition-all"
                            style={{ width: getBarWidth(team.oasisScore) }}
                          ></div>
                        </div>
                        <span className={`font-bold text-lg w-12 ${getScoreColor(team.oasisScore)}`}>
                          {team.oasisScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Team Insight Page */
          <div className="space-y-6">
            {/* Back Button */}
            <Button 
              variant="outline" 
              onClick={() => setSelectedTeam(null)}
              className="mb-4"
            >
              ← Back to Rankings
            </Button>

            {/* Team Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl" style={{ color: selectedTeam.color }}>
                  {selectedTeam.city} {selectedTeam.name}
                </CardTitle>
                <CardDescription>
                  OASIS Score: <span className={`font-bold ${getScoreColor(selectedTeam.oasisScore)}`}>
                    {selectedTeam.oasisScore}/100
                  </span>
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Offense Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-teal-600" />
                  Offense Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">12.4</div>
                    <div className="text-sm text-gray-600">Red zone plays/game</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">0.18</div>
                    <div className="text-sm text-gray-600">EPA per play</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">62/38</div>
                    <div className="text-sm text-gray-600">Pass/run rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">26.8</div>
                    <div className="text-sm text-gray-600">Pace of play</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">B+</div>
                    <div className="text-sm text-gray-600">OL strength</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Positional Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-teal-600" />
                  Positional Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Target Distribution</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>WR1 Target Share</span>
                        <span className="font-semibold">28.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>WR2 Target Share</span>
                        <span className="font-semibold">18.2%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TE Target Share</span>
                        <span className="font-semibold">15.7%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>RB Target Share</span>
                        <span className="font-semibold">12.3%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Key Roles</h4>
                    <div className="space-y-2 text-sm">
                      <div className="bg-teal-50 p-2 rounded">
                        <span className="font-semibold">Slot WR:</span> High-volume target funnel
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <span className="font-semibold">Red Zone TE:</span> Primary scoring threat
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <span className="font-semibold">Pass-catching RB:</span> Checkdown specialist
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Funnel & Fantasy Takeaway */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    Usage Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-teal-600 mb-2">
                      Wide Offense
                    </div>
                    <p className="text-sm text-gray-600">
                      Distributes targets across multiple receivers, creating opportunities for deeper bench players
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Fantasy Takeaway</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-teal-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-teal-800">
                      Best team for slot WR production and TE touchdown upside. 
                      RB receiving floor makes this backfield valuable in PPR formats.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Philosophy Footer */}
        <div className="mt-16 text-center">
          <div className="max-w-2xl mx-auto bg-gray-50 p-6 rounded-lg">
            <p className="text-gray-700 font-medium italic">
              "Uncertainty as insight. We don't predict success – we show the patterns that fuel it."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
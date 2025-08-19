import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link2, User, Users, CheckCircle, AlertCircle, ExternalLink, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface League {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  scoring_settings?: any;
}

interface UserData {
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: any;
}

export default function SleeperConnect() {
  const [username, setUsername] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<"username" | "league">("username");
  const { toast } = useToast();

  // Query for user lookup
  const { data: userData, isLoading: userLoading, error: userError } = useQuery<ApiResponse<UserData>>({
    queryKey: [`/api/sleeper/user/${username}`],
    enabled: !!username && username.length > 2 && selectedMethod === "username",
    retry: false
  });

  // Query for user's leagues
  const { data: leaguesData, isLoading: leaguesLoading } = useQuery<ApiResponse<League[]>>({
    queryKey: [`/api/sleeper/leagues/${userData?.data?.user_id}`],
    enabled: !!userData?.data?.user_id,
    retry: false
  });

  // Query for direct league lookup
  const { data: leagueData, isLoading: leagueLoading, error: leagueError } = useQuery<ApiResponse<any>>({
    queryKey: [`/api/sleeper/league/${leagueId}/context`],
    enabled: !!leagueId && leagueId.length > 5 && selectedMethod === "league",
    retry: false
  });

  const handleConnectLeague = (league: League) => {
    // Navigate to dashboard with league context
    window.location.href = `/dashboard?league=${league.league_id}&user=${userData?.data?.user_id}&username=${username}`;
  };

  const handleDirectLeagueConnect = () => {
    if (leagueData?.data) {
      window.location.href = `/dashboard?league=${leagueId}`;
    }
  };

  const handleViewAllLeagues = () => {
    if (userData?.data?.user_id) {
      window.location.href = `/dashboard?user=${userData.data.user_id}&username=${username}`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Link2 className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900">Connect Your Sleeper League</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Connect your Sleeper account to sync league rosters, get personalized trade insights, 
          and unlock advanced analytics for your actual teams.
        </p>
      </div>

      {/* Connection Methods */}
      <Tabs value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as "username" | "league")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="username" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            By Username
          </TabsTrigger>
          <TabsTrigger value="league" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            By League ID
          </TabsTrigger>
        </TabsList>

        {/* Username Method */}
        <TabsContent value="username" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Find Your Leagues
              </CardTitle>
              <CardDescription>
                Enter your Sleeper username to find and connect your leagues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter your Sleeper username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={() => setUsername(username)}
                  disabled={!username || username.length < 3}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Find Leagues
                </Button>
              </div>

              {/* User Info */}
              {userData?.data && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">
                        Found user: {userData.data.display_name || userData.data.username}
                      </p>
                      <p className="text-sm text-green-700">User ID: {userData.data.user_id}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* User Error */}
              {userError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-900">User not found</p>
                      <p className="text-sm text-red-700">Please check the username and try again</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {(userLoading || leaguesLoading) && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="mt-2 text-gray-600">Loading...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leagues List */}
          {leaguesData?.data && Array.isArray(leaguesData.data) && (
            <Card>
              <CardHeader>
                <CardTitle>Your Leagues</CardTitle>
                <CardDescription>
                  Select a league to connect and start syncing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {leaguesData.data.length > 0 && (
                    <Button 
                      onClick={handleViewAllLeagues}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 mb-4"
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      View All Leagues ({leaguesData.data.length})
                    </Button>
                  )}
                  
                  {leaguesData.data.map((league: League) => (
                    <div
                      key={league.league_id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900">{league.name}</h3>
                        <p className="text-sm text-gray-600">
                          {league.total_rosters} teams • Season {league.season}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleConnectLeague(league)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Connect
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* League ID Method */}
        <TabsContent value="league" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Connect by League ID
              </CardTitle>
              <CardDescription>
                Have a specific league ID? Connect directly to any league
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter League ID"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={() => setLeagueId(leagueId)}
                  disabled={!leagueId || leagueId.length < 5}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Connect League
                </Button>
              </div>

              {/* League Info */}
              {leagueData?.data && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900">
                        {leagueData.data.league?.name || 'League Found'}
                      </p>
                      <p className="text-sm text-green-700">
                        {leagueData.data.league?.total_rosters || 0} teams • Season {leagueData.data.league?.season || '2024'}
                      </p>
                    </div>
                    <Button
                      onClick={handleDirectLeagueConnect}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </div>
              )}

              {/* League Error */}
              {leagueError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-900">League not found</p>
                      <p className="text-sm text-red-700">Please check the league ID and try again</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {leagueLoading && (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="mt-2 text-gray-600">Loading league...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Finding Your Username</h4>
              <p className="text-sm text-gray-600 mb-2">
                Your Sleeper username is displayed in your profile. It's usually different from your display name.
              </p>
              <a 
                href="https://sleeper.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm"
              >
                Open Sleeper App <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Finding League ID</h4>
              <p className="text-sm text-gray-600 mb-2">
                League ID can be found in your league URL or by asking your league commissioner.
              </p>
              <p className="text-xs text-gray-500">
                Example: https://sleeper.app/leagues/123456789/team
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
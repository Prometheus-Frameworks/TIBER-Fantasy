import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Users, Calendar, ExternalLink, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface League {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  total_rosters: number;
  scoring_settings: any;
  roster_positions: string[];
  settings: any;
}

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: any;
}

export default function Dashboard() {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Extract parameters from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const leagueParam = urlParams.get('league');
    const userParam = urlParams.get('user');
    const usernameParam = urlParams.get('username');
    
    if (leagueParam) setLeagueId(leagueParam);
    if (userParam) setUserId(userParam);
    if (usernameParam) setUsername(usernameParam);
  }, []);

  // Query for user's leagues if we have user info
  const { data: leaguesData, isLoading: leaguesLoading, error: leaguesError } = useQuery<ApiResponse<League[]>>({
    queryKey: [`/api/sleeper/leagues/${userId}`],
    enabled: !!userId,
    retry: false
  });

  // Query for specific league context if we have a league ID
  const { data: leagueData, isLoading: leagueLoading, error: leagueError } = useQuery<ApiResponse<any>>({
    queryKey: [`/api/sleeper/league/${leagueId}/context`],
    enabled: !!leagueId,
    retry: false
  });

  const handleBackToConnect = () => {
    setLocation('/sleeper-connect');
  };

  const getLeagueTypeDisplay = (league: League) => {
    const isDynasty = league.settings?.type === 2;
    const isSuperflex = league.roster_positions?.includes('SUPER_FLEX');
    const teamCount = league.total_rosters;
    
    let type = isDynasty ? 'Dynasty' : 'Redraft';
    if (isSuperflex) type += ' SF';
    
    return `${teamCount}-Team ${type}`;
  };

  const getScoringDisplay = (league: League) => {
    const ppr = league.scoring_settings?.rec || 0;
    if (ppr === 1) return 'PPR';
    if (ppr === 0.5) return '0.5 PPR';
    return 'Standard';
  };

  if (leaguesLoading || leagueLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (leaguesError || leagueError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Data</CardTitle>
            <CardDescription>
              Failed to load your leagues. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToConnect} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Connect
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If we have league data, show single league view
  if (leagueData?.data && leagueId) {
    const league = leagueData.data;
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Button onClick={handleBackToConnect} variant="outline" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Connect
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {league.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {getLeagueTypeDisplay(league)} • {getScoringDisplay(league)} • {league.season} Season
              </p>
            </div>
            <Trophy className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                League Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Teams:</span>
                <span className="font-medium">{league.total_rosters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Scoring:</span>
                <span className="font-medium">{getScoringDisplay(league)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Season:</span>
                <span className="font-medium">{league.season}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <Badge variant="secondary">
                  {getLeagueTypeDisplay(league)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Sleeper
              </Button>
              <Button className="w-full" variant="outline">
                <Trophy className="mr-2 h-4 w-4" />
                League Analytics
              </Button>
              <Button className="w-full" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Team Rosters
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show all leagues for user
  const leagues = leaguesData?.data || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Button onClick={handleBackToConnect} variant="outline" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Connect
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Your Fantasy Leagues
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {username && `@${username} • `}{leagues.length} league{leagues.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Trophy className="h-8 w-8 text-yellow-500" />
        </div>
      </div>

      {leagues.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Leagues Found</CardTitle>
            <CardDescription>
              No leagues were found for the 2025 season. Try connecting with a different username or check your Sleeper account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackToConnect} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Try Different Username
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league: League) => (
            <Card key={league.league_id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">{league.name}</CardTitle>
                <CardDescription>
                  {getLeagueTypeDisplay(league)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Scoring:</span>
                    <Badge variant="secondary">{getScoringDisplay(league)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Season:</span>
                    <span className="text-sm font-medium">{league.season}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Teams:</span>
                    <span className="text-sm font-medium">{league.total_rosters}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => window.location.href = `/dashboard?league=${league.league_id}&username=${username}`}
                  >
                    <Trophy className="mr-2 h-4 w-4" />
                    View League
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => window.open(`https://sleeper.com/leagues/${league.league_id}`, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in Sleeper
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
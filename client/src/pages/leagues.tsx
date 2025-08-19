import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Users, Calendar, ArrowLeft, Crown, Star } from "lucide-react";
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

export default function Leagues() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Extract parameters from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    const usernameParam = urlParams.get('username');
    
    if (userParam) setUserId(userParam);
    if (usernameParam) setUsername(usernameParam);
  }, []);

  // Query for user's leagues
  const { data: leaguesData, isLoading, error } = useQuery<ApiResponse<League[]>>({
    queryKey: [`/api/sleeper/leagues/${userId}`],
    enabled: !!userId,
    retry: false
  });

  const handleLeagueSelect = (league: League) => {
    setLocation(`/dashboard?league=${league.league_id}&user=${userId}&username=${username}`);
  };

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

  const getLeagueTypeColor = (league: League) => {
    const isDynasty = league.settings?.type === 2;
    return isDynasty ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Leagues</h2>
              <p className="text-red-700 mb-4">Failed to load your leagues. Please try again.</p>
              <Button onClick={handleBackToConnect} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Connect
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const leagues = leaguesData?.data || [];

  if (leagues.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Trophy className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Leagues Found</h2>
              <p className="text-gray-600 mb-4">
                We couldn't find any leagues for {username}. Try connecting a different account.
              </p>
              <Button onClick={handleBackToConnect} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Connect
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            onClick={handleBackToConnect} 
            variant="ghost" 
            size="sm"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Connect
          </Button>
        </div>
        
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900">Your Sleeper Leagues</h1>
        </div>
        
        {username && (
          <p className="text-gray-600">
            Found {leagues.length} league{leagues.length !== 1 ? 's' : ''} for <span className="font-medium">{username}</span>
          </p>
        )}
      </div>

      {/* Leagues Grid */}
      <div className="grid gap-4">
        {leagues.map((league: League) => (
          <Card 
            key={league.league_id} 
            className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-purple-500"
            onClick={() => handleLeagueSelect(league)}
          >
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl text-gray-900 mb-2 flex items-center gap-2">
                    {league.name}
                    {league.settings?.type === 2 && (
                      <Crown className="h-5 w-5 text-purple-600" />
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {league.total_rosters} Teams
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {league.season}
                    </span>
                  </CardDescription>
                </div>
                
                <div className="flex flex-col gap-2 items-end">
                  <Badge className={getLeagueTypeColor(league)}>
                    {getLeagueTypeDisplay(league)}
                  </Badge>
                  {league.roster_positions?.includes('SUPER_FLEX') && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <Star className="h-3 w-3 mr-1" />
                      Superflex
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Click to view league dashboard and roster analysis
                </div>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLeagueSelect(league);
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  View Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      {leagues.length > 0 && (
        <Card className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {leagues.length}
                </div>
                <div className="text-sm text-gray-600">Total Leagues</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {leagues.filter(l => l.settings?.type === 2).length}
                </div>
                <div className="text-sm text-gray-600">Dynasty</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {leagues.filter(l => l.settings?.type !== 2).length}
                </div>
                <div className="text-sm text-gray-600">Redraft</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {leagues.filter(l => l.roster_positions?.includes('SUPER_FLEX')).length}
                </div>
                <div className="text-sm text-gray-600">Superflex</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
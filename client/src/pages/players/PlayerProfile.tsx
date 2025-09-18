import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, playerOf } from "@/lib/playerPool";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, Compass, BarChart3, TrendingUp, Calendar, ExternalLink } from "lucide-react";

interface PlayerData {
  id: string;
  name: string;
  team: string;
  pos: string;
  aliases: string[];
}

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch real player data from API with ID resolution
  const { data: playerData, isLoading: playerLoading, error: playerError } = useQuery({
    queryKey: [`/api/players/resolve/${id}`],
    queryFn: async () => {
      if (!id) throw new Error('No player ID provided');
      console.log(`🔍 Resolving player ID: ${id}`);
      const player = await api.resolvePlayer(id);
      if (!player) throw new Error(`Player not found or could not be resolved: ${id}`);
      return player;
    },
    enabled: !!id,
    retry: 2,
  });

  // Try to get additional player info from local index
  const localPlayerInfo = id ? playerOf(id) : null;

  const player = playerData;

  const compassData = {
    talent: 85,
    situation: 72,
    trajectory: 90,
    risk: 25
  };

  const consensusData = {
    dynastyRank: 12,
    dynastyTier: 2,
    redraftRank: 8,
    redraftTier: 1,
    movement30d: "+3"
  };

  if (!id) {
    return (
      <div className="space-y-6" data-testid="player-profile-no-id">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">Invalid Player</h3>
          <p className="text-red-600 dark:text-red-300">No player ID provided in the URL.</p>
          <Link href="/player-rankings">
            <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700" data-testid="button-back-to-rankings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Rankings
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (playerLoading) {
    return (
      <div className="space-y-6" data-testid="player-profile-loading">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
            <div className="h-48 bg-gray-200 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (playerError || !player) {
    return (
      <div className="space-y-6" data-testid="player-profile-error">
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-400 mb-2">
            Player Not Found
          </h3>
          <p className="text-orange-600 dark:text-orange-300">
            {playerError?.message || `No data available for player ID: ${id}`}
          </p>
          <p className="text-sm text-orange-500 dark:text-orange-400 mt-2">
            This player may not be in our database yet.
          </p>
          <Link href="/player-rankings">
            <button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700" data-testid="button-back-to-rankings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Rankings
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/player-rankings">
          <button className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4" data-testid="button-back-nav">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Rankings
          </button>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
          <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-player-name">
              {player.name}
            </h1>
            <Badge variant="outline" className="text-sm" data-testid="badge-player-team-pos">
              {player.team} {player.pos}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
            <span data-testid="text-player-id">ID: {player.id}</span>
            {player.aliases && player.aliases.length > 0 && (
              <span data-testid="text-player-aliases">Aliases: {player.aliases.join(', ')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compass">Compass</TabsTrigger>
          <TabsTrigger value="consensus">Consensus</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="projections">Projections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Dynasty Rank</span>
                    <span className="font-medium">#{consensusData.dynastyRank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Redraft Rank</span>
                    <span className="font-medium">#{consensusData.redraftRank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">30-day Movement</span>
                    <span className="font-medium text-green-600">{consensusData.movement30d}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Compass className="h-5 w-5" />
                  Compass Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Talent</span>
                    <span className="font-medium">{compassData.talent}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Situation</span>
                    <span className="font-medium">{compassData.situation}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Trajectory</span>
                    <span className="font-medium">{compassData.trajectory}/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compass" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5" />
                  Player Compass Analysis
                </div>
                <Link href="/consensus">
                  <Button variant="outline" size="sm">
                    Switch to Consensus →
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{compassData.talent}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Talent</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{compassData.situation}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Situation</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{compassData.trajectory}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Trajectory</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{100 - compassData.risk}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Stability</div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h4 className="font-medium mb-2">Database Information</h4>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div><strong>Player ID:</strong> {player.id}</div>
                  <div><strong>Team:</strong> {player.team}</div>
                  <div><strong>Position:</strong> {player.pos}</div>
                  {player.aliases && player.aliases.length > 0 && (
                    <div><strong>Known Aliases:</strong> {player.aliases.join(', ')}</div>
                  )}
                  {localPlayerInfo && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <strong>Local Index Data:</strong> {localPlayerInfo.name} ({localPlayerInfo.team} {localPlayerInfo.pos})
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consensus" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Consensus Rankings
                </div>
                <Link href="/compass">
                  <Button variant="outline" size="sm">
                    Switch to Compass →
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Dynasty</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Current Rank</span>
                      <span className="font-medium">#{consensusData.dynastyRank}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tier</span>
                      <Badge variant="outline">Tier {consensusData.dynastyTier}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">30-day Change</span>
                      <span className="font-medium text-green-600">{consensusData.movement30d}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Redraft 2025</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Current Rank</span>
                      <span className="font-medium">#{consensusData.redraftRank}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tier</span>
                      <Badge variant="outline">Tier {consensusData.redraftTier}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">ADP</span>
                      <span className="font-medium">1.08</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Link href="/consensus">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Full Board
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Game Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Game logs will be available during the season</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                2025 Projections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">2025 projections coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
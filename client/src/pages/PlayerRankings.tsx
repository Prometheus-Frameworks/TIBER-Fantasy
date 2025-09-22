import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Activity, Target, Users, Clock, Zap, Trophy, Filter, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";

type Position = "ALL" | "QB" | "RB" | "WR" | "TE";
type Format = "dynasty" | "redraft";

interface PlayerAttribute {
  season: number;
  week: number;
  otcId: string;
  team: string;
  position: Position;
  playerName?: string;
  targets?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTds?: number;
  carries?: number;
  rushingYards?: number;
  rushingTds?: number;
  fantasyPtsHalfppr?: number;
  fantasyPtsPpr?: number;
  fantasyPtsStandard?: number;
  createdAt: string;
  updatedAt: string;
}

interface AttributesResponse {
  success: boolean;
  data: {
    season: number;
    week: number;
    position: string;
    team: string;
    attributes: PlayerAttribute[];
    stats: {
      totalPlayers: number;
      byPosition: Record<string, number>;
      latestUpdate: string;
      completenessScore: number;
    };
    total_players: number;
    showing: number;
    limit: number;
  };
  generated_at: string;
}

interface OVRPlayer {
  player_id: string;
  name: string;
  team: string;
  position: Position;
  ovr: number;
  tier: string;
  age?: number;
  dynasty_value?: number;
  recent_trend?: "up" | "down" | "stable";
}

interface MergedPlayer extends OVRPlayer {
  weeklyData?: PlayerAttribute;
  mappingResult?: {
    canonicalId: string;
    otcId: string;
    sleeperId?: string;
    confidence: number;
    mappingMethod: string;
    attributeMatchMethod?: string;
  };
  mappingError?: string;
}

interface MergedPlayerResponse {
  success: boolean;
  data: {
    players: MergedPlayer[];
    metadata: {
      format: string;
      position: string;
      season: string;
      week: string;
      total_players: number;
      ovr_source: any;
      attributes_source: any;
      mapping_stats: {
        total_merged: number;
        with_weekly_data: number;
        mapping_errors: number;
      };
    };
    generated_at: string;
  };
}

interface OVRResponse {
  success: boolean;
  data: {
    players: OVRPlayer[];
    distribution: {
      elite: number;
      great: number;
      good: number;
      average: number;
      below_average: number;
    };
    metadata: {
      format: string;
      position: string;
      total_players: number;
      generated_at: string;
    };
  };
}

function getOVRColor(ovr: number): string {
  if (ovr >= 90) return "text-yellow-500 bg-yellow-50 border-yellow-200";
  if (ovr >= 80) return "text-green-500 bg-green-50 border-green-200";
  if (ovr >= 70) return "text-blue-500 bg-blue-50 border-blue-200";
  if (ovr >= 60) return "text-orange-500 bg-orange-50 border-orange-200";
  return "text-gray-500 bg-gray-50 border-gray-200";
}

function getOVRTier(ovr: number): string {
  if (ovr >= 90) return "ELITE";
  if (ovr >= 80) return "GREAT";
  if (ovr >= 70) return "GOOD";
  if (ovr >= 60) return "AVERAGE";
  return "BELOW AVG";
}

function getPositionIcon(position: string) {
  switch (position) {
    case "QB": return "🎯";
    case "RB": return "⚡";
    case "WR": return "🔥";
    case "TE": return "💪";
    default: return "⭐";
  }
}

export default function PlayerRankings() {
  const [position, setPosition] = useState<Position>("ALL");
  const [format, setFormat] = useState<Format>("dynasty");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(3);

  // Fetch merged player data using deterministic ID mapping
  const { data: mergedData, isLoading, refetch } = useQuery({
    queryKey: ["merged-player-data", position, format, selectedWeek],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('format', format);
      params.set('position', position);
      params.set('season', '2025');
      params.set('week', selectedWeek.toString());
      params.set('limit', '100');
      
      const response = await fetch(`/api/player-data/merged?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load merged player data: ${response.status}`);
      }
      return response.json() as Promise<MergedPlayerResponse>;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Extract players from merged data
  const players: MergedPlayer[] = mergedData?.data?.players || [];

  // Filter players based on search
  const filteredPlayers = players.filter((player: MergedPlayer) => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = mergedData?.data?.metadata?.attributes_source;
  const mappingStats = mergedData?.data?.metadata?.mapping_stats;

  const handleRefresh = async () => {
    await refetch();
  };

  if (isLoading && !players.length) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="player-rankings-page">
      {/* Command Hub Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Player Command Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Live OVR ratings powered by real-time performance data
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isLoading}
          className="flex items-center gap-2"
          data-testid="refresh-button"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPlayers || filteredPlayers.length}</div>
            <p className="text-xs text-muted-foreground">Tracked across all positions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Completeness</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completenessScore || 0}%</div>
            <Progress value={stats?.completenessScore || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Week {selectedWeek} coverage</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Live</div>
            <p className="text-xs text-muted-foreground">
              {stats?.latestUpdate ? new Date(stats.latestUpdate).toLocaleTimeString() : 'Updating...'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Elite Players</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredPlayers.filter((p: MergedPlayer) => p.ovr >= 90).length}
            </div>
            <p className="text-xs text-muted-foreground">OVR 90+ ratings</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search players or teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Select value={position} onValueChange={(value) => setPosition(value as Position)}>
            <SelectTrigger className="w-[120px]" data-testid="position-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Positions</SelectItem>
              <SelectItem value="QB">QB</SelectItem>
              <SelectItem value="RB">RB</SelectItem>
              <SelectItem value="WR">WR</SelectItem>
              <SelectItem value="TE">TE</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={format} onValueChange={(value) => setFormat(value as Format)}>
            <SelectTrigger className="w-[120px]" data-testid="format-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dynasty">Dynasty</SelectItem>
              <SelectItem value="redraft">Redraft</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(Number(value))}>
            <SelectTrigger className="w-[100px]" data-testid="week-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].map(week => (
                <SelectItem key={week} value={week.toString()}>Week {week}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Player Rankings - {format.charAt(0).toUpperCase() + format.slice(1)} Format
          </CardTitle>
          <CardDescription>
            Showing {filteredPlayers.length} players with live OVR ratings and Week {selectedWeek} performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No players found matching your criteria.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">OVR</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                  <TableHead className="text-center">Week {selectedWeek}</TableHead>
                  <TableHead className="text-center">Performance</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.slice(0, 50).map((player: MergedPlayer, index: number) => (
                  <TableRow key={player.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="font-medium">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {index + 1}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Link href={`/players/${player.player_id}`} className="flex items-center gap-3 hover:underline">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getPositionIcon(player.position)}</span>
                          <div>
                            <div className="font-semibold">{player.name}</div>
                            <div className="text-sm text-gray-500">{player.team} • {player.position}</div>
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge className={`font-bold text-lg px-3 py-1 ${getOVRColor(player.ovr)}`}>
                        {player.ovr}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {getOVRTier(player.ovr)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      {player.weeklyData ? (
                        <div className="text-sm">
                          {player.weeklyData.fantasyPtsHalfppr ? (
                            <span className="font-semibold">{player.weeklyData.fantasyPtsHalfppr} pts</span>
                          ) : (
                            <span className="text-gray-400">No data</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-center">
                      {player.weeklyData && (
                        <div className="text-xs space-y-1">
                          {player.weeklyData.targets && (
                            <div>Targets: {player.weeklyData.targets}</div>
                          )}
                          {player.weeklyData.carries && (
                            <div>Carries: {player.weeklyData.carries}</div>
                          )}
                          {player.weeklyData.receivingYards && (
                            <div>Rec Yds: {player.weeklyData.receivingYards}</div>
                          )}
                          {player.weeklyData.rushingYards && (
                            <div>Rush Yds: {player.weeklyData.rushingYards}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-center">
                      {player.recent_trend === "up" && <TrendingUp className="h-4 w-4 text-green-500 mx-auto" />}
                      {player.recent_trend === "down" && <TrendingDown className="h-4 w-4 text-red-500 mx-auto" />}
                      {(!player.recent_trend || player.recent_trend === "stable") && (
                        <div className="w-4 h-4 bg-gray-300 rounded-full mx-auto"></div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
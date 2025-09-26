import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Activity, Target, Users, Clock, Zap, Trophy, Filter, Search, RefreshCw, Calendar, Shield, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";

type Position = "ALL" | "QB" | "RB" | "WR" | "TE";
type Format = "dynasty" | "redraft";
type RankingMode = "season" | "weekly";

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
  weekly_scores?: number[];
  overall_median?: number;
  
  // Enhanced Power Rankings integration
  components?: {
    usage: number;
    talent: number;
    environment: number;
    availability: number;
    market_anchor: number;
  };
  confidence?: number;
  badges?: string[];
  explanation?: string;
  
  // SOS integration for weekly mode
  sos_data?: {
    opponent: string;
    sos_score: number; // 0-100, higher = easier
    tier: 'green' | 'yellow' | 'red';
    adjustment: number; // Rating adjustment based on matchup
  };
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


export default function PlayerRankings() {
  const [position, setPosition] = useState<Position>("ALL");
  const [format, setFormat] = useState<Format>("dynasty");
  const [rankingMode, setRankingMode] = useState<RankingMode>("season");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(3);

  // Fetch enhanced rankings data with mode support
  const { data: ovrData, isLoading, refetch } = useQuery({
    queryKey: ["enhanced-rankings", position, format, rankingMode, selectedWeek],
    queryFn: async () => {
      if (rankingMode === "weekly") {
        // Weekly mode - integrate with SOS
        const params = new URLSearchParams();
        params.set('format', format);
        params.set('position', position);
        params.set('week', selectedWeek.toString());
        params.set('mode', 'weekly');
        params.set('limit', '100');
        
        const response = await fetch(`/api/enhanced-rankings?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to load weekly rankings: ${response.status}`);
        }
        return response.json() as Promise<OVRResponse>;
      } else {
        // Season mode - existing OVR with component enhancement
        const params = new URLSearchParams();
        params.set('format', format);
        params.set('position', position);
        params.set('mode', 'season');
        params.set('limit', '100');
        
        const response = await fetch(`/api/enhanced-rankings?${params.toString()}`);
        if (!response.ok) {
          // Fallback to existing OVR endpoint
          const fallbackResponse = await fetch(`/api/ovr?${params.toString()}`);
          if (!fallbackResponse.ok) {
            throw new Error(`Failed to load season rankings: ${fallbackResponse.status}`);
          }
          return fallbackResponse.json() as Promise<OVRResponse>;
        }
        return response.json() as Promise<OVRResponse>;
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch weekly data for multiple weeks to calculate median
  const { data: weeklyData } = useQuery({
    queryKey: ["weekly-ovr-data", position, format],
    queryFn: async () => {
      const weeks = [1, 2, 3, 4, 5]; // Get first 5 weeks
      const allWeeklyData: Record<string, number[]> = {};
      
      // Fetch each player's OVR for multiple weeks
      const players = ovrData?.data?.players || [];
      
      for (const player of players.slice(0, 20)) { // Limit for performance
        const weeklyScores: number[] = [];
        
        for (const week of weeks) {
          try {
            const response = await fetch(`/api/ovr/${player.player_id}?format=${format}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data?.ovr) {
                weeklyScores.push(result.data.ovr);
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch week ${week} data for ${player.name}`);
          }
        }
        
        if (weeklyScores.length > 0) {
          allWeeklyData[player.player_id] = weeklyScores;
        }
      }
      
      return allWeeklyData;
    },
    enabled: !!ovrData?.data?.players?.length,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  // Calculate median from array of numbers
  const calculateMedian = (scores: number[]): number => {
    if (scores.length === 0) return 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  };

  // Process players with weekly data and median calculations
  const players: OVRPlayer[] = useMemo(() => {
    const baseUsers = ovrData?.data?.players || [];
    
    return baseUsers.map(player => {
      const playerWeeklyScores = weeklyData?.[player.player_id] || [];
      const overallMedian = playerWeeklyScores.length > 0 
        ? calculateMedian(playerWeeklyScores) 
        : player.ovr;
      
      return {
        ...player,
        weekly_scores: playerWeeklyScores,
        overall_median: overallMedian
      };
    });
  }, [ovrData, weeklyData]);

  // Filter players based on search
  const filteredPlayers = players.filter((player: OVRPlayer) => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = ovrData?.data?.metadata;
  const distribution = ovrData?.data?.distribution;

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
            <div className="text-2xl font-bold">{stats?.total_players || filteredPlayers.length}</div>
            <p className="text-xs text-muted-foreground">Tracked across all positions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Completeness</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((players.filter(p => p.weekly_scores && p.weekly_scores.length > 0).length / players.length) * 100) || 0}%</div>
            <Progress value={Math.round((players.filter(p => p.weekly_scores && p.weekly_scores.length > 0).length / players.length) * 100) || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Players with weekly data</p>
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
              {stats?.generated_at ? new Date(stats.generated_at).toLocaleTimeString() : 'Updating...'}
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
              {filteredPlayers.filter((p: OVRPlayer) => p.ovr >= 90).length}
            </div>
            <p className="text-xs text-muted-foreground">OVR 90+ ratings</p>
          </CardContent>
        </Card>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center">
        <Tabs value={rankingMode} onValueChange={(value) => setRankingMode(value as RankingMode)} className="w-fit">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="season" className="flex items-center gap-2" data-testid="season-mode">
              <Trophy className="h-4 w-4" />
              Rest of Season
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-2" data-testid="weekly-mode">
              <Calendar className="h-4 w-4" />
              This Week
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
          
          {rankingMode === "weekly" && (
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
          )}
        </div>
      </div>

      {/* Main Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {rankingMode === "season" ? <Trophy className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
            {rankingMode === "season" ? "Rest of Season" : `Week ${selectedWeek}`} Rankings - {format.charAt(0).toUpperCase() + format.slice(1)}
          </CardTitle>
          <CardDescription>
            {rankingMode === "season" 
              ? `Long-term value rankings with component analysis across ${filteredPlayers.length} players`
              : `Matchup-adjusted rankings for Week ${selectedWeek} across ${filteredPlayers.length} players`
            }
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
                  <TableHead className="text-center">
                    {rankingMode === "season" ? "Season OVR" : "Week OVR"}
                  </TableHead>
                  {rankingMode === "season" ? (
                    <>
                      <TableHead className="text-center">Components</TableHead>
                      <TableHead className="text-center">Confidence</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-center">Matchup</TableHead>
                      <TableHead className="text-center">SOS</TableHead>
                    </>
                  )}
                  <TableHead className="text-center">Explanation</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.slice(0, 50).map((player: OVRPlayer, index: number) => (
                  <TableRow key={player.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="font-medium">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {index + 1}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <TooltipProvider>
                        <Link href={`/players/${player.player_id}`} className="flex items-center gap-3 hover:underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-bold px-2 py-1">
                              {player.position}
                            </Badge>
                            <div>
                              <div className="font-semibold flex items-center gap-1">
                                {player.name}
                                {player.badges && player.badges.length > 0 && (
                                  <div className="flex gap-1">
                                    {player.badges.slice(0, 2).map((badge, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs px-1 py-0">
                                        {badge}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">{player.team}</div>
                            </div>
                          </div>
                        </Link>
                      </TooltipProvider>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge className={`font-bold text-lg px-3 py-1 ${getOVRColor(player.ovr)}`}>
                        {player.ovr}
                      </Badge>
                    </TableCell>
                    
                    {rankingMode === "season" ? (
                      <>
                        {/* Season Mode: Components */}
                        <TableCell className="text-center">
                          {player.components ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    <div>U: {player.components.usage}</div>
                                    <div>T: {player.components.talent}</div>
                                    <div>E: {player.components.environment}</div>
                                    <div>A: {player.components.availability}</div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <div>Usage: {player.components.usage}%</div>
                                    <div>Talent: {player.components.talent}%</div>
                                    <div>Environment: {player.components.environment}%</div>
                                    <div>Availability: {player.components.availability}%</div>
                                    <div>Market: {player.components.market_anchor}%</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        
                        {/* Season Mode: Confidence */}
                        <TableCell className="text-center">
                          {player.confidence ? (
                            <Badge className={`text-xs ${
                              player.confidence >= 0.8 ? 'bg-green-100 text-green-800' : 
                              player.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(player.confidence * 100)}%
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        {/* Weekly Mode: Matchup */}
                        <TableCell className="text-center">
                          {player.sos_data ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm font-medium">vs {player.sos_data.opponent}</span>
                              {player.sos_data.tier === 'green' && <Shield className="h-4 w-4 text-green-500" />}
                              {player.sos_data.tier === 'yellow' && <Shield className="h-4 w-4 text-yellow-500" />}
                              {player.sos_data.tier === 'red' && <Shield className="h-4 w-4 text-red-500" />}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        
                        {/* Weekly Mode: SOS Score */}
                        <TableCell className="text-center">
                          {player.sos_data ? (
                            <Badge className={`text-xs ${
                              player.sos_data.tier === 'green' ? 'bg-green-100 text-green-800' : 
                              player.sos_data.tier === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {player.sos_data.sos_score}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                      </>
                    )}
                    
                    {/* Explanation */}
                    <TableCell className="text-center max-w-[200px]">
                      {player.explanation ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-sm text-gray-600 truncate cursor-help">
                                {player.explanation}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>{player.explanation}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    
                    {/* Tier */}
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {getOVRTier(player.ovr)}
                      </Badge>
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
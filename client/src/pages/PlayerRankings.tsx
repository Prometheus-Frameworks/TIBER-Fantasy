import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, Clock, AlertCircle, Trophy, Target, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Position = "QB" | "RB" | "WR" | "TE" | "All";

interface RankingPlayer {
  player_id: string;
  name: string;
  team: string;
  pos: string;
  our_rank: number;
  ecr_rank?: number;
  edge_vs_ecr?: number;
  beat_flag?: boolean;
}

interface RankingResponse {
  success: boolean;
  data: RankingPlayer[];
}

export default function PlayerRankings() {
  const [position, setPosition] = useState<Position>("All");

  const { data: rankingsData, isLoading, error, refetch } = useQuery({
    queryKey: ["player-rankings", position],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (position !== "All") {
        params.set('pos', position);
      }
      params.set('beat_only', 'false'); // Get all players, not just ECR-beating ones
      
      const response = await fetch(`/api/predictions/latest/players?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load rankings data');
      const result = await response.json();
      return result as RankingResponse;
    },
    retry: 1
  });

  const players = rankingsData?.data || [];

  // Calculate difference between our rank and ECR rank
  const calculateDifference = (ourRank: number, ecrRank?: number): { diff: number, isPositive: boolean } => {
    if (!ecrRank) return { diff: 0, isPositive: false };
    // Positive difference means we rank the player higher (lower number = better rank)
    const diff = ecrRank - ourRank;
    return { diff: Math.abs(diff), isPositive: diff > 0 };
  };

  // Get icon for ranking difference
  const getDifferenceIcon = (ourRank: number, ecrRank?: number) => {
    if (!ecrRank) return <Minus className="h-4 w-4 text-gray-400" />;
    const { isPositive } = calculateDifference(ourRank, ecrRank);
    return isPositive ? 
      <TrendingUp className="h-4 w-4 text-green-600" /> : 
      <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  // Get badge color for difference
  const getDifferenceBadgeColor = (ourRank: number, ecrRank?: number) => {
    if (!ecrRank) return "bg-gray-100 text-gray-800";
    const { isPositive } = calculateDifference(ourRank, ecrRank);
    return isPositive ? 
      "bg-green-100 text-green-800 border-green-300" : 
      "bg-red-100 text-red-800 border-red-300";
  };

  // Filter players based on position
  const filteredPlayers = position === "All" ? players : players.filter(p => p.pos === position);

  // Sort players by our ranking
  const sortedPlayers = [...filteredPlayers].sort((a, b) => a.our_rank - b.our_rank);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4" data-testid="rankings-loading">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="bg-white rounded-lg border p-6">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96 mb-6" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-48" />
            </div>
          </div>

          {/* Table Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-8" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-8" />
                      <Skeleton className="h-6 w-8" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4" data-testid="rankings-error">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Failed to Load Rankings</h2>
            <p className="text-red-600 mb-4">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => refetch()} variant="outline" data-testid="button-retry-rankings">
              <Clock className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4" data-testid="rankings-page">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-page-title">
                Player Rankings Comparison
              </h1>
              <p className="text-gray-600 mb-6" data-testid="text-page-description">
                Our player rankings compared to Expert Consensus Rankings (ECR) with difference indicators
              </p>
              
              {/* Controls */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Position:</span>
                  <Select value={position} onValueChange={(value: Position) => setPosition(value)}>
                    <SelectTrigger className="w-32" data-testid="select-position">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="QB">QB</SelectItem>
                      <SelectItem value="RB">RB</SelectItem>
                      <SelectItem value="WR">WR</SelectItem>
                      <SelectItem value="TE">TE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  data-testid="button-refresh-rankings"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Trophy className="h-4 w-4" />
                <span data-testid="text-total-players">{sortedPlayers.length} Players</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rankings Table */}
        <Card data-testid="rankings-table">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Player Rankings Comparison
            </CardTitle>
            <CardDescription>
              Rankings comparison showing where we differ from expert consensus
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {sortedPlayers.length === 0 ? (
              <div className="text-center py-8" data-testid="rankings-empty">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No rankings data available</p>
                <p className="text-sm text-gray-500">
                  Try selecting a different position or refreshing the data
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Our Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="w-20">Position</TableHead>
                    <TableHead className="w-16">ECR</TableHead>
                    <TableHead className="w-24">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlayers.map((player) => {
                    const { diff, isPositive } = calculateDifference(player.our_rank, player.ecr_rank);
                    
                    return (
                      <TableRow 
                        key={player.player_id} 
                        className="hover:bg-gray-50"
                        data-testid={`row-player-${player.player_id}`}
                      >
                        <TableCell className="font-mono text-center" data-testid={`text-our-rank-${player.player_id}`}>
                          <Badge variant="outline" className="font-mono">
                            {player.our_rank}
                          </Badge>
                        </TableCell>
                        
                        <TableCell data-testid={`text-player-info-${player.player_id}`}>
                          <div>
                            <div className="font-semibold">{player.name}</div>
                            <div className="text-sm text-gray-500">{player.team}</div>
                          </div>
                        </TableCell>
                        
                        <TableCell data-testid={`text-position-${player.player_id}`}>
                          <Badge variant="secondary" className="font-mono">
                            {player.pos}
                          </Badge>
                        </TableCell>
                        
                        <TableCell className="text-center" data-testid={`text-ecr-rank-${player.player_id}`}>
                          {player.ecr_rank ? (
                            <Badge variant="outline" className="font-mono">
                              {player.ecr_rank}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        
                        <TableCell className="text-center" data-testid={`text-difference-${player.player_id}`}>
                          {player.ecr_rank ? (
                            <div className="flex items-center justify-center gap-1">
                              {getDifferenceIcon(player.our_rank, player.ecr_rank)}
                              <Badge 
                                variant="outline" 
                                className={`font-mono ${getDifferenceBadgeColor(player.our_rank, player.ecr_rank)}`}
                              >
                                {isPositive ? '+' : '-'}{diff}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span>We rank higher than ECR</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span>We rank lower than ECR</span>
              </div>
              <div className="flex items-center gap-2">
                <Minus className="h-4 w-4 text-gray-400" />
                <span>No ECR data available</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
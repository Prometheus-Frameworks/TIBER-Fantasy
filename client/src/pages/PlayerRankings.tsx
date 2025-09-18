import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, AlertCircle, Trophy, Target, Filter, CheckCircle } from "lucide-react";
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
  rank: number;
}

interface OTCFinalRankingsResponse {
  success: boolean;
  data: RankingPlayer[];
  metadata: {
    generated_at: string;
    total_players: number;
    positions: string[];
    source: string;
  };
}

export default function PlayerRankings() {
  const [position, setPosition] = useState<Position>("All");
  const queryClient = useQueryClient();

  // Single authoritative data source - OTC Final Rankings
  const { data: rankingsData, isLoading, error, refetch } = useQuery({
    queryKey: ["otc-final-rankings", position],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (position !== "All") {
        params.set('pos', position);
      }
      
      const response = await fetch(`/api/rankings/otc-final?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load OTC final rankings: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();
      return result as OTCFinalRankingsResponse;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Cache for 30 minutes
  });

  const players = rankingsData?.data || [];
  
  const handleRefresh = async () => {
    // Use TanStack Query invalidation instead of page reload
    await queryClient.invalidateQueries({ 
      queryKey: ["otc-final-rankings"] 
    });
    refetch();
  };


  // Filter players based on position
  const filteredPlayers = position === "All" ? players : players.filter(p => p.pos === position);

  // Sort players by ranking
  const sortedPlayers = [...filteredPlayers].sort((a, b) => a.rank - b.rank);

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
            <Button onClick={handleRefresh} variant="outline" data-testid="button-retry-rankings">
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
                OTC Player Rankings
              </h1>
              <div className="flex items-center gap-4 mb-4">
                <p className="text-gray-600" data-testid="text-page-description">
                  Official OTC player rankings combining consensus data with proprietary adjustments
                </p>
                {rankingsData?.metadata && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300" data-testid="badge-authoritative-data">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Authoritative
                  </Badge>
                )}
              </div>
              
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
                  onClick={handleRefresh}
                  data-testid="button-refresh-rankings"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            </div>

            <div className="text-right">
              <div className="flex flex-col items-end gap-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span data-testid="text-total-players">{sortedPlayers.length} Players</span>
                </div>
                {rankingsData?.metadata?.generated_at && (
                  <div className="text-xs text-gray-500">
                    Updated: {new Date(rankingsData.metadata.generated_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rankings Table */}
        <Card data-testid="rankings-table">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              OTC Player Rankings
            </CardTitle>
            <CardDescription>
              Authoritative OTC player rankings combining consensus data from multiple sources with our proprietary adjustments and algorithms
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
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="w-20">Position</TableHead>
                    <TableHead className="w-20">Team</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlayers.map((player) => (
                    <TableRow 
                      key={player.player_id} 
                      className="hover:bg-gray-50"
                      data-testid={`row-player-${player.player_id}`}
                    >
                      <TableCell className="font-mono text-center" data-testid={`text-rank-${player.player_id}`}>
                        <Badge variant="outline" className="font-mono">
                          {player.rank}
                        </Badge>
                      </TableCell>
                      
                      <TableCell data-testid={`text-player-name-${player.player_id}`}>
                        <div className="font-semibold">{player.name}</div>
                      </TableCell>
                      
                      <TableCell data-testid={`text-position-${player.player_id}`}>
                        <Badge variant="secondary" className="font-mono">
                          {player.pos}
                        </Badge>
                      </TableCell>
                      
                      <TableCell data-testid={`text-team-${player.player_id}`}>
                        <span className="font-medium text-gray-700">{player.team}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
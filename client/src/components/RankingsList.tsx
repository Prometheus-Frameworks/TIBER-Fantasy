import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { nameOf } from "@/hooks/usePlayerPool";
import { loadEnhancedRankings, searchRedraftPlayers, type RedraftPlayer } from "@/lib/redraftApi";
import { 
  Users, 
  TrendingUp, 
  Search,
  Trophy,
  Target
} from "lucide-react";

interface RankingsListProps {
  pos?: "QB" | "RB" | "WR" | "TE";
  title?: string;
  showStats?: boolean;
  maxPlayers?: number;
}

// Player ranking card component
function PlayerRankingCard({ player, rank, showVORP = false }: { 
  player: RedraftPlayer; 
  rank: number; 
  showVORP?: boolean; 
}) {
  const playerName = player.player_name || nameOf(player.id);
  const playerTeam = player.team;
  const playerPos = player.position;
  
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs">
            {rank}
          </Badge>
        </div>
        <div className="flex-grow">
          <a 
            href={`/player-compass?id=${player.id}`}
            className="font-semibold text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {playerName}
          </a>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {playerTeam} • {playerPos}
            {player.adp && ` • ADP ${player.adp.toFixed(1)}`}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 text-right">
        {showVORP && player.vorp && player.vorp > 0 && (
          <div className="text-xs">
            <div className="font-medium">{player.vorp.toFixed(1)}</div>
            <div className="text-gray-500 dark:text-gray-400">VORP</div>
          </div>
        )}
        {player.projected_points && player.projected_points > 0 && (
          <div className="text-xs">
            <div className="font-medium">{player.projected_points.toFixed(1)}</div>
            <div className="text-gray-500 dark:text-gray-400">Proj</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RankingsList({ pos, title, showStats = true, maxPlayers = 50 }: RankingsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("rank");
  
  const position = pos || "ALL";
  
  // Load initial rankings on mount
  const { data: initialPlayers, isLoading: initialLoading } = useQuery({
    queryKey: ['redraft-rankings', position],
    queryFn: () => loadEnhancedRankings(position),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  
  // Search query with debounced search
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['redraft-search', position, searchQuery],
    queryFn: () => searchRedraftPlayers(searchQuery, position),
    enabled: searchQuery.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
  // Use search results if searching, otherwise use initial data
  const redraftPlayers = searchQuery.length > 0 ? searchResults : initialPlayers;
  const isLoading = searchQuery.length > 0 ? searchLoading : initialLoading;
  
  // Filter by search
  const filteredPlayers = redraftPlayers?.filter(player =>
    player.player_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  // Sort players
  const sortedPlayers = filteredPlayers.sort((a, b) => {
    switch (sortBy) {
      case 'vorp':
        return (b.vorp || 0) - (a.vorp || 0);
      case 'projected':
        return (b.projected_points || 0) - (a.projected_points || 0);
      case 'adp':
        return (a.adp || 999) - (b.adp || 999);
      default:
        return 0; // Keep original order (rank)
    }
  }).slice(0, maxPlayers);
  
  const displayTitle = title || (position === "ALL" ? "All Positions" : `${position} Rankings`);
  
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder={`Search ${position === 'ALL' ? 'players' : position + 's'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rank">Default Rank</SelectItem>
            <SelectItem value="vorp">VORP</SelectItem>
            <SelectItem value="projected">Projected Points</SelectItem>
            <SelectItem value="adp">ADP</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Stats Header */}
      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div className="text-sm">
                  <div className="font-semibold">{filteredPlayers.length}</div>
                  <div className="text-gray-500">Players</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-green-500" />
                <div className="text-sm">
                  <div className="font-semibold">
                    {filteredPlayers.filter(p => p.vorp && p.vorp > 100).length}
                  </div>
                  <div className="text-gray-500">Value Picks</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <div className="text-sm">
                  <div className="font-semibold">
                    {Math.round(filteredPlayers.reduce((sum, p) => sum + (p.projected_points || 0), 0) / Math.max(filteredPlayers.length, 1))}
                  </div>
                  <div className="text-gray-500">Avg Proj</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <div className="text-sm">
                  <div className="font-semibold">
                    {filteredPlayers.filter(p => p.vorp && p.vorp > 200).length}
                  </div>
                  <div className="text-gray-500">High VORP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Player List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{displayTitle}</span>
            {isLoading && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                <span>Loading...</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            {sortedPlayers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No players found matching your criteria</p>
              </div>
            ) : (
              <div className="space-y-1 p-4">
                {sortedPlayers.map((player, index) => (
                  <PlayerRankingCard
                    key={player.id}
                    player={player}
                    rank={index + 1}
                    showVORP={sortBy === 'vorp'}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
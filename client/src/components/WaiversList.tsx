import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nameOf } from "@/hooks/usePlayerPool";
import { type RedraftPlayer } from "@/lib/redraftApi";
import { 
  Search,
  Target,
  TrendingUp
} from "lucide-react";

interface WaiversListProps {
  rows: RedraftPlayer[];
  title?: string;
}

export default function WaiversList({ rows, title = "Waiver Wire Candidates" }: WaiversListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("rank");
  
  // Filter by search
  const filteredPlayers = rows.filter(player =>
    player.player_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Sort players
  const sortedPlayers = filteredPlayers.sort((a, b) => {
    switch (sortBy) {
      case 'projected':
        return (b.projected_points || 0) - (a.projected_points || 0);
      case 'adp':
        return (a.adp || 999) - (b.adp || 999);
      case 'team':
        return (a.team || '').localeCompare(b.team || '');
      default:
        return 0; // Keep original order (rank)
    }
  });
  
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search waiver candidates..."
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
            <SelectItem value="rank">Rank Order</SelectItem>
            <SelectItem value="projected">Projected Points</SelectItem>
            <SelectItem value="adp">ADP</SelectItem>
            <SelectItem value="team">Team</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-blue-500" />
              <div className="text-sm">
                <div className="font-semibold">{sortedPlayers.length}</div>
                <div className="text-gray-500">Available</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div className="text-sm">
                <div className="font-semibold">
                  {Math.round(sortedPlayers.reduce((sum, p) => sum + (p.projected_points || 0), 0) / Math.max(sortedPlayers.length, 1))}
                </div>
                <div className="text-gray-500">Avg Proj</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 bg-purple-500 rounded-full" />
              <div className="text-sm">
                <div className="font-semibold">
                  {new Set(sortedPlayers.map(p => p.team)).size}
                </div>
                <div className="text-gray-500">Teams</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Waiver Wire List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            {sortedPlayers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No waiver candidates found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sortedPlayers.slice(0, 50).map((player, index) => (
                  <div key={player.id || index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs">
                          {index + 51}
                        </Badge>
                      </div>
                      <div className="flex-grow">
                        <a 
                          href={`/player-compass?id=${player.id}`}
                          className="font-semibold text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {player.player_name}
                        </a>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {player.team} • {player.position}
                          {player.adp && ` • ADP ${player.adp.toFixed(1)}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-right">
                      {player.projected_points && player.projected_points > 0 && (
                        <div className="text-xs">
                          <div className="font-medium">{player.projected_points.toFixed(1)}</div>
                          <div className="text-gray-500 dark:text-gray-400">Proj</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
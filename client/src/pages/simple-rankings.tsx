import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { Player } from "@shared/schema";

interface SimpleRankedPlayer {
  rank: number;
  player: Player;
  isUserPlayer: boolean;
}

export default function SimpleRankings() {
  const { data: teamPlayers, isLoading: playersLoading } = useQuery<(Player & { isStarter: boolean })[]>({
    queryKey: ["/api/teams", 1, "players"],
  });

  const { data: allPlayers, isLoading: allPlayersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players/available"],
  });

  if (playersLoading || allPlayersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const userPlayerIds = new Set(teamPlayers?.map(p => p.id) || []);

  // Generate simple rankings for each position
  const generateSimpleRankings = (position: string): SimpleRankedPlayer[] => {
    const positionPlayers = (allPlayers || [])
      .filter(p => p.position === position)
      .sort((a, b) => (b.avgPoints + b.upside) - (a.avgPoints + a.upside)) // Sort by dynasty value
      .slice(0, 50); // Top 50 for each position

    return positionPlayers.map((player, index) => ({
      rank: index + 1,
      player,
      isUserPlayer: userPlayerIds.has(player.id),
    }));
  };

  const positions = ["QB", "RB", "WR", "TE"];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dynasty Rankings</h1>
        <p className="text-gray-600">Simple numbered rankings for your league</p>
      </div>

      <Tabs defaultValue="WR" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {positions.map((position) => (
            <TabsTrigger key={position} value={position}>
              {position}
            </TabsTrigger>
          ))}
        </TabsList>

        {positions.map((position) => (
          <TabsContent key={position} value={position}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {position === "QB" ? "Quarterbacks" :
                   position === "RB" ? "Running Backs" :
                   position === "WR" ? "Wide Receivers" :
                   "Tight Ends"}
                  <span className="text-sm text-gray-500">
                    ({generateSimpleRankings(position).filter(r => r.isUserPlayer).length} on your team)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {generateSimpleRankings(position).map((ranking) => (
                    <div
                      key={ranking.player.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        ranking.isUserPlayer 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-700">
                            {ranking.rank}
                          </span>
                        </div>
                        
                        <div>
                          <div className="font-medium text-gray-900">
                            {ranking.player.name}
                            {ranking.isUserPlayer && (
                              <Badge className="ml-2 bg-blue-600 text-white">Your Player</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {ranking.player.team} • {ranking.player.avgPoints.toFixed(1)} PPG
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {position}{ranking.rank}
                        </div>
                        <div className="text-xs text-gray-500">
                          Position Rank
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
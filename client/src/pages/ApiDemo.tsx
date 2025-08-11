import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmt, type Pos } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, TrendingUp, Compass } from "lucide-react";

export default function ApiDemo() {
  const [selectedPos, setSelectedPos] = useState<Pos>("WR");

  const { data: version } = useQuery({
    queryKey: ["/api/version"],
    queryFn: () => api.version()
  });

  const { data: redraftData, isLoading: redraftLoading } = useQuery({
    queryKey: ["/api/redraft/rankings", selectedPos],
    queryFn: () => api.redraftRankings({ pos: selectedPos, limit: 5 })
  });

  const { data: dynastyData, isLoading: dynastyLoading } = useQuery({
    queryKey: ["/api/rankings/dynasty", selectedPos],
    queryFn: async () => {
      const response = await fetch(`/api/rankings/dynasty?pos=${selectedPos}&limit=5`);
      return response.json();
    }
  });

  const { data: compassData, isLoading: compassLoading } = useQuery({
    queryKey: ["/api/compass", selectedPos],
    queryFn: () => api.compassPos(selectedPos, { limit: 3 })
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Demo</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Live demonstration of type-safe API client with real NFL data
          </p>
        </div>
        
        {version && (
          <Badge variant="secondary" className="font-mono">
            Build: {version.build?.slice(-8)}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Position:</label>
        <Select value={selectedPos} onValueChange={(value: Pos) => setSelectedPos(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="QB">QB</SelectItem>
            <SelectItem value="RB">RB</SelectItem>
            <SelectItem value="WR">WR</SelectItem>
            <SelectItem value="TE">TE</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Redraft Rankings */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Trophy className="h-5 w-5 text-yellow-600 mr-2" />
            <CardTitle className="text-lg">Redraft Rankings</CardTitle>
            {redraftLoading && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
          </CardHeader>
          <CardContent>
            {redraftData ? (
              <div className="space-y-3">
                {redraftData.data.map((player, idx) => (
                  <div key={player.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{fmt.title(player.name)}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {player.team} • {player.tier}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">#{player.rank}</div>
                      <div className="text-sm text-gray-600">
                        {fmt.two(player.proj_pts)} pts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                Select a position to view rankings
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynasty Rankings */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
            <CardTitle className="text-lg">Dynasty Rankings</CardTitle>
            {dynastyLoading && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
          </CardHeader>
          <CardContent>
            {dynastyData ? (
              <div className="space-y-3">
                {dynastyData.slice(0, 5).filter((p: any) => p.position === selectedPos).map((player: any, idx: number) => (
                  <div key={player.player_name + idx} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{fmt.title(player.player_name)}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {player.team} • Tier {player.tier}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">#{idx + 1}</div>
                      <div className="text-sm text-gray-600">
                        VORP: {fmt.two(player.vorp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                Loading dynasty data...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player Compass */}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Compass className="h-5 w-5 text-green-600 mr-2" />
            <CardTitle className="text-lg">Player Compass</CardTitle>
            {compassLoading && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
          </CardHeader>
          <CardContent>
            {compassData ? (
              <div className="space-y-4">
                {compassData.data.map((player) => (
                  <div key={player.id} className="space-y-2">
                    <div className="font-medium">{fmt.title(player.name)}</div>
                    <div className="text-sm text-gray-600">{player.team}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>N: {player.compass.north}</div>
                      <div>E: {player.compass.east}</div>
                      <div>S: {player.compass.south}</div>
                      <div>W: {player.compass.west}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                Loading compass data...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Client Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-semibold text-green-600">✓ Type Safety</div>
              <div className="text-gray-600">Full TypeScript interfaces</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">✓ Real Data</div>
              <div className="text-gray-600">Authentic NFL statistics</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">✓ Error Handling</div>
              <div className="text-gray-600">Timeout and retry logic</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">✓ Same Origin</div>
              <div className="text-gray-600">Optimized for Replit</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
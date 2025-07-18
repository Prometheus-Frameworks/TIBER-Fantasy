import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Database, Zap, Users, Target, TrendingUp } from "lucide-react";

type FantasyProEndpoint = 'players' | 'rankings' | 'projections';
type FantasyProSport = 'nfl' | 'nba' | 'mlb';

export default function FantasyProTest() {
  const [endpoint, setEndpoint] = useState<FantasyProEndpoint>('players');
  const [sport, setSport] = useState<FantasyProSport>('nfl');
  const [position, setPosition] = useState<string>('all');
  const [scoring, setScoring] = useState<string>('std');
  const [refreshKey, setRefreshKey] = useState(0);

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (position) queryParams.append('position', position);
  if (scoring) queryParams.append('scoring', scoring);
  if (endpoint !== 'players') {
    queryParams.append('year', '2025');
  }
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  // Fetch data from FantasyPros API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/fantasypros', endpoint, sport, queryString, refreshKey],
    queryFn: async () => {
      const url = `/api/fantasypros/${endpoint}/${sport}${queryString}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return response.json();
    },
    enabled: true
  });

  // Fetch cache status
  const { data: cacheStatus } = useQuery({
    queryKey: ['/api/fantasypros/cache/status'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const handleClearCache = async () => {
    try {
      await fetch(`/api/fantasypros/cache/${endpoint}/${sport}`, {
        method: 'DELETE'
      });
      handleRefresh();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const getEndpointIcon = (endpoint: string) => {
    switch (endpoint) {
      case 'players': return <Users className="h-4 w-4" />;
      case 'rankings': return <Target className="h-4 w-4" />;
      case 'projections': return <TrendingUp className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const renderData = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Fetching {endpoint} data...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">
            <strong>Error:</strong> {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      );
    }

    if (!data?.success) {
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            <strong>API Error:</strong> {data?.error || 'Unknown API error'}
          </p>
        </div>
      );
    }

    const players = data.data || [];
    
    return (
      <div className="space-y-4">
        {/* API Response Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm font-medium text-blue-800">Data Count</div>
            <div className="text-lg font-bold text-blue-900">{data.count || 0}</div>
          </div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm font-medium text-green-800">Cached</div>
            <div className="text-lg font-bold text-green-900">{data.cached ? 'Yes' : 'No'}</div>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="text-sm font-medium text-purple-800">Endpoint</div>
            <div className="text-lg font-bold text-purple-900">{endpoint}</div>
          </div>
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-sm font-medium text-orange-800">Sport</div>
            <div className="text-lg font-bold text-orange-900">{sport.toUpperCase()}</div>
          </div>
        </div>

        {/* Player Data Table */}
        {players.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {endpoint === 'players' && (
                      <>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Team</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Position</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Jersey</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Experience</th>
                      </>
                    )}
                    {endpoint === 'rankings' && (
                      <>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Rank</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Team</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Position</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tier</th>
                      </>
                    )}
                    {endpoint === 'projections' && (
                      <>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Team</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Position</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Projected Points</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Games</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {players.slice(0, 20).map((player: any, index: number) => (
                    <tr key={player.player_id || index} className="border-t hover:bg-gray-50">
                      {endpoint === 'players' && (
                        <>
                          <td className="px-4 py-2 text-sm">{player.player_name}</td>
                          <td className="px-4 py-2 text-sm">{player.team}</td>
                          <td className="px-4 py-2 text-sm">
                            <Badge variant="outline">{player.position}</Badge>
                          </td>
                          <td className="px-4 py-2 text-sm">{player.jersey_number || '—'}</td>
                          <td className="px-4 py-2 text-sm">{player.years_exp || '—'}</td>
                        </>
                      )}
                      {endpoint === 'rankings' && (
                        <>
                          <td className="px-4 py-2 text-sm font-bold">#{player.rank}</td>
                          <td className="px-4 py-2 text-sm">{player.player_name}</td>
                          <td className="px-4 py-2 text-sm">{player.team}</td>
                          <td className="px-4 py-2 text-sm">
                            <Badge variant="outline">{player.position}</Badge>
                          </td>
                          <td className="px-4 py-2 text-sm">{player.tier || '—'}</td>
                        </>
                      )}
                      {endpoint === 'projections' && (
                        <>
                          <td className="px-4 py-2 text-sm">{player.player_name}</td>
                          <td className="px-4 py-2 text-sm">{player.team}</td>
                          <td className="px-4 py-2 text-sm">
                            <Badge variant="outline">{player.position}</Badge>
                          </td>
                          <td className="px-4 py-2 text-sm font-bold">{player.projected_points?.toFixed(1) || '—'}</td>
                          <td className="px-4 py-2 text-sm">{player.games || '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {players.length > 20 && (
              <div className="p-3 bg-gray-50 border-t text-center text-sm text-gray-600">
                Showing first 20 of {players.length} total records
              </div>
            )}
          </div>
        )}

        {players.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No data available for the selected parameters
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-blue-600" />
            FantasyPros API Test
          </h1>
          <p className="text-gray-600">Test flexible endpoint control for players, rankings, and projections</p>
        </div>
        {cacheStatus && (
          <Badge variant={cacheStatus.data?.available ? "default" : "destructive"}>
            {cacheStatus.data?.available ? "API Available" : "API Unavailable"}
          </Badge>
        )}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            API Controls
          </CardTitle>
          <CardDescription>
            Configure endpoint, sport, and parameters for FantasyPros data fetching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Endpoint Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Endpoint</label>
              <Select value={endpoint} onValueChange={(value: FantasyProEndpoint) => setEndpoint(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="players">Players</SelectItem>
                  <SelectItem value="rankings">Rankings</SelectItem>
                  <SelectItem value="projections">Projections</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sport Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sport</label>
              <Select value={sport} onValueChange={(value: FantasyProSport) => setSport(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfl">NFL</SelectItem>
                  <SelectItem value="nba">NBA</SelectItem>
                  <SelectItem value="mlb">MLB</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Position Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Position</label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="All positions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  <SelectItem value="QB">QB</SelectItem>
                  <SelectItem value="RB">RB</SelectItem>
                  <SelectItem value="WR">WR</SelectItem>
                  <SelectItem value="TE">TE</SelectItem>
                  <SelectItem value="K">K</SelectItem>
                  <SelectItem value="DST">DST</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scoring Type */}
            {endpoint !== 'players' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Scoring</label>
                <Select value={scoring} onValueChange={setScoring}>
                  <SelectTrigger>
                    <SelectValue placeholder="Standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="std">Standard</SelectItem>
                    <SelectItem value="ppr">PPR</SelectItem>
                    <SelectItem value="half-ppr">Half PPR</SelectItem>
                    <SelectItem value="superflex">Superflex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <div className="flex gap-2">
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button onClick={handleClearCache} variant="outline" size="sm">
                  Clear Cache
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Response */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getEndpointIcon(endpoint)}
            API Response - {endpoint.charAt(0).toUpperCase() + endpoint.slice(1)}
          </CardTitle>
          <CardDescription>
            Live data from FantasyPros {endpoint} endpoint
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderData()}
        </CardContent>
      </Card>

      {/* Cache Status */}
      {cacheStatus?.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600">Service Available</div>
                <div className="text-lg font-bold">{cacheStatus.data.available ? 'Yes' : 'No'}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600">Cached Entries</div>
                <div className="text-lg font-bold">{cacheStatus.data.cache?.cached || 0}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600">Total Entries</div>
                <div className="text-lg font-bold">{cacheStatus.data.cache?.total || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* JSON Response */}
      <Card>
        <CardHeader>
          <CardTitle>Raw JSON Response</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm max-h-64 overflow-y-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}